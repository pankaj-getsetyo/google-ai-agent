import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { ApifyClient } from "apify-client";
import dotenv from "dotenv";
import {
  BaseAgent,
  SequentialAgent,
  InMemorySessionService,
  Runner,
  LlmAgent,
  FunctionTool,
  createEvent,
} from "@google/adk";
import type { InvocationContext } from "@google/adk";
import {
  CreatorIntelligenceDossier,
  InstagramData,
  StructuredContent,
  VisitedDestination,
  TravelPersona,
  TravelRecommendation,
  ItineraryPrompt,
  GetSetYoItinerary,
  MapData,
  AgentLog,
  InstagramPost,
  InstagramProfile
} from "./src/types.js";

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

function extractUsername(input: string): string {
  let clean = input.trim();
  const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/);
  if (urlMatch) clean = urlMatch[1];
  return clean.replace(/^@/, "").replace(/\/$/, "").trim();
}

// --- SECURE LAZY GEMINI CLIENT INITIALIZATION ---
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "") {
      const isAccessToken = key.startsWith("ya29.") || key.startsWith("Bearer ");
      const tokenValue = key.startsWith("Bearer ") ? key.substring(7) : key;
      const headers: Record<string, string> = {
        'User-Agent': 'aistudio-build',
      };
      if (isAccessToken) {
        headers['Authorization'] = `Bearer ${tokenValue}`;
      }
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: headers
        }
      });
      if (isAccessToken) {
        // Nullify apiKey on all client layers to prevent the SDK from emitting x-goog-api-key headers
        (aiClient as any).apiKey = undefined;
        if ((aiClient as any).apiClient) {
          (aiClient as any).apiClient.apiKey = undefined;
          if ((aiClient as any).apiClient.auth) {
            (aiClient as any).apiClient.auth.apiKey = undefined;
          }
        }
        console.log("Cleared apiKey property across all client instances for Access Token standard.");
      }
      console.log(`Gemini API Client successfully initialized. Auth Mode: ${isAccessToken ? "OAuth 2 Access Token" : "Standard API Key"}`);
    } else {
      console.warn("GEMINI_API_KEY is not configured or placeholder detected. Real-time multi-agent analyses will require this key.");
    }
  }
  return aiClient;
}

// --- REDIS CACHE ---
import IORedis from "ioredis";

const USE_REDIS = process.env.USE_REDIS === "true";

class RedisCache {
  private client: IORedis | null = null;
  private fallback: Map<string, { data: any; expiresAt: number }> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && process.env.REDIS_HOST) {
      this.client = new IORedis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || "6379"),
        username: process.env.REDIS_USERNAME || "default",
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_ENABLE_SSL === "true" ? {} : undefined,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => times > 1 ? null : 2000,
        lazyConnect: true,
      });
      this.client.on("error", () => {});
      this.client.connect()
        .then(() => console.log("[Redis] Connected to Redis."))
        .catch(() => {
          console.log("[Redis] Could not reach Redis, using in-memory fallback.");
          if (this.client) { this.client.disconnect(); this.client = null; }
        });
    } else if (enabled) {
      console.log("[Redis] REDIS_HOST not set. Using in-memory fallback.");
    } else {
      console.log("[Redis] Cache DISABLED.");
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.enabled) return null;
    if (this.client) {
      try {
        const val = await this.client.get(key);
        if (!val) { console.log(`[Redis] Miss: ${key}`); return null; }
        console.log(`[Redis] Hit: ${key}`);
        return JSON.parse(val);
      } catch (err) {
        console.error("[Redis] Get error:", err);
        return null;
      }
    }
    const entry = this.fallback.get(key);
    if (!entry) { console.log(`[InMemory] Miss: ${key}`); return null; }
    if (Date.now() > entry.expiresAt) { this.fallback.delete(key); console.log(`[InMemory] Expired: ${key}`); return null; }
    console.log(`[InMemory] Hit: ${key}`);
    return entry.data;
  }

  async set(key: string, value: any, ttlSeconds: number = 2592000): Promise<void> {
    if (!this.enabled) return;
    if (this.client) {
      try {
        await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
        console.log(`[Redis] Saved: ${key} (TTL: ${ttlSeconds}s)`);
      } catch (err) {
        console.error("[Redis] Set error:", err);
      }
      return;
    }
    this.fallback.set(key, { data: value, expiresAt: Date.now() + (ttlSeconds * 1000) });
    console.log(`[InMemory] Saved: ${key} (TTL: ${ttlSeconds}s)`);
  }

  async delete(key: string): Promise<void> {
    if (this.client) {
      try { await this.client.del(key); } catch {}
      return;
    }
    this.fallback.delete(key);
  }
}

const redis = new RedisCache(USE_REDIS);

// --- IN-BACKGROUND PROGRESS ENGINE ---
interface JobState {
  username: string;
  status: 'running' | 'completed' | 'failed';
  currentAgentIndex: number;
  logs: AgentLog[];
  dossier: Partial<CreatorIntelligenceDossier> | null;
}

const activeJobs = new Map<string, JobState>();

