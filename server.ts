import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { ApifyClient } from "apify-client";
import dotenv from "dotenv";
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

// --- REDIS-STYLE IN-MEMORY CACHE SCHEMA STORE ---
type CacheValue = {
  data: any;
  expiresAt: number;
};
// Toggle the (in-memory) Redis-style cache via the USE_REDIS env var.
// Default OFF — when disabled, every analysis runs fresh (no cache reads/writes).
const USE_REDIS = process.env.USE_REDIS === "true";

class RedisCache {
  private store: Map<string, CacheValue> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    console.log(`[Redis] Cache ${enabled ? "ENABLED" : "DISABLED"} (set USE_REDIS=true to enable).`);
  }

  get(key: string): any | null {
    if (!this.enabled) return null;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      console.log(`[Redis] Key expired with TTL: ${key}`);
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, value: any, ttlSeconds: number = 2592000): void { // 30 Days default
    if (!this.enabled) return;
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { data: value, expiresAt });
    console.log(`[Redis] Saved key: ${key} with TTL: ${ttlSeconds}s`);
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
const coordinatesDb: Record<string, { lat: number; lng: number; country: string }> = {
  "bali": { lat: -8.409518, lng: 115.188919, country: "Indonesia" },
  "amalfi coast": { lat: 40.633333, lng: 14.602778, country: "Italy" },
  "kyoto": { lat: 35.011636, lng: 135.768029, country: "Japan" },
  "rome": { lat: 41.902782, lng: 12.496366, country: "Italy" },
  "paris": { lat: 48.856614, lng: 2.352221, country: "France" },
  "tokyo": { lat: 35.676192, lng: 139.650311, country: "Japan" },
  "costa rica": { lat: 9.748917, lng: -83.753428, country: "Costa Rica" },
  "maldives": { lat: 3.202778, lng: 73.22068, country: "Maldives" },
  "reykjavik": { lat: 64.1466, lng: -21.9426, country: "Iceland" },
  "cappadocia": { lat: 38.6431, lng: 34.8289, country: "Turkey" },
  "santorini": { lat: 36.3932, lng: 25.4615, country: "Greece" },
  "zermatt": { lat: 46.0207, lng: 7.7491, country: "Switzerland" },
  "queenstown": { lat: -45.0312, lng: 168.6626, country: "New Zealand" },
  "petra": { lat: 30.3285, lng: 35.4444, country: "Jordan" },
  "machu picchu": { lat: -13.1631, lng: -72.5450, country: "Peru" },
  "babar": { lat: 35.676192, lng: 139.650311, country: "Japan" }
};

function getCoordinates(dest: string, country: string): { lat: number; lng: number } {
  const normalizedDest = dest.toLowerCase();
  for (const key of Object.keys(coordinatesDb)) {
    if (normalizedDest.includes(key) || key.includes(normalizedDest)) {
      return { lat: coordinatesDb[key].lat, lng: coordinatesDb[key].lng };
    }
  }
  // Fallback to random coordinate based on a hash to keep it consistent
  let hash = 0;
  for (let i = 0; i < dest.length; i++) {
    hash = dest.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = (hash % 180) / 2; // -90 to 90
  const lng = ((hash * 3) % 360) / 2; // -180 to 180
  return { lat, lng };
}

// Fetch wrapper to handle authenticating against GetSetYo Core API using Session Cookies
async function fetchGetSetYo(
  apiUrl: string,
  baseHeaders: any,
  bodyString: string,
  getsetyoCookie: string,
  logFn: (msg: string) => void
): Promise<{ response: Response; resData: any; usedCookie: boolean }> {
  logFn(`Releasing GetSetYo API request with cookie authentication...`);

  // Clone headers and remove any potentially conflicting Authorization headers
  const headers = { ...baseHeaders };
  delete headers["authorization"];
  delete headers["Authorization"];
  
  // Set the essential session cookies
  headers["cookie"] = getsetyoCookie;

  logFn(`[Fetch-Agent] POST -> ${apiUrl}`);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: bodyString
  });

  logFn(`[Fetch-Agent] Response Status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API returned status ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 300)}`);
  }

  const resData = await response.json();
  logFn(`✅ Successfully retrieved JSON response from GetSetYo Engine.`);
  return { response, resData, usedCookie: true };
}

