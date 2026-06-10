export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  postsCount: number;
  profilePicUrl: string;
}

export interface InstagramPost {
  id: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  location: string;
  likes: number;
  comments: number;
  type: 'post' | 'reel' | 'tagged';
}

export interface InstagramData {
  profile: InstagramProfile;
  posts: InstagramPost[];
  reels: InstagramPost[];
  taggedPosts: InstagramPost[];
}

export interface StructuredContent {
  bio: string;
  captions: string[];
  hashtags: string[];
  mentions: string[];
  locations: string[];
}

export interface VisitedDestination {
  destination: string;
  country: string;
  visitCount: number;
  confidence: number;
  sources: string[];
  evidence: string;
  timeline: string;
}

export interface TravelPersona {
  budgetProfile: 'Budget' | 'Mid-range' | 'Luxury';
  travelStyle: 'Relaxed' | 'Adventure' | 'Immersive' | 'Fast-paced';
  travellerType: 'Solo' | 'Couple' | 'Group' | 'Family';
  activityPreferences: string[];
  travelFrequency: 'High' | 'Medium' | 'Low';
  confidence: number;
  hotelPreference: string;
  foodPreference: string;
  summary: string;
}

export interface TravelRecommendation {
  destination: string;
  country: string;
  category: 'Similar Destination' | 'Aspirational Destination' | 'Hidden Gem Destination' | 'Trending Destination' | 'Stretch Destination';
  score: number;
  reason: string;
}

export interface ItineraryPrompt {
  destination: string;
  prompt: string;
}

export interface GetSetYoItinerary {
  destination: string;
  packageDealId: number | string;
  status: 'PENDING' | 'GENERATING' | 'POLLED' | 'COMPLETED' | 'FAILED';
  productUrl: string;
  externalId?: string;
  title?: string;
  summary?: string;
  coverImageUrl?: string;
  images?: string[];
  daysCount?: number;
  startingPrice?: number;
  currencyCode?: string;
  itineraryStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface MapCoordinates {
  lat: number;
  lng: number;
  name: string;
  country: string;
  type: 'visited' | 'recommended';
}

export interface MapData {
  visitedLocations: MapCoordinates[];
  recommendedLocations: MapCoordinates[];
}

// Complete Dossier Compiled by Result Aggregator Agent
export interface CreatorIntelligenceDossier {
  instagramUsername: string;
  creatorProfile: InstagramProfile;
  instagramData: InstagramData;
  structuredContent: StructuredContent;
  visitedDestinations: VisitedDestination[];
  countriesVisited: string[];
  travelThemes: string[];
  travelHighlights: string[];
  travelPersona: TravelPersona;
  recommendations: TravelRecommendation[];
  prompts: ItineraryPrompt[];
  generatedItineraries: GetSetYoItinerary[];
  mapData: MapData;
  generatedAt: string;
}

export interface AgentLog {
  id: string;
  agentName: 'PlannerAgent' | 'InstagramExtractionAgent' | 'ContentStructuringAgent' | 'TravelDetectionAgent' | 'TravelPersonaAgent' | 'RecommendationAgent' | 'PromptGenerationAgent' | 'ItineraryGenerationAgent' | 'MapAgent' | 'ResultAggregatorAgent';
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  output?: any;
}