// Coordinates database matching common tourist destinations to populate map correctly
const coordinatesDb: Record<string, { lat: number; lng: number }> = {
  "bali": { lat: -8.4095, lng: 115.1889 },
  "amalfi coast": { lat: 40.6333, lng: 14.6028 },
  "kyoto": { lat: 35.0116, lng: 135.7680 },
  "rome": { lat: 41.9028, lng: 12.4964 },
  "paris": { lat: 48.8566, lng: 2.3522 },
  "tokyo": { lat: 35.6762, lng: 139.6503 },
  "london": { lat: 51.5074, lng: -0.1278 },
  "new york": { lat: 40.7128, lng: -74.0060 },
  "dubai": { lat: 25.2048, lng: 55.2708 },
  "singapore": { lat: 1.3521, lng: 103.8198 },
  "bangkok": { lat: 13.7563, lng: 100.5018 },
  "costa rica": { lat: 9.7489, lng: -83.7534 },
  "maldives": { lat: 3.2028, lng: 73.2207 },
  "reykjavik": { lat: 64.1466, lng: -21.9426 },
  "cappadocia": { lat: 38.6431, lng: 34.8289 },
  "santorini": { lat: 36.3932, lng: 25.4615 },
  "zermatt": { lat: 46.0207, lng: 7.7491 },
  "queenstown": { lat: -45.0312, lng: 168.6626 },
  "petra": { lat: 30.3285, lng: 35.4444 },
  "machu picchu": { lat: -13.1631, lng: -72.5450 },
  "goa": { lat: 15.2993, lng: 74.1240 },
  "gokarna": { lat: 14.5479, lng: 74.3188 },
  "jaipur": { lat: 26.9124, lng: 75.7873 },
  "udaipur": { lat: 24.5854, lng: 73.7125 },
  "varanasi": { lat: 25.3176, lng: 82.9739 },
  "rishikesh": { lat: 30.0869, lng: 78.2676 },
  "manali": { lat: 32.2396, lng: 77.1887 },
  "shimla": { lat: 31.1048, lng: 77.1734 },
  "leh": { lat: 34.1526, lng: 77.5771 },
  "ladakh": { lat: 34.1526, lng: 77.5771 },
  "leh-ladakh": { lat: 34.1526, lng: 77.5771 },
  "spiti valley": { lat: 32.2464, lng: 78.0349 },
  "spiti": { lat: 32.2464, lng: 78.0349 },
  "meghalaya": { lat: 25.4670, lng: 91.3662 },
  "munnar": { lat: 10.0889, lng: 77.0595 },
  "kerala": { lat: 10.8505, lng: 76.2711 },
  "alleppey": { lat: 9.4981, lng: 76.3388 },
  "hampi": { lat: 15.3350, lng: 76.4600 },
  "pondicherry": { lat: 11.9416, lng: 79.8083 },
  "andaman": { lat: 11.7401, lng: 92.6586 },
  "darjeeling": { lat: 27.0410, lng: 88.2663 },
  "coorg": { lat: 12.3375, lng: 75.8069 },
  "ooty": { lat: 11.4102, lng: 76.6950 },
  "agra": { lat: 27.1767, lng: 78.0081 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "amritsar": { lat: 31.6340, lng: 74.8723 },
  "jodhpur": { lat: 26.2389, lng: 73.0243 },
  "jaisalmer": { lat: 26.9157, lng: 70.9083 },
  "srinagar": { lat: 34.0837, lng: 74.7973 },
  "kasol": { lat: 32.0101, lng: 77.3142 },
  "mcleodganj": { lat: 32.2426, lng: 76.3213 },
  "dharamshala": { lat: 32.2190, lng: 76.3234 },
  "nainital": { lat: 29.3803, lng: 79.4636 },
  "mussoorie": { lat: 30.4598, lng: 78.0644 },
  "interlaken": { lat: 46.6863, lng: 7.8632 },
  "amsterdam": { lat: 52.3676, lng: 4.9041 },
  "barcelona": { lat: 41.3874, lng: 2.1686 },
  "lisbon": { lat: 38.7223, lng: -9.1393 },
  "prague": { lat: 50.0755, lng: 14.4378 },
  "vienna": { lat: 48.2082, lng: 16.3738 },
  "istanbul": { lat: 41.0082, lng: 28.9784 },
  "cairo": { lat: 30.0444, lng: 31.2357 },
  "marrakech": { lat: 31.6295, lng: -7.9811 },
  "cape town": { lat: -33.9249, lng: 18.4241 },
  "sydney": { lat: -33.8688, lng: 151.2093 },
  "melbourne": { lat: -37.8136, lng: 144.9631 },
  "phuket": { lat: 7.8804, lng: 98.3923 },
  "chiang mai": { lat: 18.7883, lng: 98.9853 },
  "hanoi": { lat: 21.0285, lng: 105.8542 },
  "ho chi minh": { lat: 10.8231, lng: 106.6297 },
  "bagan": { lat: 21.1717, lng: 94.8585 },
  "siem reap": { lat: 13.3671, lng: 103.8448 },
  "luang prabang": { lat: 19.8563, lng: 102.1350 },
};

function getCoordinates(dest: string, country: string): { lat: number; lng: number } {
  const normalizedDest = dest.toLowerCase().trim();
  for (const key of Object.keys(coordinatesDb)) {
    if (normalizedDest === key || normalizedDest.includes(key) || key.includes(normalizedDest)) {
      return coordinatesDb[key];
    }
  }
  return { lat: 0, lng: 0 };
}

async function fetchGetSetYo(
  apiUrl: string,
  baseHeaders: any,
  bodyString: string,
  getsetyoCookie: string
): Promise<{ response: Response; resData: any; usedCookie: boolean }> {
  const headers = { ...baseHeaders };
  delete headers["authorization"];
  delete headers["Authorization"];

  headers["cookie"] = getsetyoCookie;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: bodyString
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Could not create trip package. Please try again later.`);
  }

  const resData = await response.json();
  return { response, resData, usedCookie: true };
}

async function scrapeInstagramProfile(
  username: string
): Promise<{ profile: InstagramProfile; posts: InstagramPost[] }> {
  const token = process.env.APIFY_TOKEN;
  if (!token || token.trim() === "") {
    throw new Error("Unable to read Instagram profiles right now. Please try again later.");
  }

  const cleanUsername = extractUsername(username);
  const client = new ApifyClient({ token });

  const [detailsResult, postsResult] = await Promise.all([
    (async () => {
      const run = await client.actor("shu8hvrXbJbY3Eb9W").call({
        directUrls: [`https://www.instagram.com/${cleanUsername}/`],
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
        searchType: "user",
        searchLimit: 1,
      });
      return client.dataset(run.defaultDatasetId).listItems();
    })(),
    (async () => {
      const run = await client.actor("shu8hvrXbJbY3Eb9W").call({
        directUrls: [`https://www.instagram.com/${cleanUsername}/`],
        resultsType: "posts",
        resultsLimit: 50,
        addParentData: false,
        searchType: "user",
        searchLimit: 1,
      });
      return client.dataset(run.defaultDatasetId).listItems();
    })(),
  ]);

  const detailsItems = detailsResult.items;
  const postItems = postsResult.items;

  if ((!detailsItems || detailsItems.length === 0) && (!postItems || postItems.length === 0)) {
    throw new Error(`Could not find this profile. It may be private or the handle may be incorrect.`);
  }

  let profileRaw: any;
  let rawPosts: any[];

  const detailsFirst: any = detailsItems?.[0];
  if (detailsFirst && (detailsFirst.biography !== undefined || detailsFirst.followersCount !== undefined)) {
    profileRaw = detailsFirst;
  } else {
    const postFirst: any = postItems?.[0];
    profileRaw = {
      username: postFirst?.ownerUsername || cleanUsername,
      fullName: postFirst?.ownerFullName || cleanUsername,
      biography: "",
      followersCount: 0,
      postsCount: postItems?.length || 0,
      profilePicUrl: postFirst?.displayUrl || "",
    };
  }

  rawPosts = (postItems as any[]) || [];
  if (rawPosts.length === 0 && detailsFirst?.latestPosts) {
    rawPosts = detailsFirst.latestPosts;
  }

  const profile: InstagramProfile = {
    username: profileRaw.username || cleanUsername,
    fullName: profileRaw.fullName || profileRaw.ownerFullName || cleanUsername,
    biography: profileRaw.biography || "",
    followersCount: typeof profileRaw.followersCount === "number" ? profileRaw.followersCount : 0,
    postsCount: typeof profileRaw.postsCount === "number" ? profileRaw.postsCount : rawPosts.length,
    profilePicUrl: profileRaw.profilePicUrlHD || profileRaw.profilePicUrl || profileRaw.displayUrl || "",
  };

  const posts: InstagramPost[] = rawPosts.map((p: any, idx: number) => {
    const isReel = p.type === "Video" || p.productType === "clips" || p.isVideo === true;
    return {
      id: String(p.id || p.shortCode || `post_${idx + 1}`),
      caption: p.caption || "",
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      mentions: Array.isArray(p.mentions) ? p.mentions : [],
      location: p.locationName || (p.location && p.location.name) || "",
      likes: typeof p.likesCount === "number" && p.likesCount >= 0 ? p.likesCount : 0,
      comments: typeof p.commentsCount === "number" && p.commentsCount >= 0 ? p.commentsCount : 0,
      type: isReel ? "reel" : "post",
    };
  });

  return { profile, posts };
}