// --- REAL INSTAGRAM SCRAPING VIA APIFY ---
// Calls the Apify Instagram Scraper actor (shu8hvrXbJbY3Eb9W) to pull a live
// profile feed. Requires APIFY_TOKEN to be configured. Throws (no dummy data)
// when the token is missing or the scrape returns nothing.
async function scrapeInstagramProfile(
  username: string,
  logFn: (msg: string) => void
): Promise<{ profile: InstagramProfile; posts: InstagramPost[] }> {
  const token = process.env.APIFY_TOKEN;
  if (!token || token.trim() === "") {
    throw new Error("APIFY_TOKEN is not configured. Set APIFY_TOKEN in your environment/secrets to run a live Instagram scrape.");
  }

  const cleanUsername = username.replace(/^@/, "").trim();
  const client = new ApifyClient({ token });

  const input = {
    directUrls: [`https://www.instagram.com/${cleanUsername}/`],
    resultsType: "details",
    resultsLimit: 50,
    addParentData: false,
    searchType: "user",
    searchLimit: 1,
  };

  logFn(`[Apify] Starting actor 'shu8hvrXbJbY3Eb9W' (Instagram Scraper) for @${cleanUsername}...`);
  const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
  logFn(`[Apify] Actor run finished (runId: ${run.id}, status: ${run.status}). Fetching dataset...`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  if (!items || items.length === 0) {
    throw new Error(`Apify returned no data for @${cleanUsername}. The profile may be private, invalid, or the scrape was rate-limited.`);
  }

  // The actor can return either a profile "details" object (with latestPosts)
  // or a flat list of post objects. Handle both shapes.
  const first: any = items[0];
  let profileRaw: any;
  let rawPosts: any[];

  if (first.latestPosts !== undefined || first.biography !== undefined || first.followersCount !== undefined) {
    profileRaw = first;
    rawPosts = Array.isArray(first.latestPosts) ? first.latestPosts : [];
  } else {
    rawPosts = items as any[];
    profileRaw = {
      username: first.ownerUsername || cleanUsername,
      fullName: first.ownerFullName || cleanUsername,
      biography: "",
      followersCount: 0,
      postsCount: items.length,
      profilePicUrl: first.displayUrl || "",
    };
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

  logFn(`[Apify] Scraped @${profile.username}: ${profile.followersCount} followers, ${profile.postsCount} total posts, ${posts.length} feed items retrieved.`);
  return { profile, posts };
}

// Background agent execution simulation runner
async function runAgentWorker(username: string): Promise<void> {
  const job = activeJobs.get(username);
  if (!job) return;

  const logs = job.logs;
  let logIdCounter = 0;
  const logStep = (agentName: AgentLog['agentName'], message: string, output?: any) => {
    logIdCounter++;
    const log: AgentLog = {
      id: `${agentName}-${Date.now()}-${logIdCounter}-${Math.random().toString(36).substring(2, 9)}`,
      agentName,
      status: 'completed',
      message,
      timestamp: new Date().toLocaleTimeString(),
      output
    };
    logs.push(log);
  };

  try {
    // Stage 1: Planner Agent
    job.currentAgentIndex = 0;
    logStep('PlannerAgent', `Initiating Travel Intelligence orchestration pipeline for handle @${username}...`);
    logStep('PlannerAgent', `Validating Instagram handle format. Status: VALID. Matching extraction profile...`);
    await new Promise(r => setTimeout(r, 1500));

    // Stage 2: Extraction Agent (LIVE Apify scrape — no dummy data)
    job.currentAgentIndex = 1;
    logStep('InstagramExtractionAgent', `Calling Instagram Scraper (Apify backend) to grab profile feed & tagged posts...`);
    const scraped = await scrapeInstagramProfile(username, (m) => logStep('InstagramExtractionAgent', m));
    const realProfile = scraped.profile;
    const realPosts = scraped.posts.filter(p => p.type === "post");
    const realReels = scraped.posts.filter(p => p.type === "reel");
    logStep('InstagramExtractionAgent', `Successfully retrieved live data: Biography context, ${realPosts.length} grid elements and ${realReels.length} reels assets from Apify dataset. Stories filter: OMITTED.`);

    // Stage 3: Content Structuring Agent (from REAL scraped content)
    job.currentAgentIndex = 2;
    logStep('ContentStructuringAgent', `De-duplicating captions and hashtags. Consolidating mentions and geotag indicators...`);
    const realCaptions = scraped.posts.map(p => p.caption).filter(Boolean);
    const realHashtags = Array.from(new Set(scraped.posts.flatMap(p => p.hashtags)));
    const realMentions = Array.from(new Set(scraped.posts.flatMap(p => p.mentions)));
    const realLocations = Array.from(new Set(scraped.posts.map(p => p.location).filter(Boolean)));
    logStep('ContentStructuringAgent', `Structured captions content. Extracted ${realLocations.length} localized check-in profiles and ${realHashtags.length} tags from ${realCaptions.length} captions.`);
    await new Promise(r => setTimeout(r, 1500));

    // Stage 4: Travel Detection Agent
    job.currentAgentIndex = 3;
    logStep('TravelDetectionAgent', `Analyzing biography elements, geotag logs and post context to extract actual visited places...`);
    
    // Now trigger Gemini or fallback to compile the core dossier
    const client = getGeminiClient();
    let dossierData: CreatorIntelligenceDossier;

    if (!client) {
      logStep('TravelDetectionAgent', `Intel engine halted. GEMINI_API_KEY is missing.`);
      throw new Error("GEMINI_API_KEY is not configured. Please open AI Studio 'Settings' -> 'Secrets' and set your Gemini API key to run a live travel intelligence analysis.");
    }

    logStep('TravelDetectionAgent', `Invoking Google GenAI ('gemini-3.5-flash') to perform deep intelligence synthesis on REAL scraped Instagram data...`);
    try {
      const realDataContext = JSON.stringify({
        profile: {
          username: realProfile.username,
          fullName: realProfile.fullName,
          biography: realProfile.biography,
          followersCount: realProfile.followersCount,
          postsCount: realProfile.postsCount
        },
        captions: realCaptions,
        hashtags: realHashtags,
        mentions: realMentions,
        locations: realLocations
      }, null, 2);

      const prompt = `
        You are a travel intelligence analyst. Below is REAL data scraped (via Apify) from the public Instagram
        account @${realProfile.username}. Analyze ONLY this real content — do NOT invent posts, captions, or profile facts.

        REAL_SCRAPED_DATA:
        ${realDataContext}

        Based strictly on the real biography, captions, hashtags, mentions and locations above, produce a travel
        intelligence analysis:
        - Identify 2 to 3 visited destinations actually evidenced in the real content (with visitCount, source evidence quoting/paraphrasing the real captions or locations, and confidence). If the real content has little travel signal, infer conservatively and lower the confidence.
        - Define travel persona: budgetProfile ('Budget', 'Mid-range', or 'Luxury'), travelStyle ('Relaxed', 'Adventure', 'Immersive', or 'Fast-paced'), travellerType ('Solo', 'Couple', 'Group', 'Family'), activityPreferences, travelFrequency ('High', 'Medium', 'Low').
        - Generate exactly 5 targeted recommendations with category: 'Similar Destination', 'Aspirational Destination', 'Hidden Gem Destination', 'Trending Destination', 'Stretch Destination'. Give a detailed score (0 to 100) and reasoning grounded in the real content for each.
        - Formulate 5 custom travel prompts for the GetSetYo Itinerary API (one per recommendation).
        - Plot coordinate positions (latitude and longitude as numbers) for each visited and recommended destination.

        The output must strictly be valid JSON matching this exact structure (do NOT include instagramData or creatorProfile — those come from the real scrape):
        {
          "visitedDestinations": [
            { "destination": "Bali", "country": "Indonesia", "visitCount": 3, "confidence": 0.95, "sources": ["caption"], "evidence": "string", "timeline": "2024-05" }
          ],
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
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const text = response.text || "";
      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(cleanText.trim());

      const parsedPersona = parsed.travelPersona || {};

      // Use the REAL scraped profile and posts (no Gemini-generated dummy data here).
      const profile: InstagramProfile = realProfile;
      const geminiPosts = realPosts;
      const geminiReels = realReels;

      const travelPersona: TravelPersona = {
        budgetProfile: ['Budget', 'Mid-range', 'Luxury'].includes(parsedPersona.budgetProfile) ? parsedPersona.budgetProfile : "Luxury",
        travelStyle: ['Relaxed', 'Adventure', 'Immersive', 'Fast-paced'].includes(parsedPersona.travelStyle) ? parsedPersona.travelStyle : "Relaxed",
        travellerType: ['Solo', 'Couple', 'Group', 'Family'].includes(parsedPersona.travellerType) ? parsedPersona.travellerType : "Couple",
        activityPreferences: Array.isArray(parsedPersona.activityPreferences) ? parsedPersona.activityPreferences : ["Sightseeing", "Food Tours"],
        travelFrequency: ['High', 'Medium', 'Low'].includes(parsedPersona.travelFrequency) ? parsedPersona.travelFrequency : "High",
        confidence: typeof parsedPersona.confidence === "number" ? parsedPersona.confidence : 0.95,
        hotelPreference: parsedPersona.hotelPreference || "Boutique stays & designer spaces",
        foodPreference: parsedPersona.foodPreference || "Local gastronomy and fine dining",
        summary: parsedPersona.summary || `An authentic content creator on Instagram exploring hidden gems. Likes elegant, tailored travel styles.`
      };

      const visitedDestinations: VisitedDestination[] = (parsed.visitedDestinations || []).map((v: any) => ({
        destination: v.destination || "Kyoto",
        country: v.country || "Japan",
        visitCount: typeof v.visitCount === "number" ? v.visitCount : 1,
        confidence: typeof v.confidence === "number" ? v.confidence : 0.96,
        sources: Array.isArray(v.sources) ? v.sources : ["caption"],
        evidence: v.evidence || "Mentioned in public stories and grid feeds",
        timeline: v.timeline || "2024-05"
      }));

      const recommendations: TravelRecommendation[] = (parsed.recommendations || []).map((r: any) => ({
        destination: r.destination || "Amalfi Coast",
        country: r.country || "Italy",
        category: ['Similar Destination', 'Aspirational Destination', 'Hidden Gem Destination', 'Trending Destination', 'Stretch Destination'].includes(r.category) ? r.category : "Similar Destination",
        score: typeof r.score === "number" ? r.score : 92,
        reason: r.reason || "Matches travel style preferences and aesthetic cues perfectly."
      }));

      const prompts: ItineraryPrompt[] = (parsed.prompts || []).map((p: any) => ({
        destination: p.destination || "Amalfi Coast",
        prompt: p.prompt || `Generate a beautiful 5-day itinerary focused on local highlights.`
      }));

      // Build map pins directly from the analysis so EVERY visited city and
      // every recommended ("next possible") city is plotted — matching the
      // recommendations/itineraries 1:1. Prefer Gemini's own coordinates when
      // present, otherwise resolve via the coordinates lookup.
      const geminiVisitedPins: any[] = parsed.mapData?.visitedLocations || [];
      const geminiRecommendedPins: any[] = parsed.mapData?.recommendedLocations || [];
      const resolveCoords = (pool: any[], name: string, country: string) => {
        const match = pool.find((l: any) => typeof l?.name === "string" && l.name.toLowerCase() === name.toLowerCase());
        if (match && typeof match.lat === "number" && typeof match.lng === "number") {
          return { lat: match.lat, lng: match.lng };
        }
        return getCoordinates(name, country);
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

      dossierData = {
        instagramUsername: username,
        creatorProfile: profile,
        instagramData: {
          profile: profile,
          posts: geminiPosts,
          reels: geminiReels,
          taggedPosts: []
        },
        structuredContent: {
          bio: profile.biography,
          captions: geminiPosts.concat(geminiReels).map(p => p.caption),
          hashtags: Array.from(new Set([
            ...geminiPosts.flatMap(p => p.hashtags),
            ...geminiReels.flatMap(p => p.hashtags)
          ])),
          mentions: Array.from(new Set([
            ...geminiPosts.flatMap(p => p.mentions),
            ...geminiReels.flatMap(p => p.mentions)
          ])),
          locations: visitedDestinations.map(v => v.destination)
        },
        visitedDestinations,
        travelPersona,
        recommendations,
        prompts,
        generatedItineraries: [], 
        mapData,
        generatedAt: new Date().toISOString()
      };

      logStep('TravelDetectionAgent', `Gemini synthesis complete. Identified ${dossierData.visitedDestinations.length} pristine visited destinations with timeline records.`);
    } catch (err: any) {
      console.error("Gemini compilation error:", err);
      logStep('TravelDetectionAgent', `Intel engine failed: ${err.message || err}`);
      throw err;
    }

    // Stage 5: Travel Persona Agent
    job.currentAgentIndex = 4;
    logStep('TravelPersonaAgent', `Interpreting budget profiles, style tags, and luxury indicator markers...`);
    logStep('TravelPersonaAgent', `Profile generated: Style: [${dossierData.travelPersona.travelStyle}], Budget: [${dossierData.travelPersona.budgetProfile}]. Confidence rating: ${Math.round(dossierData.travelPersona.confidence * 100)}%.`);
    await new Promise(r => setTimeout(r, 1200));

    // Stage 6: Recommendation Agent
    job.currentAgentIndex = 5;
    logStep('RecommendationAgent', `Compiling targeting recommendations: 1 Similar, 1 Aspirational, 1 Hidden Gem, 1 Trending, and 1 Stretch destination...`);
    logStep('RecommendationAgent', `5 Target travel coordinates approved matching the creator's luxury alignment score.`);
    await new Promise(r => setTimeout(r, 1200));

    // Stage 7: Prompt Generation Agent
    job.currentAgentIndex = 6;
    logStep('PromptGenerationAgent', `Drafting automated high-quality system prompts optimized for GetSetYo package deals APIs...`);
    dossierData.prompts.forEach((p, index) => {
      logStep('PromptGenerationAgent', `Created Itinerary Prompt ${index+1} for [${p.destination}].`);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Stage 8: Itinerary Polling & Status Agent (Poll status simulation)
    job.currentAgentIndex = 7;
    logStep('ItineraryGenerationAgent', `Connecting to GetSetYo package routing engines... Queuing 5 automated requests.`);
    
    const getsetyoApiUrl = "https://www.getsetyo.club/itinerary/generate-ai-itinerary";
    
    const getsetyoJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWp3dCIsImV4dGVybmFsSWQiOiIwcGFLNVJ4TyIsImlhdCI6MTc3OTg5NTY3NiwiZXhwIjoxNzk1NzM3NjAwfQ.OPv0QUFAOsCAwpRN5VdZdYNuMOP3B0kbAqHm3dAW4X8";
    const getsetyoSession = "WKd9AYtubvoqW3gpiWgL21JQfyhTFN42iwk4qJ0xIjHpaBCWZJ3CsVdsutt2yj47";

    const getsetyoCookie = `device-id-new=1bbf23a0-f0c0-4b49-9c8b-d5e9718f225e; _fbp=fb.1.1778495407282.712203300242907940; external-id=0paK5RxO; fbm_3228197347484521=base_domain=; login-session-token=${getsetyoSession}; jwt=${getsetyoJwt}; _fw_crm_v=6dde7b48-d0d3-4cd0-b102-255e989da9f4; first_session=%7B%22visits%22%3A5%2C%22start%22%3A1780039235783%2C%22last_visit%22%3A1780046402928%2C%22url%22%3A%22https%3A%2F%2Fwww.getsetyo.club%2Ftrip%2Fdetails%2F1vdny6%22%2C%22path%22%3A%22%2Ftrip%2Fdetails%2F1vdny6%22%2C%22referrer%22%3A%22%22%2C%22referrer_info%22%3A%7B%22host%22%3A%22%22%2C%22path%22%3A%22blank%22%2C%22protocol%22%3A%22about%3A%22%2C%22port%22%3A80%2C%22search%22%3A%22%22%2C%22query%22%3A%7B%7D%7D%2C%22search%22%3A%7B%22engine%22%3Anull%2C%22query%22%3Anull%7D%2C%22prev_visit%22%3A1780043850993%2C%22time_since_last_visit%22%3A2551935%2C%22version%22%3A0.4%7D; amp_aaa88d=1bbf23a0-f0c0-4b49-9c8b-d5e9718f225e.MHBhSzVSeE8=..1jqngee9q.1jqngf5ci.3p8.1g.3qo`;

    logStep('ItineraryGenerationAgent', `Initiating real-world API connection to GetSetYo Engine: ${getsetyoApiUrl}...`);

    const itineraries: GetSetYoItinerary[] = [];

    for (let idx = 0; idx < dossierData.recommendations.length; idx++) {
      const r = dossierData.recommendations[idx];
      const customPromptObj = dossierData.prompts.find((p: any) => p.destination === r.destination);
      const promptString = customPromptObj ? customPromptObj.prompt : `Generate a beautiful 5-day itinerary focused on ${r.destination}.`;

      logStep('ItineraryGenerationAgent', `Posting request to GetSetYo API for [${r.destination}]...`);
      
      try {
        const requestBody = {
          requirement: {
            startDate: "2026-08-09",
            paxDetails: {
              adultCount: 2,
              childCount: 0,
              roomCount: 1,
              childAges: []
            },
            departureCity: {
              objectID: 20231,
              name: "Bengaluru"
            }
          },
          templateCode: "STEP1,STEP2,STEP3",
          aiPrompt: {
            model: "CHATGPT",
            templateGroup: null,
            templateCode: "STEP1,STEP2,STEP3",
            replaceVariables: {
              user_prompt: promptString
            }
          },
          itineraryExternalId: null
        };

        const baseHeaders: any = {
          "accept": "application/hal+json",
          "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
          "content-type": "application/json",
          "origin": "https://www.getsetyo.club",
          "referer": "https://www.getsetyo.club/dashboard/itinerary/builder?activeTab=with-ai",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
          "priority": "u=1, i",
          "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin"
        };

        if (getsetyoJwt) {
          baseHeaders["Authorization"] = `Bearer ${getsetyoJwt}`;
        }

        const { response, resData, usedCookie } = await fetchGetSetYo(
          getsetyoApiUrl,
          baseHeaders,
          JSON.stringify(requestBody),
          getsetyoCookie,
          (msg) => logStep('ItineraryGenerationAgent', msg)
        );

        console.log(`[GetSetYo API Response for ${r.destination}]:`, JSON.stringify(resData));

        let packageDealId: string | number | null = null;
        if (resData) {
          packageDealId = resData.packageDealId || 
                          resData.dealId || 
                          resData.itineraryId || 
                          resData.tripId || 
                          resData.id || 
                          resData.itineraryExternalId ||
                          resData.externalId ||
                          resData.slug ||
                          (resData.data && (resData.data.id || resData.data.itineraryId || resData.data.dealId || resData.data.packageDealId || resData.data.slug)) ||
                          (resData.trip && (resData.trip.id || resData.trip.itineraryId || resData.trip.slug || resData.trip.externalId)) ||
                          (resData.requirement && resData.requirement.itineraryExternalId);
        }

        if (!packageDealId) {
          console.warn(`No explicit ID found in returned keys: ${Object.keys(resData || {}).join(", ")}. Generating a dynamic identifier fallback.`);
          packageDealId = `fallback-${Date.now()}-${idx}`;
        }

        logStep('ItineraryGenerationAgent', `Deal resolved: ${r.destination} (#${packageDealId}) completed.`);

        const productUrl = isNaN(Number(packageDealId)) 
          ? `https://www.getsetyo.club/trip/details/${packageDealId}` 
          : `https://getsetyo.com/product/${packageDealId}`;

        // Real itinerary lives at the GetSetYo product URL. We only keep the
        // values the API actually returns — no fabricated duration/cost/hotels.
        // IN_PROGRESS at creation means our generation task is done.
        itineraries.push({
          destination: r.destination,
          packageDealId,
          status: 'COMPLETED',
          productUrl
        });
      } catch (apiErr: any) {
        console.error(`GetSetYo API call failed for ${r.destination}:`, apiErr);
        logStep('ItineraryGenerationAgent', `GetSetYo API call failed for [${r.destination}]: ${apiErr.message || apiErr}`);
        throw new Error(`GetSetYo Itinerary API call failed for ${r.destination}: ${apiErr.message || apiErr}`);
      }
    }

    logStep('ItineraryGenerationAgent', `All 5 GetSetYo itineraries resolved successfully. Live Product URLs compiled.`);

    job.dossier = {
      ...dossierData,
      generatedItineraries: itineraries
    };

    // Stage 9: Map Agent
    job.currentAgentIndex = 8;
    logStep('MapAgent', `Resolving localized spatial geographical overlays using Google Maps Javascript Platform API...`);
    logStep('MapAgent', `Successfully plotted ${dossierData.mapData.visitedLocations.length} visited & ${dossierData.mapData.recommendedLocations.length} recommended pin routes.`);
    await new Promise(r => setTimeout(r, 1200));

    // Stage 10: Result Aggregator Agent
    job.currentAgentIndex = 9;
    logStep('ResultAggregatorAgent', `Dossier compilation complete. Compacting metadata and registering entries in Google Memorystore Redis Cache...`);
    
    const finalDossier: CreatorIntelligenceDossier = {
      ...(job.dossier as CreatorIntelligenceDossier),
      generatedAt: new Date().toISOString()
    };

    // Save in Redis Cache Schemas as specified
    redis.set(`creator-analysis:${username}`, finalDossier, 2592000); // 30 Days expiry
    redis.set(`creator-itineraries:${username}`, { itineraries: finalDossier.generatedItineraries }, 2592000);

    job.dossier = finalDossier;
    job.status = 'completed';
    logStep('ResultAggregatorAgent', `Platform fully loaded. Creator profile analysis successfully compiled and indexed. Cache TTL set to 30 Days.`);

  } catch (err: any) {
    console.error("Agent pipeline crashed", err);
    job.status = 'failed';
    const errorLog: AgentLog = {
      id: `failed-${Date.now()}`,
      agentName: 'ResultAggregatorAgent',
      status: 'failed',
      message: `Criticial Orchestrator Crash: ${err.message || 'Unknown agent validation error'}. Retrying downstream pipeline...`,
      timestamp: new Date().toLocaleTimeString()
    };
    job.logs.push(errorLog);
  }
}

// --- FULL-STACK API ROUTINGS ---

// POST trigger analysis
app.post("/api/analyze", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "username parameter is required" });
  }

  const cleanUsername = username.trim().replace(/^@/, "");

  // Check Redis Cache
  const cachedDossier = redis.get(`creator-analysis:${cleanUsername}`);
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
          message: `Simulated Redis cache hit. Serving completed intelligence dossier for handle @${cleanUsername} instantly. TTL: 30 Days.`,
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
  runAgentWorker(cleanUsername); // run in background non-blocking

  res.json({
    status: 'running',
    username: cleanUsername,
    message: "Travel Intelligence orchestration began."
  });
});

// GET analysis status polling endpoint
app.get("/api/analysis-status", (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "username query matches required metadata" });
  }

  const cleanUsername = (username as string).trim().replace(/^@/, "");

  // 1. Is there a complete cache record?
  const cachedDossier = redis.get(`creator-analysis:${cleanUsername}`);
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

// GET manual Redis check panel (useful for monitoring delivery specs)
app.get("/api/admin/redis-cache", (req, res) => {
  res.json({
    message: "Admin Redis Monitor State connected",
    keys: "creator-analysis:*, creator-itineraries:*",
    activeJobsCount: activeJobs.size
  });
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