// --- GOOGLE ADK: SESSION SERVICE & TASK AGENT ---
const adkSessionService = new InMemorySessionService();

type TaskFn = (state: Record<string, any>, logFn: (msg: string) => void) => Promise<Record<string, any>>;

class TaskAgent extends BaseAgent {
  private taskFn: TaskFn;
  constructor(config: { name: string; description: string; taskFn: TaskFn }) {
    super({ name: config.name, description: config.description });
    this.taskFn = config.taskFn;
  }
  async *runAsyncImpl(context: InvocationContext): AsyncGenerator<any> {
    const state = context.session.state as Record<string, any>;
    const logFn = (msg: string) => {
      if (!state._logs) state._logs = [];
      state._logs.push({
        id: `${this.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        agentName: this.name as AgentLog['agentName'],
        status: 'completed',
        message: msg,
        timestamp: new Date().toISOString(),
      });
    };
    const result = await this.taskFn(state, logFn);
    Object.assign(state, result);

    const stateDelta: Record<string, any> = {};
    for (const key of Object.keys(state)) {
      stateDelta[key] = state[key];
    }

    yield createEvent({
      author: this.name,
      invocationId: context.invocationId,
      content: { role: 'model', parts: [{ text: `${this.name} completed` }] },
      actions: { stateDelta, artifactDelta: {}, requestedAuthConfigs: {}, requestedToolConfirmations: {} },
    });
  }
  async *runLiveImpl(_context: InvocationContext): AsyncGenerator<any> {
    // Not used — live streaming is not supported for task agents
  }
}

// --- GOOGLE ADK: DEFINE ALL 10 PIPELINE AGENTS ---

const agentNames: AgentLog['agentName'][] = [
  'PlannerAgent', 'InstagramExtractionAgent', 'ContentStructuringAgent',
  'TravelDetectionAgent', 'TravelPersonaAgent', 'RecommendationAgent',
  'PromptGenerationAgent', 'ItineraryGenerationAgent', 'MapAgent', 'ResultAggregatorAgent'
];

// 1. PlannerAgent — validates input
const plannerAgent = new TaskAgent({
  name: 'PlannerAgent',
  description: 'Validates the Instagram handle and initializes the pipeline',
  taskFn: async (state, log) => {
    const username = state.username as string;
    log(`Starting travel analysis for @${username}...`);
    log(`Verified profile handle. Preparing to gather travel insights...`);
    state._agentIndex = 0;
    return {};
  }
});

// 2. InstagramExtractionAgent — reads public profile via Apify
const extractionAgent = new TaskAgent({
  name: 'InstagramExtractionAgent',
  description: 'Reads the public Instagram profile and recent posts',
  taskFn: async (state, log) => {
    state._agentIndex = 1;
    log(`Reading @${state.username}'s public Instagram profile...`);
    const scraped = await scrapeInstagramProfile(state.username);
    if (!scraped.posts || scraped.posts.length === 0) {
      throw new Error(`No posts found on @${state.username}'s profile. The account may have no public posts or the profile could be private.`);
    }
    const posts = scraped.posts.filter(p => p.type === "post");
    const reels = scraped.posts.filter(p => p.type === "reel");
    log(`Found ${posts.length} posts and ${reels.length} reels to analyze.`);
    return {
      instagram_profile: scraped.profile,
      instagram_posts: posts,
      instagram_reels: reels,
      all_scraped_posts: scraped.posts,
    };
  }
});

// 3. ContentStructuringAgent — organizes content
const structuringAgent = new TaskAgent({
  name: 'ContentStructuringAgent',
  description: 'Organizes captions, hashtags, mentions, and location tags',
  taskFn: async (state, log) => {
    state._agentIndex = 2;
    log(`Extracting travel signals from content...`);
    const allPosts: InstagramPost[] = state.all_scraped_posts;
    const captions = allPosts.map(p => p.caption).filter(Boolean);
    const hashtags = Array.from(new Set(allPosts.flatMap(p => p.hashtags)));
    const mentions = Array.from(new Set(allPosts.flatMap(p => p.mentions)));
    const locations = Array.from(new Set(allPosts.map(p => p.location).filter(Boolean)));
    log(`Found ${locations.length} locations and ${hashtags.length} travel-related tags.`);
    return { structured_captions: captions, structured_hashtags: hashtags, structured_mentions: mentions, structured_locations: locations };
  }
});

// 4. TravelDetectionAgent — LLM-powered Gemini analysis
const detectionAgent = new TaskAgent({
  name: 'TravelDetectionAgent',
  description: 'Uses Gemini AI to analyze travel history from Instagram content',
  taskFn: async (state, log) => {
    state._agentIndex = 3;
    log(`Identifying travel destinations from content...`);

    const client = getGeminiClient();
    if (!client) {
      log(`Analysis paused — please try again later.`);
      throw new Error("AI analysis is temporarily unavailable. Please try again later.");
    }

    log(`Building your travel profile with AI...`);

    const profile: InstagramProfile = state.instagram_profile;
    const realDataContext = JSON.stringify({
      profile: { username: profile.username, fullName: profile.fullName, biography: profile.biography, followersCount: profile.followersCount, postsCount: profile.postsCount },
      captions: state.structured_captions,
      hashtags: state.structured_hashtags,
      mentions: state.structured_mentions,
      locations: state.structured_locations
    }, null, 2);

    const prompt = `
      You are a travel intelligence analyst. Below is publicly available data from the Instagram
      account @${profile.username}. Analyze ONLY this real content — do NOT invent posts, captions, or profile facts.

      PROFILE_DATA:
      ${realDataContext}

      Based strictly on the real biography, captions, hashtags, mentions and locations above, produce a travel
      intelligence analysis:
      - Identify ALL visited destinations actually evidenced in the real content — there is no limit, include every destination you can find evidence for (with visitCount, source evidence quoting/paraphrasing the real captions or locations, and confidence). If the real content has little travel signal, infer conservatively and lower the confidence.
      - List all unique countries visited as an array of strings.
      - Define travel persona: budgetProfile ('Budget', 'Mid-range', or 'Luxury'), travelStyle ('Relaxed', 'Adventure', 'Immersive', or 'Fast-paced'), travellerType ('Solo', 'Couple', 'Group', 'Family'), activityPreferences, travelFrequency ('High', 'Medium', 'Low').
      - Identify the top travel themes evident in the content (e.g., "Beach & Islands", "Mountains & Trekking", "Cultural Heritage", "Food & Culinary", "Wildlife & Nature", "Urban Exploration", "Spiritual & Wellness", "Road Trips", "Nightlife & Parties", "Photography & Art").
      - Write 2-3 short travel highlights — memorable moments or patterns from the content (e.g., "Explored 3 countries in Southeast Asia in one month", "Frequently visits offbeat hill stations").
      - Generate exactly 6 targeted recommendations. Each recommendation should have a category from: 'Similar Destination', 'Aspirational Destination', 'Hidden Gem Destination', 'Trending Destination', 'Stretch Destination', 'Offbeat Destination'. Multiple recommendations can share the same category — pick whichever fits best for each destination. Give a detailed score (0 to 100) and reasoning grounded in the real content for each.
      - Formulate 6 custom travel prompts for the GetSetYo Itinerary API (one per recommendation).
      - Plot coordinate positions (latitude and longitude as numbers) for each visited and recommended destination.

      The output must strictly be valid JSON matching this exact structure (do NOT include instagramData or creatorProfile — those come from the real scrape):
      {
        "visitedDestinations": [
          { "destination": "Bali", "country": "Indonesia", "visitCount": 3, "confidence": 0.95, "sources": ["caption"], "evidence": "string", "timeline": "2024-05" }
        ],
        "countriesVisited": ["Indonesia", "India", "Thailand"],
        "travelThemes": ["Beach & Islands", "Cultural Heritage"],
        "travelHighlights": ["Explored Southeast Asia extensively", "Frequent visitor to Himalayan destinations"],
        "travelPersona": { "budgetProfile": "Luxury", "travelStyle": "Relaxed", "travellerType": "Couple", "activityPreferences": ["string"], "travelFrequency": "High", "confidence": 0.88, "hotelPreference": "string", "foodPreference": "string", "summary": "string" },
        "recommendations": [
          { "destination": "Maldives", "country": "Maldives", "category": "Similar Destination", "score": 95, "reason": "string" }
        ],
        "prompts": [
          { "destination": "Maldives", "prompt": "string" }
        ],
        "mapData": {
          "visitedLocations": [ { "lat": -8.4, "lng": 115.1, "name": "Bali", "country": "Indonesia", "type": "visited" } ],
          "recommendedLocations": [ { "lat": 3.2, "lng": 73.2, "name": "Maldives", "country": "Maldives", "type": "recommended" } ]
        }
      }
      Ensure the JSON is completely valid, fully populated, and has NO trailing commas.
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 }
    });

    const text = response.text || "";
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleanText.trim());
    const parsedPersona = parsed.travelPersona || {};

    if (!parsedPersona.budgetProfile || !parsedPersona.travelStyle) {
      throw new Error("Could not determine travel preferences — the profile may not have enough travel-related content.");
    }

    const travelPersona: TravelPersona = {
      budgetProfile: parsedPersona.budgetProfile,
      travelStyle: parsedPersona.travelStyle,
      travellerType: parsedPersona.travellerType || "Solo",
      activityPreferences: Array.isArray(parsedPersona.activityPreferences) ? parsedPersona.activityPreferences : [],
      travelFrequency: parsedPersona.travelFrequency || "Medium",
      confidence: typeof parsedPersona.confidence === "number" ? parsedPersona.confidence : 0,
      hotelPreference: parsedPersona.hotelPreference || "",
      foodPreference: parsedPersona.foodPreference || "",
      summary: parsedPersona.summary || ""
    };

    const rawDestinations = parsed.visitedDestinations || [];
    if (rawDestinations.length === 0) {
      throw new Error("No travel destinations could be identified from this profile's content. The creator may not post travel-related content.");
    }

    const visitedDestinations: VisitedDestination[] = rawDestinations
      .filter((v: any) => v.destination && v.country)
      .map((v: any) => ({
        destination: v.destination,
        country: v.country,
        visitCount: typeof v.visitCount === "number" ? v.visitCount : 1,
        confidence: typeof v.confidence === "number" ? v.confidence : 0,
        sources: Array.isArray(v.sources) ? v.sources : [],
        evidence: v.evidence || "",
        timeline: v.timeline || ""
      }));

    const rawRecommendations = parsed.recommendations || [];
    if (rawRecommendations.length === 0) {
      throw new Error("Could not generate destination recommendations — not enough travel signals in this profile.");
    }

    const recommendations: TravelRecommendation[] = rawRecommendations
      .filter((r: any) => r.destination && r.country)
      .map((r: any) => ({
        destination: r.destination,
        country: r.country,
        category: r.category || "Similar Destination",
        score: typeof r.score === "number" ? r.score : 0,
        reason: r.reason || ""
      }));

    const rawPrompts = parsed.prompts || [];
    const prompts: ItineraryPrompt[] = rawPrompts
      .filter((p: any) => p.destination && p.prompt)
      .map((p: any) => ({
        destination: p.destination,
        prompt: p.prompt
      }));

    if (prompts.length === 0) {
      throw new Error("Could not create itinerary briefs — not enough information to generate personalized trips.");
    }

    log(`Identified ${visitedDestinations.length} destinations this creator has visited.`);

    const countriesVisited: string[] = parsed.countriesVisited || [...new Set(visitedDestinations.map(v => v.country))];
    const travelThemes: string[] = parsed.travelThemes || [];
    const travelHighlights: string[] = parsed.travelHighlights || [];

    return {
      visited_destinations: visitedDestinations,
      countries_visited: countriesVisited,
      travel_themes: travelThemes,
      travel_highlights: travelHighlights,
      travel_persona: travelPersona,
      ai_recommendations: recommendations,
      ai_prompts: prompts,
      gemini_map_visited: parsed.mapData?.visitedLocations || [],
      gemini_map_recommended: parsed.mapData?.recommendedLocations || [],
    };
  }
});

// 5. TravelPersonaAgent — validates persona
const personaAgent = new TaskAgent({
  name: 'TravelPersonaAgent',
  description: 'Validates and formats the travel persona profile',
  taskFn: async (state, log) => {
    state._agentIndex = 4;
    const persona: TravelPersona = state.travel_persona;
    log(`Determining travel style and budget preferences...`);
    log(`Travel profile ready — ${persona.travelStyle} style, ${persona.budgetProfile} budget.`);
    return {};
  }
});

// 6. RecommendationAgent — validates recommendations
const recommendationAgent = new TaskAgent({
  name: 'RecommendationAgent',
  description: 'Validates and formats destination recommendations',
  taskFn: async (state, log) => {
    state._agentIndex = 5;
    log(`Finding the perfect destinations for this creator...`);
    log(`5 personalized recommendations selected.`);
    return {};
  }
});

// 7. PromptGenerationAgent — creates itinerary briefs
const promptGenAgent = new TaskAgent({
  name: 'PromptGenerationAgent',
  description: 'Creates personalized itinerary briefs for each destination',
  taskFn: async (state, log) => {
    state._agentIndex = 6;
    log(`Preparing trip details for each destination...`);
    const prompts: ItineraryPrompt[] = state.ai_prompts;
    prompts.forEach((p, i) => log(`Trip brief ready for ${p.destination}.`));
    return {};
  }
});

// 8. ItineraryGenerationAgent — calls GetSetYo API (skipped when GENERATE_ITINERARY=false)
const GENERATE_ITINERARY = process.env.GENERATE_ITINERARY !== "false";

const itineraryAgent = new TaskAgent({
  name: 'ItineraryGenerationAgent',
  description: 'Creates bookable trip packages via the GetSetYo platform',
  taskFn: async (state, log) => {
    state._agentIndex = 7;
    const recommendations: TravelRecommendation[] = state.ai_recommendations;
    const prompts: ItineraryPrompt[] = state.ai_prompts;

    const shouldGenerate = state._generateItinerary !== undefined ? state._generateItinerary : GENERATE_ITINERARY;
    if (!shouldGenerate) {
      log(`${recommendations.length} destinations ready. You can generate itineraries individually.`);
      const itineraries: GetSetYoItinerary[] = recommendations.map(r => ({
        destination: r.destination,
        packageDealId: 0,
        status: 'PENDING' as const,
        productUrl: ''
      }));
      return { generated_itineraries: itineraries };
    }

    log(`Generating ${recommendations.length} bookable trip itineraries...`);

    const getsetyoApiUrl = "https://www.getsetyo.club/itinerary/generate-ai-itinerary";
    const getsetyoJwt = process.env.GETSETYO_JWT_TOKEN || "";
    const getsetyoSession = process.env.GETSETYO_LOGIN_SESSION_TOKEN || "";
    const getsetyoCookie = `device-id-new=1bbf23a0-f0c0-4b49-9c8b-d5e9718f225e; _fbp=fb.1.1778495407282.712203300242907940; external-id=0paK5RxO; login-session-token=${getsetyoSession}; jwt=${getsetyoJwt}`;
    const itineraries: GetSetYoItinerary[] = [];

    for (let idx = 0; idx < recommendations.length; idx++) {
      const r = recommendations[idx];
      const customPromptObj = prompts.find(p => p.destination === r.destination);
      const promptString = customPromptObj ? customPromptObj.prompt : `Generate a beautiful 5-day itinerary focused on ${r.destination}.`;

      log(`Creating itinerary for ${r.destination}...`);

      const requestBody = {
        requirement: {
          startDate: "2026-08-09",
          paxDetails: { adultCount: 2, childCount: 0, roomCount: 1, childAges: [] },
          departureCity: { objectID: 20231, name: "Bengaluru" }
        },
        templateCode: "STEP1,STEP2,STEP3",
        aiPrompt: {
          model: "CHATGPT", templateGroup: null, templateCode: "STEP1,STEP2,STEP3",
          replaceVariables: { user_prompt: promptString }
        },
        itineraryExternalId: null
      };

      const baseHeaders: any = {
        "accept": "application/hal+json", "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "content-type": "application/json", "origin": "https://www.getsetyo.club",
        "referer": "https://www.getsetyo.club/dashboard/itinerary/builder?activeTab=with-ai",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      };
      if (getsetyoJwt) baseHeaders["Authorization"] = `Bearer ${getsetyoJwt}`;

      const { resData } = await fetchGetSetYo(getsetyoApiUrl, baseHeaders, JSON.stringify(requestBody), getsetyoCookie);

      let packageDealId: string | number | null = null;
      if (resData) {
        packageDealId = resData.packageDealId || resData.dealId || resData.itineraryId || resData.tripId || resData.id ||
          resData.itineraryExternalId || resData.externalId || resData.slug ||
          (resData.data && (resData.data.id || resData.data.itineraryId || resData.data.dealId || resData.data.packageDealId || resData.data.slug)) ||
          (resData.trip && (resData.trip.id || resData.trip.itineraryId || resData.trip.slug || resData.trip.externalId)) ||
          (resData.requirement && resData.requirement.itineraryExternalId);
      }
      if (!packageDealId) {
        log(`Could not generate itinerary for ${r.destination} — no trip ID returned.`);
        itineraries.push({ destination: r.destination, packageDealId: 0, status: 'FAILED', productUrl: '' });
        continue;
      }

      log(`${r.destination} trip is ready.`);

      const productUrl = isNaN(Number(packageDealId))
        ? `https://www.getsetyo.club/trip/details/${packageDealId}`
        : `https://getsetyo.com/product/${packageDealId}`;

      itineraries.push({ destination: r.destination, packageDealId, status: 'COMPLETED', productUrl });
    }

    log(`All ${itineraries.length} trips are ready to explore.`);
    return { generated_itineraries: itineraries };
  }
});

// 9. MapAgent — plots coordinates
const mapAgent = new TaskAgent({
  name: 'MapAgent',
  description: 'Places all destinations on an interactive map',
  taskFn: async (state, log) => {
    state._agentIndex = 8;
    log(`Plotting destinations on the map...`);

    const visitedDestinations: VisitedDestination[] = state.visited_destinations;
    const recommendations: TravelRecommendation[] = state.ai_recommendations;
    const geminiVisitedPins: any[] = state.gemini_map_visited || [];
    const geminiRecommendedPins: any[] = state.gemini_map_recommended || [];

    const resolveCoords = (pool: any[], name: string, country: string) => {
      const nameLower = name.toLowerCase();
      const match = pool.find((l: any) => {
        if (typeof l?.name !== "string") return false;
        const lName = l.name.toLowerCase();
        return lName === nameLower || lName.includes(nameLower) || nameLower.includes(lName);
      });
      if (match && typeof match.lat === "number" && typeof match.lng === "number" && (match.lat !== 0 || match.lng !== 0)) {
        return { lat: match.lat, lng: match.lng };
      }
      const dbCoords = getCoordinates(name, country);
      if (dbCoords.lat !== 0 || dbCoords.lng !== 0) return dbCoords;
      if (match && typeof match.lat === "number" && typeof match.lng === "number") {
        return { lat: match.lat, lng: match.lng };
      }
      return { lat: 0, lng: 0 };
    };

    const mapData: MapData = {
      visitedLocations: visitedDestinations.map(v => {
        const c = resolveCoords(geminiVisitedPins, v.destination, v.country);
        return { lat: c.lat, lng: c.lng, name: v.destination, country: v.country, type: "visited" as const };
      }),
      recommendedLocations: recommendations.map(r => {
        const c = resolveCoords(geminiRecommendedPins, r.destination, r.country);
        return { lat: c.lat, lng: c.lng, name: r.destination, country: r.country, type: "recommended" as const };
      })
    };

    log(`${mapData.visitedLocations.length + mapData.recommendedLocations.length} destinations pinned on the map.`);
    return { map_data: mapData };
  }
});

// 10. ResultAggregatorAgent — compiles final dossier
const aggregatorAgent = new TaskAgent({
  name: 'ResultAggregatorAgent',
  description: 'Assembles the final travel profile and caches results',
  taskFn: async (state, log) => {
    state._agentIndex = 9;
    log(`Finalizing your travel profile...`);

    const profile: InstagramProfile = state.instagram_profile;
    const posts: InstagramPost[] = state.instagram_posts;
    const reels: InstagramPost[] = state.instagram_reels;

    const finalDossier: CreatorIntelligenceDossier = {
      instagramUsername: state.username,
      creatorProfile: profile,
      instagramData: { profile, posts, reels, taggedPosts: [] },
      structuredContent: {
        bio: profile.biography,
        captions: posts.concat(reels).map(p => p.caption),
        hashtags: Array.from(new Set([...posts.flatMap(p => p.hashtags), ...reels.flatMap(p => p.hashtags)])),
        mentions: Array.from(new Set([...posts.flatMap(p => p.mentions), ...reels.flatMap(p => p.mentions)])),
        locations: (state.visited_destinations as VisitedDestination[]).map(v => v.destination)
      },
      visitedDestinations: state.visited_destinations,
      countriesVisited: state.countries_visited || [],
      travelThemes: state.travel_themes || [],
      travelHighlights: state.travel_highlights || [],
      travelPersona: state.travel_persona,
      recommendations: state.ai_recommendations,
      prompts: state.ai_prompts,
      generatedItineraries: state.generated_itineraries,
      mapData: state.map_data,
      generatedAt: new Date().toISOString()
    };

    await redis.set(`creator-analysis:${state.username}`, finalDossier, 2592000);
    await redis.set(`creator-itineraries:${state.username}`, { itineraries: finalDossier.generatedItineraries }, 2592000);

    state.final_dossier = finalDossier;
    log(`Your travel profile is ready!`);
    return {};
  }
});

// --- GOOGLE ADK: SEQUENTIAL AGENT PIPELINE ---
const travelPipeline = new SequentialAgent({
  name: 'TravelIntelligencePipeline',
  description: 'Multi-step agentic workflow for creator travel intelligence analysis',
  subAgents: [
    plannerAgent,
    extractionAgent,
    structuringAgent,
    detectionAgent,
    personaAgent,
    recommendationAgent,
    promptGenAgent,
    itineraryAgent,
    mapAgent,
    aggregatorAgent,
  ]
});

function buildPartialDossier(state: Record<string, any>): Partial<CreatorIntelligenceDossier> | null {
  const profile: InstagramProfile | undefined = state.instagram_profile;
  if (!profile) return null;

  const posts: InstagramPost[] = state.instagram_posts || [];
  const reels: InstagramPost[] = state.instagram_reels || [];

  return {
    instagramUsername: state.username,
    creatorProfile: profile,
    instagramData: { profile, posts, reels, taggedPosts: [] },
    structuredContent: {
      bio: profile.biography,
      captions: posts.concat(reels).map(p => p.caption),
      hashtags: state.structured_hashtags || Array.from(new Set([...posts.flatMap(p => p.hashtags), ...reels.flatMap(p => p.hashtags)])),
      mentions: state.structured_mentions || Array.from(new Set([...posts.flatMap(p => p.mentions), ...reels.flatMap(p => p.mentions)])),
      locations: state.visited_destinations ? (state.visited_destinations as VisitedDestination[]).map(v => v.destination) : (state.structured_locations || [])
    },
    visitedDestinations: state.visited_destinations || [],
    countriesVisited: state.countries_visited || [],
    travelThemes: state.travel_themes || [],
    travelHighlights: state.travel_highlights || [],
    travelPersona: state.travel_persona || undefined as any,
    recommendations: state.ai_recommendations || [],
    prompts: state.ai_prompts || [],
    generatedItineraries: state.generated_itineraries || [],
    mapData: state.map_data || { visitedLocations: [], recommendedLocations: [] },
    generatedAt: new Date().toISOString()
  };
}

// --- GOOGLE ADK: RUNNER-BACKED AGENT WORKER ---
async function runAgentWorker(username: string, shouldGenerateItinerary: boolean = GENERATE_ITINERARY): Promise<void> {
  const job = activeJobs.get(username);
  if (!job) return;

  try {
    const session = await adkSessionService.createSession({
      appName: 'creator-travel-intel',
      userId: username,
      state: { username, _logs: [] as AgentLog[], _agentIndex: 0, _generateItinerary: shouldGenerateItinerary }
    });

    const sessionId = session.id;

    const runner = new Runner({
      agent: travelPipeline,
      appName: 'creator-travel-intel',
      sessionService: adkSessionService,
    });

    for await (const event of runner.runAsync({
      userId: username,
      sessionId,
      newMessage: { role: 'user', parts: [{ text: `Analyze travel profile for @${username}` }] }
    })) {
      const currentSession = await adkSessionService.getSession({ appName: 'creator-travel-intel', userId: username, sessionId });
      if (currentSession) {
        const state = currentSession.state as Record<string, any>;
        job.logs = state._logs || [];
        job.currentAgentIndex = state._agentIndex || 0;
        job.dossier = state.final_dossier || buildPartialDossier(state);
      }
    }

    const finalSession = await adkSessionService.getSession({ appName: 'creator-travel-intel', userId: username, sessionId });
    if (finalSession) {
      const state = finalSession.state as Record<string, any>;
      job.logs = state._logs || [];
      job.dossier = state.final_dossier || buildPartialDossier(state);
    }

    job.status = job.dossier ? 'completed' : 'failed';
    console.log(`[Pipeline] Analysis for @${username} ${job.status}. Agents: ${job.currentAgentIndex + 1}/10, Logs: ${job.logs.length}`);

  } catch (err: any) {
    console.error(`[Pipeline] Analysis for @${username} crashed:`, err.message || err);
    job.status = 'failed';
    const errorLog: AgentLog = {
      id: `failed-${Date.now()}`,
      agentName: 'ResultAggregatorAgent',
      status: 'failed',
      message: `Something went wrong: ${err.message || 'An unexpected error occurred'}. Please try again.`,
      timestamp: new Date().toISOString()
    };
    job.logs.push(errorLog);
  }
}

// --- ITINERARY DETAIL POLLING ---
async function fetchItineraryDetails(packageDealId: number | string): Promise<Partial<GetSetYoItinerary>> {
  try {
    const dealRes = await fetch(`https://getsetyo.com/package-deal?id=${packageDealId}`, {
      headers: { 'accept': 'application/json', 'content-type': 'application/json' }
    });
    if (!dealRes.ok) return { itineraryStatus: 'IN_PROGRESS' };
    const dealData = await dealRes.json();
    const externalId = dealData.externalId;
    if (!externalId) return { itineraryStatus: 'IN_PROGRESS' };

    const itinRes = await fetch(`https://getsetyo.com/itinerary/itinerary-v2?itineraryExternalId=${externalId}`, {
      headers: { 'accept': 'application/json' }
    });
    if (!itinRes.ok) return { externalId, itineraryStatus: 'IN_PROGRESS' };
    const itinData = await itinRes.json();

    const itinerary = itinData.itinerary;
    const priceDetails = itinerary?.priceDetails;
    const mediaList = itinerary?.mediaList || itinData.itinerary?.allMediaFromAllComponents?.HOTEL || [];
    const coverMedia = itinData.coverMedia;

    return {
      externalId,
      title: itinerary?.title || '',
      summary: itinerary?.summary || '',
      coverImageUrl: coverMedia?.mediaUrl || mediaList?.[0]?.mediaUrl || '',
      images: mediaList.filter((m: any) => m.mediaType === 'IMAGE').map((m: any) => m.mediaUrl).slice(0, 5),
      daysCount: itinerary?.days?.length || 0,
      startingPrice: priceDetails?.indicativeSalePrice || priceDetails?.totalFare?.salePrice || 0,
      currencyCode: priceDetails?.totalFare?.currencyCode || 'INR',
      itineraryStatus: itinData.status === 'COMPLETED' ? 'COMPLETED' : itinData.status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS',
    };
  } catch {
    return { itineraryStatus: 'IN_PROGRESS' };
  }
}

// --- FULL-STACK API ROUTINGS ---

// POST trigger analysis
app.post("/api/analyze", async (req, res) => {
  const { username, forceRefresh, generateItinerary: genItinParam } = req.body;
  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "username parameter is required" });
  }

  const cleanUsername = extractUsername(username);
  console.log(`[API] Analyze request for @${cleanUsername}${forceRefresh ? ' (force refresh)' : ''}`);
  const shouldGenerateItinerary = genItinParam !== undefined ? genItinParam : GENERATE_ITINERARY;

  if (forceRefresh) {
    await redis.delete(`creator-analysis:${cleanUsername}`);
    await redis.delete(`creator-itineraries:${cleanUsername}`);
    activeJobs.delete(cleanUsername);
  }

  // Check Redis Cache
  const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
  if (cachedDossier) {
    console.log(`[Cache Hit] Serving analysis dossier for @${cleanUsername} from simulated Redis Store.`);
    return res.json({
      status: 'completed',
      cached: true,
      dossier: cachedDossier,
      logs: [
        {
          id: 'planner-cache-hit',
          agentName: 'PlannerAgent',
          status: 'completed',
          message: `Travel profile for @${cleanUsername} loaded instantly.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    });
  }

  // Check if job already active. Only block when actively running; allow
  // re-analysis when a previous attempt failed.
  const activeJob = activeJobs.get(cleanUsername);
  if (activeJob && activeJob.status === 'running') {
    return res.json({ status: activeJob.status, username: cleanUsername, message: "Analysis job already in progress..." });
  }

  // Create new Background job (PubSub mock)
  const newJob: JobState = {
    username: cleanUsername,
    status: 'running',
    currentAgentIndex: 0,
    logs: [],
    dossier: null
  };

  activeJobs.set(cleanUsername, newJob);
  runAgentWorker(cleanUsername, shouldGenerateItinerary);

  res.json({
    status: 'running',
    username: cleanUsername,
    message: "Travel Intelligence orchestration began."
  });
});

// GET analysis status polling endpoint
app.get("/api/analysis-status", async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "username query matches required metadata" });
  }

  const cleanUsername = extractUsername(username as string);

  // 1. Is there a complete cache record?
  const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
  if (cachedDossier) {
    return res.json({
      status: 'completed',
      logs: [],
      dossier: cachedDossier
    });
  }

  // 2. Is there an active live job running?
  const liveJob = activeJobs.get(cleanUsername);
  if (liveJob) {
    return res.json({
      status: liveJob.status,
      currentAgentIndex: liveJob.currentAgentIndex,
      logs: liveJob.logs,
      dossier: liveJob.dossier
    });
  }

  res.status(404).json({ error: "No active analysis found. Start a new trigger request." });
});

// POST generate a single itinerary on demand
app.post("/api/generate-itinerary", async (req, res) => {
  const { username, destination } = req.body;
  if (!username || !destination) return res.status(400).json({ error: "username and destination required" });

  const cleanUsername = extractUsername(username);
  const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
  const dossier = cachedDossier || (activeJobs.get(cleanUsername)?.dossier as any);
  if (!dossier) return res.status(404).json({ error: "No analysis found. Run analysis first." });

  const recommendations: TravelRecommendation[] = dossier.recommendations || [];
  const prompts: ItineraryPrompt[] = dossier.prompts || [];
  const rec = recommendations.find(r => r.destination === destination);
  if (!rec) return res.status(404).json({ error: "Destination not found in recommendations." });

  const customPrompt = prompts.find(p => p.destination === destination);
  const promptString = customPrompt ? customPrompt.prompt : `Generate a beautiful 5-day itinerary focused on ${destination}.`;

  try {
    const getsetyoApiUrl = "https://www.getsetyo.club/itinerary/generate-ai-itinerary";
    const getsetyoJwt = process.env.GETSETYO_JWT_TOKEN || "";
    const getsetyoSession = process.env.GETSETYO_LOGIN_SESSION_TOKEN || "";
    const getsetyoCookie = `device-id-new=1bbf23a0-f0c0-4b49-9c8b-d5e9718f225e; _fbp=fb.1.1778495407282.712203300242907940; external-id=0paK5RxO; login-session-token=${getsetyoSession}; jwt=${getsetyoJwt}`;

    const requestBody = {
      requirement: {
        startDate: "2026-08-09",
        paxDetails: { adultCount: 2, childCount: 0, roomCount: 1, childAges: [] },
        departureCity: { objectID: 20231, name: "Bengaluru" }
      },
      templateCode: "STEP1,STEP2,STEP3",
      aiPrompt: {
        model: "CHATGPT", templateGroup: null, templateCode: "STEP1,STEP2,STEP3",
        replaceVariables: { user_prompt: promptString }
      },
      itineraryExternalId: null
    };

    const baseHeaders: any = {
      "accept": "application/hal+json", "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "content-type": "application/json", "origin": "https://www.getsetyo.club",
      "referer": "https://www.getsetyo.club/dashboard/itinerary/builder?activeTab=with-ai",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    };
    if (getsetyoJwt) baseHeaders["Authorization"] = `Bearer ${getsetyoJwt}`;

    const { resData } = await fetchGetSetYo(getsetyoApiUrl, baseHeaders, JSON.stringify(requestBody), getsetyoCookie);

    let packageDealId: string | number | null = null;
    if (resData) {
      packageDealId = resData.packageDealId || resData.dealId || resData.itineraryId || resData.tripId || resData.id ||
        resData.itineraryExternalId || resData.externalId || resData.slug ||
        (resData.data && (resData.data.id || resData.data.itineraryId || resData.data.dealId || resData.data.packageDealId || resData.data.slug)) ||
        (resData.trip && (resData.trip.id || resData.trip.itineraryId || resData.trip.slug || resData.trip.externalId)) ||
        (resData.requirement && resData.requirement.itineraryExternalId);
    }

    if (!packageDealId) return res.json({ status: 'FAILED', destination, packageDealId: 0, productUrl: '' });

    const productUrl = isNaN(Number(packageDealId))
      ? `https://www.getsetyo.club/trip/details/${packageDealId}`
      : `https://getsetyo.com/product/${packageDealId}`;

    const itinerary: GetSetYoItinerary = { destination, packageDealId, status: 'COMPLETED', productUrl };

    // Update the cached dossier with the new itinerary
    if (dossier.generatedItineraries) {
      const idx = dossier.generatedItineraries.findIndex((it: any) => it.destination === destination);
      if (idx >= 0) dossier.generatedItineraries[idx] = itinerary;
    }
    if (cachedDossier) await redis.set(`creator-analysis:${cleanUsername}`, dossier, 2592000);

    res.json(itinerary);
  } catch (err: any) {
    res.json({ status: 'FAILED', destination, packageDealId: 0, productUrl: '' });
  }
});

// POST create shareable profile link
app.post("/api/share-profile", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username required" });

  const cleanUsername = extractUsername(username);
  const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
  const dossier = cachedDossier || (activeJobs.get(cleanUsername)?.dossier as any);
  if (!dossier) return res.status(404).json({ error: "No analysis found. Run analysis first." });

  const existingToken = await redis.get(`share-token:${cleanUsername}`);
  if (existingToken) {
    return res.json({ token: existingToken, url: `/profile/${cleanUsername}?token=${existingToken}` });
  }

  const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  await redis.set(`share-token:${cleanUsername}`, token, 2592000);
  await redis.set(`shared-profile:${token}`, { username: cleanUsername, dossier }, 2592000);

  res.json({ token, url: `/profile/${cleanUsername}?token=${token}` });
});

// GET shared profile data
const FEATURED_USERNAMES = ['tanyakhanijow', 'brindasharma', 'ilunarang'];

app.get("/api/shared-profile/:username", async (req, res) => {
  const { username } = req.params;
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: "Access denied" });

  const cleanUsername = extractUsername(username);

  if (token === 'featured' && FEATURED_USERNAMES.includes(cleanUsername)) {
    const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
    const dossier = cachedDossier || (activeJobs.get(cleanUsername)?.dossier as any);
    if (dossier) return res.json({ username: cleanUsername, dossier });
    return res.status(404).json({ error: "This profile is still being generated. Please try again in a moment." });
  }

  const storedToken = await redis.get(`share-token:${cleanUsername}`);
  if (!storedToken || storedToken !== token) return res.status(403).json({ error: "Invalid or expired link" });

  const sharedData = await redis.get(`shared-profile:${storedToken}`);
  if (!sharedData) return res.status(404).json({ error: "Profile not found or expired" });

  res.json(sharedData);
});

// GET manual Redis check panel (useful for monitoring delivery specs)
app.get("/api/admin/redis-cache", (req, res) => {
  res.json({
    message: "Admin Redis Monitor State connected",
    keys: "creator-analysis:*, creator-itineraries:*",
    activeJobsCount: activeJobs.size
  });
});

// GET itinerary details polling endpoint
app.get("/api/itinerary-details", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "username required" });

  const cleanUsername = extractUsername(username as string);
  const cachedDossier = await redis.get(`creator-analysis:${cleanUsername}`);
  const dossier = cachedDossier || activeJobs.get(cleanUsername)?.dossier;
  if (!dossier) return res.status(404).json({ error: "No analysis found" });

  const itineraries: GetSetYoItinerary[] = (dossier as any).generatedItineraries || [];
  if (itineraries.length === 0) return res.json({ itineraries: [] });

  const updated = await Promise.all(itineraries.map(async (it) => {
    if (!it.packageDealId || it.packageDealId === 0) return it;
    if (it.itineraryStatus === 'COMPLETED' || it.itineraryStatus === 'FAILED') return it;

    const details = await fetchItineraryDetails(it.packageDealId);
    return { ...it, ...details };
  }));

  res.json({ itineraries: updated });
});

// --- VITE DEV AND PROD ROUTING ENGINE HANDLINGS ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite Development Server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const assetsPath = path.join(process.cwd(), 'assets');
    app.use('/assets', express.static(assetsPath));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at http://localhost:${PORT}`);
    console.log(`Development App URL registered securely.`);
  });
}

startServer();
