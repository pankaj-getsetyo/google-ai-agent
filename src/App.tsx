import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Instagram, 
  Search, 
  Compass, 
  MapPin, 
  Sparkles, 
  TrendingUp, 
  Plane, 
  Globe, 
  Sliders, 
  Clock, 
  ExternalLink, 
  FileText, 
  Database, 
  Cpu, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Briefcase, 
  Map, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Award
} from "lucide-react";
import { CreatorIntelligenceDossier, AgentLog, MapCoordinates } from "./types";
import WorldMap from "./components/WorldMap";
import AgentLiveTerminal from "./components/AgentLiveTerminal";

const SHOWCASE_CREATORS = [
  { username: "tanyakhanijow", label: "🌍 Explorer", hint: "Tanya Khanijow" },
  { username: "brindasharma", label: "✈️ Travel Vlogger", hint: "Brinda Sharma" },
  { username: "ilunarang", label: "🏖️ Wanderlust", hint: "Luna Rang" },
];

const FEATURED_PROFILES = [
  { username: "tanyakhanijow", name: "Tanya Khanijow", desc: "Travel creator & storyteller" },
  { username: "brindasharma", name: "Brinda Sharma", desc: "Adventure & culture vlogger" },
  { username: "ilunarang", name: "Luna Rang", desc: "Luxury travel & lifestyle" },
];

// Internal/debug surface (Agent Trace tab, Tech Specs tab, infra telemetry,
// confidence scores, match scores, deal IDs) is hidden from end users by default.
// Enable it by setting VITE_DEBUG_MODE="true" in the environment.
const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";
const SHOW_FEATURED = import.meta.env.VITE_SHOW_FEATURED === "true";

function SharedProfile() {
  const [dossier, setDossier] = useState<CreatorIntelligenceDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[pathParts.length - 1];
    const token = new URLSearchParams(window.location.search).get('token');

    if (!username || !token) {
      setError('Invalid profile link.');
      setLoading(false);
      return;
    }

    fetch(`/api/shared-profile/${encodeURIComponent(username)}?token=${encodeURIComponent(token)}`)
      .then(res => {
        if (!res.ok) throw new Error('Invalid or expired link');
        return res.json();
      })
      .then(data => {
        setDossier(data.dossier);
        setLoading(false);
      })
      .catch(() => {
        setError('This profile link is invalid or has expired.');
        setLoading(false);
      });
  }, []);

  const allMapPins = useMemo(() => {
    if (!dossier?.mapData) return [];
    return [
      ...(dossier.mapData.visitedLocations || []),
      ...(dossier.mapData.recommendedLocations || [])
    ];
  }, [dossier]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" strokeWidth={1.5} />
          <p className="text-stone-500 text-sm">Loading travel profile...</p>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" strokeWidth={1.5} />
          <p className="text-stone-700 font-medium">{error || 'Profile not found'}</p>
          <a href="/" className="text-sm text-brand-500 hover:text-brand-600">Go to homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-stone-700 font-sans">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-lg font-medium text-stone-900">GetSetYo</a>
          <span className="text-xs text-stone-400">Travel Profile</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <h1 className="font-display text-xl sm:text-2xl font-medium text-stone-900 truncate">{dossier.creatorProfile.fullName}</h1>
          <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
            <Instagram className="w-3.5 h-3.5 text-brand-500 shrink-0" strokeWidth={1.5} />
            <span className="truncate">@{dossier.instagramUsername}</span>
            <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
            <span className="shrink-0">{dossier.creatorProfile.followersCount.toLocaleString()} followers</span>
            {dossier.creatorProfile.postsCount > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                <span className="shrink-0">{dossier.creatorProfile.postsCount.toLocaleString()} posts</span>
              </>
            )}
          </div>
          {dossier.creatorProfile.biography && (
            <p className="text-xs text-stone-500 mt-2 leading-relaxed line-clamp-2">{dossier.creatorProfile.biography}</p>
          )}
        </div>

        {/* Travel Style */}
        {dossier.travelPersona && (
          <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-display text-lg text-stone-900">Travel Style</h2>
            {dossier.travelPersona.summary && <p className="text-sm text-stone-600 leading-relaxed">{dossier.travelPersona.summary}</p>}
            <div className="flex flex-wrap gap-3 text-xs">
              {[
                { label: 'Style', value: dossier.travelPersona.travelStyle },
                { label: 'Budget', value: dossier.travelPersona.budgetProfile },
                { label: 'Travels as', value: dossier.travelPersona.travellerType },
                { label: 'Frequency', value: dossier.travelPersona.travelFrequency },
              ].filter(r => r.value).map(r => (
                <span key={r.label} className="px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-700">
                  {r.label}: <strong>{r.value}</strong>
                </span>
              ))}
            </div>
            {dossier.travelPersona.activityPreferences?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {dossier.travelPersona.activityPreferences.map(act => (
                  <span key={act} className="text-xs px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-600">{act}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Countries, Themes, Highlights */}
        {(dossier.countriesVisited?.length > 0 || dossier.travelThemes?.length > 0 || dossier.travelHighlights?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dossier.countriesVisited?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-stone-800">Countries visited</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">{dossier.countriesVisited.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dossier.countriesVisited.map(country => (
                    <span key={country} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">{country}</span>
                  ))}
                </div>
              </div>
            )}
            {dossier.travelThemes?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-stone-800">Travel themes</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dossier.travelThemes.map(theme => (
                    <span key={theme} className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-200">{theme}</span>
                  ))}
                </div>
              </div>
            )}
            {dossier.travelHighlights?.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-stone-800">Highlights</span>
                </div>
                <ul className="space-y-2">
                  {dossier.travelHighlights.map((h, i) => (
                    <li key={i} className="text-xs text-stone-600 leading-relaxed flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Places Visited */}
        {dossier.visitedDestinations?.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg text-stone-900">Places Visited</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dossier.visitedDestinations.map((v, i) => (
                <div key={`${v.destination}-${i}`} className="bg-white p-4 rounded-xl border border-stone-200">
                  <h3 className="font-medium text-stone-900">{v.destination}, {v.country}</h3>
                  {v.evidence && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{v.evidence}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Map */}
        {allMapPins.length > 0 && (
          <section>
            <WorldMap locations={allMapPins} activeLocation={null} onSelectLocation={() => {}} />
          </section>
        )}

        {/* Bucket List */}
        {dossier.recommendations?.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg text-stone-900">Bucket List</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossier.recommendations.map(rec => {
                const itinerary = (dossier.generatedItineraries || []).find(i => i.destination === rec.destination);
                const hasLink = itinerary?.productUrl && itinerary.productUrl.length > 0 && itinerary.packageDealId && itinerary.packageDealId !== 0;
                const isPending = !hasLink;
                const isGenerating = itinerary?.status === 'GENERATING';
                return (
                  <div key={rec.destination} className="bg-white p-5 rounded-xl border border-stone-200 space-y-3">
                    <span className="eyebrow text-brand-500">{rec.category.replace(' Destination', '')}</span>
                    <h3 className="font-display text-xl text-stone-900">{rec.destination}</h3>
                    <p className="text-xs text-stone-500">{rec.country}</p>
                    <p className="text-sm text-stone-600 leading-relaxed">{rec.reason}</p>
                    <div className="pt-2">
                      {hasLink ? (
                        <a href={itinerary!.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1.5">
                          View itinerary <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                        </a>
                      ) : isGenerating ? (
                        <span className="text-sm text-brand-400 font-medium flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                          Generating...
                        </span>
                      ) : (
                        <button
                          onClick={async () => {
                            setDossier(prev => {
                              if (!prev) return prev;
                              const itins = [...(prev.generatedItineraries || [])];
                              const idx = itins.findIndex(i => i.destination === rec.destination);
                              if (idx >= 0) itins[idx] = { ...itins[idx], status: 'GENERATING' };
                              return { ...prev, generatedItineraries: itins };
                            });
                            try {
                              const res = await fetch('/api/generate-itinerary', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: dossier.instagramUsername, destination: rec.destination })
                              });
                              const updated = await res.json();
                              setDossier(prev => {
                                if (!prev) return prev;
                                const itins = [...(prev.generatedItineraries || [])];
                                const idx = itins.findIndex(i => i.destination === rec.destination);
                                if (idx >= 0) itins[idx] = { ...itins[idx], ...updated };
                                return { ...prev, generatedItineraries: itins };
                              });
                            } catch {
                              setDossier(prev => {
                                if (!prev) return prev;
                                const itins = [...(prev.generatedItineraries || [])];
                                const idx = itins.findIndex(i => i.destination === rec.destination);
                                if (idx >= 0) itins[idx] = { ...itins[idx], status: 'FAILED' };
                                return { ...prev, generatedItineraries: itins };
                              });
                            }
                          }}
                          className="text-sm text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1.5 cursor-pointer"
                        >
                          View itinerary <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-stone-200 mt-12 py-6 text-center text-xs text-stone-400">
        <span className="font-display italic">GetSetYo · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default function App() {
  const isSharedProfile = window.location.pathname.startsWith('/profile/');
  if (isSharedProfile) return <SharedProfile />;

  return <MainApp />;
}

function MainApp() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [dossier, setDossier] = useState<CreatorIntelligenceDossier | null>(null);
  const [activeTab, setActiveTab] = useState<'persona' | 'history' | 'map' | 'itineraries' | 'agentSwarm' | 'architecture'>('persona');
  const [activeLocation, setActiveLocation] = useState<MapCoordinates | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number>(0);
  const [placesExpanded, setPlacesExpanded] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabBarRef = useRef<HTMLDivElement>(null);
  const isScrollingToSection = useRef(false);

  const scrollToSection = useCallback((key: string) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    isScrollingToSection.current = true;
    setActiveTab(key as typeof activeTab);
    const offset = (tabBarRef.current?.offsetHeight || 0) + 16;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => { isScrollingToSection.current = false; }, 800);
  }, []);

  useEffect(() => {
    const sectionKeys = ['persona', 'map', 'history', 'itineraries'];
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToSection.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-section');
            if (key) setActiveTab(key as typeof activeTab);
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    sectionKeys.forEach(key => {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [dossier]);

  // Poll intervals
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (status === 'running') {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/analysis-status?username=${encodeURIComponent(username)}`);
          if (res.ok) {
            const data = await res.json();

            // Sync logs only if response has them
            if (data.logs?.length) {
              setLogs(data.logs);
            }

            if (data.status === 'completed') {
              setStatus('completed');
              setDossier(data.dossier);
              setProgress(100);
              clearInterval(pollInterval!);
            } else if (data.status === 'failed') {
              setStatus('failed');
              setErrorText("Something went wrong while analyzing this profile. Please try again.");
              clearInterval(pollInterval!);
            } else {
              // Estimate visual progress based on active agent
              const agentIndex = data.currentAgentIndex || 0;
              setProgress(Math.round(((agentIndex + 1) / 10) * 100));
              if (data.dossier) {
                // Keep partial itineraries updated so user can watch status transition Live!
                setDossier(data.dossier);
              }
            }
          }
        } catch (err) {
          console.error("Error polling statuses", err);
        }
      }, 1000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [status, username]);


  const handleAnalyze = async (targetUsername: string = username, forceRefresh: boolean = false) => {
    if (!targetUsername.trim()) return;

    setErrorText(null);
    setStatus('running');
    setProgress(5);
    setLogs([]);
    setDossier(null);
    setActiveTab('persona');

    setTimeout(() => {
      const el = document.getElementById('trigger-section');
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 100);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUsername, forceRefresh })
      });

      if (!res.ok) {
        throw new Error("Could not start the analysis. Please try again.");
      }

      const data = await res.json();
      if (data.status === 'completed' && data.cached) {
        // Fast instant cache hit flow
        setLogs(data.logs);
        setDossier(data.dossier);
        setStatus('completed');
        setProgress(100);
      } else {
        // Background long poll initiated
        setStatus('running');
      }
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setErrorText("Could not connect to the server. Please check your connection and try again.");
    }
  };

  const handleShowcaseSelect = (user: string) => {
    setUsername(user);
    handleAnalyze(user);
  };

  // Pre-project combine pins
  const allMapPins = useMemo(() => {
    if (!dossier?.mapData) return [];
    return [
      ...(dossier.mapData.visitedLocations || []),
      ...(dossier.mapData.recommendedLocations || [])
    ];
  }, [dossier]);

  return (
    <div className="min-h-screen bg-canvas text-stone-700 font-sans flex flex-col relative selection:bg-brand-400/15" id="app-root">

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur-xl sticky top-0 z-50 px-5 md:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/getsetyo-logo.webp" alt="GetSetYo" className="h-8" />
          <span className="text-[11px] text-stone-400 border-l border-stone-200 pl-3">AI Travel Concierge</span>
        </div>

        <div className="flex items-center gap-5">
          {/* Live status telemetry (internal/debug only) */}
          {DEBUG_MODE && (
            <div className="flex items-center gap-2.5 text-[11px] font-mono">
              <div className="px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 flex items-center gap-2 text-stone-500">
                <Database className="w-3.5 h-3.5 text-sage-300" />
                <span>Cache: <span className="text-sage-300 font-semibold">Active</span></span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 flex items-center gap-2 text-stone-500">
                <Cpu className="w-3.5 h-3.5 text-brand-500" />
                <span>AI: <span className="text-stone-900">Active</span></span>
              </div>
            </div>
          )}
          <span className="hidden sm:flex items-center gap-2 text-[11px] text-stone-500 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
            Powered by GetSetYo
          </span>
        </div>
      </header>

      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 ${status === 'idle' ? 'justify-center min-h-[calc(100vh-80px)]' : ''}`} id="dashboard-layout">

        {/* Hero + input */}
        <section className={`flex flex-col items-center text-center gap-7 ${status === 'idle' ? 'py-0' : 'pt-8 pb-4 md:pt-14 md:pb-8'}`} id="trigger-section">
          <div className="max-w-2xl flex flex-col items-center gap-3">
            <h2 className="font-display text-3xl md:text-4xl font-light text-stone-900 leading-[1.15]">
              Turn your Instagram into your <span className="italic text-brand-500">travel profile</span> & bucket list
            </h2>
            <p className="text-sm text-stone-500">
              Enter a handle. Get travel style, visited places & personalized recommendations.
            </p>
          </div>

          {/* Featured Profiles */}
          {SHOW_FEATURED && <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-[11px] text-stone-400">Featured profiles:</span>
            {FEATURED_PROFILES.map(fp => (
              <a
                key={fp.username}
                href={`/profile/${fp.username}?token=featured`}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-stone-200 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer text-xs no-underline"
              >
                <Instagram className="w-3.5 h-3.5 text-brand-500" strokeWidth={1.5} />
                <span className="font-medium text-stone-800">{fp.name}</span>
                <span className="text-stone-400 hidden sm:inline">· {fp.desc}</span>
              </a>
            ))}
          </div>}

          {/* Input row */}
          <div className="w-full max-w-xl flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-stone-500">
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <input
                type="text"
                placeholder="username or instagram.com/username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={status === 'running'}
                className="w-full bg-white border border-stone-200 rounded-full py-3.5 pl-12 pr-4 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                id="creator-username-input"
              />
            </div>

            <button
              onClick={() => handleAnalyze()}
              disabled={status === 'running' || !username.trim()}
              className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-medium text-sm transition-all duration-300 whitespace-nowrap ${
                status === 'running'
                  ? 'bg-brand-50 text-brand-500 border border-brand-200 cursor-not-allowed'
                  : 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98] cursor-pointer'
              }`}
              id="analyze-submit-button"
            >
              {status === 'running' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Crafting ({progress}%)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  <span>Generate my profile</span>
                </>
              )}
            </button>
          </div>

          {/* Showcase Preset Triggers */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] text-stone-500 mr-1">Try an example</span>
            {SHOWCASE_CREATORS.map((c) => (
              <button
                key={c.username}
                onClick={() => handleShowcaseSelect(c.username)}
                disabled={status === 'running'}
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  username === c.username
                    ? 'bg-brand-50 border-brand-400 text-brand-600'
                    : 'bg-white border-stone-200 text-stone-500 hover:text-stone-900 hover:border-brand-300'
                }`}
              >
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {errorText && (
            <div className="w-full max-w-xl bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{errorText}</span>
              </div>
              <button
                onClick={() => handleAnalyze(username, true)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </section>

        {/* Dynamic Interactive Panel — only visible after analysis starts */}
        {status !== 'idle' && !dossier && (
          <div ref={el => { sectionRefs.current['results-top'] = el; }} className="max-w-xl mx-auto w-full space-y-3">
            {status === 'running' && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-stone-500 shrink-0">{progress}%</span>
              </div>
            )}
            <AgentLiveTerminal logs={logs} status={status} />
          </div>
        )}

        {status !== 'idle' && dossier && (
        <div ref={el => { sectionRefs.current['results-top'] = el; }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left panel: Live activity logs — sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-3">
              {status === 'running' && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs text-stone-500 shrink-0">{progress}%</span>
                </div>
              )}
              <div className="max-h-[calc(100vh-120px)] overflow-hidden">
                <AgentLiveTerminal logs={logs} status={status} />
              </div>
            </div>
          </div>

          {/* Right/Major panels: Results view */}
          <div className="lg:col-span-2 flex flex-col gap-6" id="dashboard-results-container">
            {dossier ? (
              <div className="flex flex-col gap-6 h-full">
                
                {/* Result Control Tab deck */}
                <div className="flex flex-col gap-5 animate-rise">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg sm:text-xl font-medium text-stone-900 leading-tight truncate">
                        {dossier.creatorProfile.fullName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                        <Instagram className="w-3.5 h-3.5 text-brand-500 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">@{dossier.instagramUsername}</span>
                        <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                        <span className="shrink-0">{dossier.creatorProfile.followersCount.toLocaleString()} followers</span>
                        {dossier.creatorProfile.postsCount > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                            <span className="shrink-0">{dossier.creatorProfile.postsCount.toLocaleString()} posts</span>
                          </>
                        )}
                      </div>
                      {dossier.creatorProfile.biography && (
                        <p className="text-xs text-stone-500 mt-2 leading-relaxed line-clamp-2">{dossier.creatorProfile.biography}</p>
                      )}
                    </div>
                    {status === 'completed' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/share-profile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: dossier.instagramUsername })
                              });
                              const data = await res.json();
                              if (data.url) {
                                setShareUrl(`${window.location.origin}${data.url}`);
                              }
                            } catch {}
                          }}
                          className="text-xs px-3 sm:px-4 py-2 rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="hidden sm:inline">Share profile</span>
                          <span className="sm:hidden">Share</span>
                        </button>
                        <button
                          onClick={() => handleAnalyze(dossier.instagramUsername, true)}
                          className="text-xs px-3 sm:px-4 py-2 rounded-full border border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900 hover:border-brand-400/30 transition-all cursor-pointer"
                        >
                          Regenerate
                        </button>
                      </div>
                    )}
                  </div>

                  <div ref={tabBarRef} className="flex flex-wrap gap-1 border-b border-stone-200 pb-px sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    {([
                      { key: 'persona', label: 'Travel Style' },
                      { key: 'map', label: 'Map' },
                      { key: 'history', label: 'Places Visited' },
                      { key: 'itineraries', label: `My Bucket List (${(dossier.recommendations || []).length})` },
                      ...(DEBUG_MODE ? [{ key: 'agentSwarm', label: 'Agent Trace' }, { key: 'architecture', label: 'Tech Specs' }] : [])
                    ] as { key: typeof activeTab; label: string }[]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => scrollToSection(tab.key)}
                        className={`relative text-sm px-4 py-2.5 transition-colors ${
                          activeTab === tab.key ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        {tab.label}
                        {activeTab === tab.key && (
                          <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-brand-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAB CONTENT 1: TRAVEL PERSONA */}
                <div ref={el => { sectionRefs.current['persona'] = el; }} data-section="persona" className="space-y-5" id="tab-persona">
                    {dossier.travelPersona ? (
                      <>
                        <div className="bg-white rounded-3xl border border-stone-200 p-7 flex flex-col md:flex-row gap-7">
                          <div className="flex-1 space-y-5">
                            <div>
                              <span className="eyebrow text-brand-500">Your bio</span>
                              <p className="text-stone-700 text-[15px] italic font-display font-light mt-2 leading-relaxed">
                                "{dossier.creatorProfile.biography || 'No bio available'}"
                              </p>
                            </div>

                            <div className="h-px bg-stone-200" />

                            <div>
                              <span className="eyebrow text-stone-500">Your travel style</span>
                              <p className="text-stone-700 text-sm mt-2 leading-relaxed">{dossier.travelPersona.summary || 'Analyzing travel style...'}</p>
                            </div>
                          </div>

                          <div className="w-full md:w-72 shrink-0 bg-white p-5 border border-stone-200 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
                              <Sliders className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                              <span className="text-xs font-medium text-stone-700 tracking-wide">At a glance</span>
                            </div>

                            <div className="space-y-3 text-xs">
                              {[
                                { label: 'Travel style', value: dossier.travelPersona.travelStyle },
                                { label: 'Budget', value: dossier.travelPersona.budgetProfile, accent: true },
                                { label: 'Travels as', value: dossier.travelPersona.travellerType },
                                { label: 'Frequency', value: dossier.travelPersona.travelFrequency },
                              ].filter(row => row.value).map((row) => (
                                <div key={row.label} className="flex justify-between items-center gap-3">
                                  <span className="text-stone-500">{row.label}</span>
                                  <span className={`font-medium text-right ${row.accent ? 'text-brand-500' : 'text-stone-800'}`}>
                                    {row.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {dossier.travelPersona.activityPreferences?.length > 0 && (
                            <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3">
                              <span className="eyebrow text-stone-500">Activities</span>
                              <div className="flex flex-wrap gap-2">
                                {dossier.travelPersona.activityPreferences.map((act) => (
                                  <span key={act} className="text-xs px-3 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-700">
                                    {act}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {dossier.travelPersona.foodPreference && (
                            <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3">
                              <span className="eyebrow text-stone-500">Food preference</span>
                              <p className="text-sm text-stone-700 leading-relaxed">{dossier.travelPersona.foodPreference}</p>
                            </div>
                          )}

                          {dossier.travelPersona.hotelPreference && (
                            <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3">
                              <span className="eyebrow text-stone-500">Where they stay</span>
                              <p className="text-sm text-stone-700 leading-relaxed">{dossier.travelPersona.hotelPreference}</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="bg-white rounded-3xl border border-stone-200 p-10 flex items-center justify-center">
                        <p className="text-stone-500 text-sm">Analyzing travel style — this will appear once the AI finishes reading the profile...</p>
                      </div>
                    )}
                </div>

                {/* INTERACTIVE TRAVEL MAP */}
                <div ref={el => { sectionRefs.current['map'] = el; }} data-section="map" className="h-[500px] relative" id="tab-map">
                  {allMapPins.length === 0 && status === 'running' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm px-5 py-3 rounded-full border border-stone-200 shadow-sm flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-brand-500 animate-bounce" strokeWidth={1.5} />
                        <span className="text-sm text-stone-600 font-medium">Finding locations...</span>
                      </div>
                    </div>
                  )}
                  <WorldMap
                    locations={allMapPins}
                    activeLocation={activeLocation}
                    onSelectLocation={(loc) => setActiveLocation(loc)}
                  />
                </div>

                {/* TRAVEL STATS: Countries, Themes, Highlights */}
                {(dossier.countriesVisited?.length > 0 || dossier.travelThemes?.length > 0 || dossier.travelHighlights?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Countries Visited */}
                    {dossier.countriesVisited?.length > 0 && (
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                          <span className="text-xs font-medium text-stone-800">Countries visited</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">{dossier.countriesVisited.length}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dossier.countriesVisited.map(country => (
                            <span key={country} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                              {country}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Travel Themes */}
                    {dossier.travelThemes?.length > 0 && (
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                          <span className="text-xs font-medium text-stone-800">Travel themes</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dossier.travelThemes.map(theme => (
                            <span key={theme} className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-200">
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Travel Highlights */}
                    {dossier.travelHighlights?.length > 0 && (
                      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
                          <span className="text-xs font-medium text-stone-800">Highlights</span>
                        </div>
                        <ul className="space-y-2">
                          {dossier.travelHighlights.map((h, i) => (
                            <li key={i} className="text-xs text-stone-600 leading-relaxed flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT 2: VISITED DESTINATIONS TIMELINE */}
                <div ref={el => { sectionRefs.current['history'] = el; }} data-section="history" className="space-y-5" id="tab-history">
                    <div className="flex items-baseline justify-between">
                      <h4 className="font-display text-xl font-light text-stone-900">Places you've been</h4>
                      <span className="text-xs text-stone-500">{dossier.visitedDestinations.length} destination(s)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(placesExpanded ? dossier.visitedDestinations : dossier.visitedDestinations.slice(0, 5)).map((v, i) => (
                        <div key={`${v.destination}-${i}`} className="group bg-white p-5 rounded-2xl border border-stone-200 flex flex-col md:flex-row items-start justify-between gap-4 hover:border-brand-300 transition-colors">
                          <div className="space-y-2.5 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-400/10 border border-brand-400/25 text-brand-500 shrink-0">
                                <Compass className="w-4 h-4" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h5 className="text-sm font-semibold text-stone-900">{v.destination}</h5>
                                <p className="text-xs text-stone-500">{v.country} · visited {v.visitCount}×</p>
                              </div>
                            </div>

                            <p className="text-xs text-stone-500 leading-relaxed pl-12">
                              {v.evidence}
                            </p>

                            {DEBUG_MODE && (
                              <div className="flex items-center gap-2 flex-wrap pl-12">
                                <span className="text-[10px] font-mono text-stone-400">sources:</span>
                                {v.sources.map(s => (
                                  <span key={s} className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-stone-50 border border-stone-200 text-stone-500">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col md:items-end gap-1.5 text-right w-full md:w-auto mt-1 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-200">
                            {DEBUG_MODE && (
                              <span className="text-[11px] text-brand-500 self-start md:self-auto">
                                {Math.round(v.confidence * 100)}% confidence
                              </span>
                            )}
                            <span className="text-[11px] text-stone-500 flex items-center gap-1.5 justify-end">
                              <Clock className="w-3 h-3 text-stone-400" strokeWidth={1.5} />
                              {v.timeline}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {dossier.visitedDestinations.length > 5 && (
                      <button
                        onClick={() => setPlacesExpanded(!placesExpanded)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-stone-500 hover:text-brand-500 border-t border-stone-200 transition-colors cursor-pointer"
                      >
                        <span className="flex-1 h-px bg-stone-200" />
                        <span>{placesExpanded ? `Collapse` : `Show all ${dossier.visitedDestinations.length} places`}</span>
                        <span className="flex-1 h-px bg-stone-200" />
                      </button>
                    )}
                </div>

                {/* TAB CONTENT 4: GENERATED ITINERARIES */}
                <div ref={el => { sectionRefs.current['itineraries'] = el; }} data-section="itineraries" className="space-y-5" id="tab-itineraries">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-display text-xl font-light text-stone-900">My bucket list</h4>
                        <p className="text-xs text-stone-500 mt-0.5">Tailored trips you can open and book on GetSetYo</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(dossier.recommendations || []).map((rec) => {
                        const itinerary = (dossier.generatedItineraries || []).find(i => i.destination === rec.destination);

                        const packageId = itinerary?.packageDealId;
                        const productUrl = itinerary?.productUrl || '';
                        const hasLink = productUrl.length > 0 && packageId && packageId !== 0;
                        const isPending = itinerary?.status === 'PENDING';
                        const isGenerating = itinerary?.status === 'GENERATING';

                        return (
                          <div
                            key={rec.destination}
                            className="p-6 rounded-3xl border border-stone-200 bg-white flex flex-col justify-between gap-5"
                            id={`itinerary-card-${rec.destination.replace(/\s+/g, '')}`}
                          >
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="eyebrow text-brand-500">{rec.category.replace(' Destination', '')}</span>
                              </div>

                              <div>
                                <h5 className="font-display text-2xl font-light text-stone-900 leading-tight">{rec.destination}</h5>
                                <p className="text-xs text-stone-500 mt-1">{rec.country}</p>
                              </div>

                              <p className="text-[13px] text-stone-500 leading-relaxed">
                                {rec.reason}
                              </p>
                            </div>

                            <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                              {hasLink ? (
                                <>
                                  <span className="text-[11px] text-stone-500">Full day-by-day plan</span>
                                  <a
                                    href={productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1.5 transition-colors"
                                  >
                                    View itinerary
                                    <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                                  </a>
                                </>
                              ) : isPending ? (
                                <>
                                  <span className="text-[11px] text-stone-500">Recommended for this creator</span>
                                  <button
                                    onClick={async () => {
                                      setDossier(prev => {
                                        if (!prev) return prev;
                                        const itins = [...(prev.generatedItineraries || [])];
                                        const idx = itins.findIndex(i => i.destination === rec.destination);
                                        if (idx >= 0) itins[idx] = { ...itins[idx], status: 'GENERATING' };
                                        return { ...prev, generatedItineraries: itins };
                                      });
                                      try {
                                        const res = await fetch('/api/generate-itinerary', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ username: dossier.instagramUsername, destination: rec.destination })
                                        });
                                        const updated = await res.json();
                                        setDossier(prev => {
                                          if (!prev) return prev;
                                          const itins = [...(prev.generatedItineraries || [])];
                                          const idx = itins.findIndex(i => i.destination === rec.destination);
                                          if (idx >= 0) itins[idx] = { ...itins[idx], ...updated };
                                          return { ...prev, generatedItineraries: itins };
                                        });
                                      } catch {
                                        setDossier(prev => {
                                          if (!prev) return prev;
                                          const itins = [...(prev.generatedItineraries || [])];
                                          const idx = itins.findIndex(i => i.destination === rec.destination);
                                          if (idx >= 0) itins[idx] = { ...itins[idx], status: 'FAILED' };
                                          return { ...prev, generatedItineraries: itins };
                                        });
                                      }
                                    }}
                                    className="text-sm text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    View itinerary
                                  </button>
                                </>
                              ) : isGenerating ? (
                                <>
                                  <span className="text-[11px] text-stone-500">Creating your trip...</span>
                                  <span className="text-sm text-brand-400 font-medium flex items-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                                    Generating...
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] text-stone-500">Recommended for this creator</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>

                {/* TAB CONTENT: AGENT CALL & RESPONSE TRACE (internal/debug only) */}
                {DEBUG_MODE && (
                  <div className="space-y-6" id="tab-agent-swarm">
                    <div className="flex flex-col md:flex-row gap-2 justify-between items-start md:items-center">
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                          Agent Swarm - Request & Response Deep Trace
                        </h4>
                        <p className="text-xs text-slate-500">
                          Step-by-step trace of the 10 AI agents working together to analyze the creator's profile and build personalized trips.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold bg-emerald-950/40 border border-emerald-800 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Audit State: Verified & Secured
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Agent Pipeline Selection */}
                      <div className="lg:col-span-1 flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                        {[
                          { index: 0, name: "PlannerAgent", title: "1. Planner Agent", desc: "Task Coordinator", color: "text-indigo-400" },
                          { index: 1, name: "InstagramExtractionAgent", title: "2. Profile Reader", desc: "Instagram Data Reader", color: "text-violet-400" },
                          { index: 2, name: "ContentStructuringAgent", title: "3. Content Refiner", desc: "NLP Normalization & Parsing", color: "text-cyan-400" },
                          { index: 3, name: "TravelDetectionAgent", title: "4. Travel Detection", desc: "AI Travel Analyst", color: "text-sky-400" },
                          { index: 4, name: "TravelPersonaAgent", title: "5. Travel Persona", desc: "Behavior & Style Classifier", color: "text-emerald-400" },
                          { index: 5, name: "RecommendationAgent", title: "6. Recommender Matrix", desc: "Heuristic Match Scorer", color: "text-amber-400" },
                          { index: 6, name: "PromptGenerationAgent", title: "7. Prompt Generation", desc: "Query Syntax Composer", color: "text-rose-400" },
                          { index: 7, name: "ItineraryGenerationAgent", title: "8. Itinerary Router", desc: "GetSetYo API Gateway", color: "text-cyan-400" },
                          { index: 8, name: "MapAgent", title: "9. Map GIS Agent", desc: "Geospatial coordinate mapper", color: "text-teal-400" },
                          { index: 9, name: "ResultAggregatorAgent", title: "10. Results Compiler", desc: "Final Profile Builder", color: "text-pink-400" }
                        ].map((agent) => {
                          const isSelected = selectedTraceIndex === agent.index;
                          return (
                            <button
                              key={agent.index}
                              onClick={() => setSelectedTraceIndex(agent.index)}
                              className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 w-full ${
                                isSelected
                                  ? 'bg-slate-900 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/15'
                                  : 'bg-stone-50 hover:bg-slate-900/60 border-stone-200 hover:border-slate-800'
                              }`}
                            >
                              <div className="mt-1 shrink-0">
                                <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-bold leading-none ${agent.color}`}>{agent.title}</span>
                                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 px-1 border border-emerald-800/10 rounded">OK</span>
                                </div>
                                <span className="block text-[11px] font-medium text-stone-800 mt-1 truncate">{agent.name}</span>
                                <span className="block text-[10px] text-slate-500 mt-0.5 truncate">{agent.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right: Detailed Request & Response Trace Viewer */}
                      <div className="lg:col-span-2 flex flex-col gap-4 bg-white border border-stone-200 p-5 rounded-2xl">
                        {(() => {
                          const traceList = [
                            {
                              name: "PlannerAgent",
                              role: "Task Coordinator",
                              description: "Coordinates the analysis workflow, validates your input, and assigns each step to the right specialist.",
                              request: {
                                targetHandle: `@${dossier.instagramUsername}`,
                                action: "ORCHESTRATE_PIPELINE",
                                targetStages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                                routingStrategy: "Planner-Led Orchestration"
                              },
                              response: {
                                status: "QUEUED_OK",
                                jobId: `job-${dossier.instagramUsername}`,
                                timestamp: dossier.generatedAt || new Date().toISOString(),
                                workerAssignment: {
                                  stages: [
                                    "PlannerAgent",
                                    "InstagramExtractionAgent",
                                    "ContentStructuringAgent",
                                    "TravelDetectionAgent",
                                    "TravelPersonaAgent",
                                    "RecommendationAgent",
                                    "PromptGenerationAgent",
                                    "ItineraryGenerationAgent",
                                    "MapAgent",
                                    "ResultAggregatorAgent"
                                  ]
                                }
                              }
                            },
                            {
                              name: "InstagramExtractionAgent",
                              role: "Profile Reader",
                              description: "Reads the creator's public Instagram profile — bio, posts, reels, and tagged content — to gather travel signals.",
                              request: {
                                provider: "Instagram Public Data Service",
                                targetHandle: dossier.instagramUsername,
                                extractionMetrics: ["biography", "posts", "reels", "taggedPosts"]
                              },
                              response: {
                                status: "COMPLETED",
                                profilePic: dossier.creatorProfile.profilePicUrl,
                                rawProfile: {
                                  username: dossier.instagramUsername,
                                  fullName: dossier.creatorProfile.fullName,
                                  followersCount: dossier.creatorProfile.followersCount,
                                  postsCount: dossier.creatorProfile.postsCount,
                                  bioLength: dossier.creatorProfile.biography.length
                                },
                                collectedDataPoints: {
                                  posts: dossier.instagramData.posts.length,
                                  reels: dossier.instagramData.reels.length,
                                  taggedPosts: dossier.instagramData.taggedPosts.length
                                }
                              }
                            },
                            {
                              name: "ContentStructuringAgent",
                              role: "Content Organizer",
                              description: "Cleans up and organizes captions, hashtags, mentions, and location tags to prepare them for analysis.",
                              request: {
                                action: "CONSOLIDATE_EXTRACTED_DATA",
                                inputData: {
                                  bio: dossier.creatorProfile.biography,
                                  postsCount: dossier.instagramData.posts.length,
                                  reelsCount: dossier.instagramData.reels.length
                                },
                                filterOptions: {
                                  deduplicateCaptions: true,
                                  stripEmojiSpacing: false,
                                  caseNormalizeTags: true
                                }
                              },
                              response: {
                                consolidatedData: {
                                  bioTextLine: dossier.structuredContent.bio,
                                  uniqueHashtagsCount: dossier.structuredContent.hashtags.length,
                                  uniqueHashtagsSample: dossier.structuredContent.hashtags.slice(0, 15),
                                  uniqueMentionsCount: dossier.structuredContent.mentions.length,
                                  uniqueMentionsSample: dossier.structuredContent.mentions.slice(0, 10),
                                  uniqueLocationsCount: dossier.structuredContent.locations.length,
                                  uniqueLocationsSample: dossier.structuredContent.locations
                                },
                                enrichmentStatus: "READY_FOR_AI"
                              }
                            },
                            {
                              name: "TravelDetectionAgent",
                              role: "AI Travel Analyst",
                              description: "Uses AI to understand where the creator has actually traveled, based on their posts, captions, and location tags.",
                              request: {
                                engine: "Google AI",
                                temperature: 0.2,
                                responseMimeType: "application/json",
                                systemInstructions: "Analyze the public Instagram content and produce structured travel insights.",
                                sourceDataProvided: {
                                  username: dossier.instagramUsername,
                                  bio: dossier.creatorProfile.biography,
                                  locations: dossier.structuredContent.locations
                                }
                              },
                              response: {
                                status: "COMPLETED",
                                visitedDestinationsDetected: dossier.visitedDestinations
                              }
                            },
                            {
                              name: "TravelPersonaAgent",
                              role: "Style Profiler",
                              description: "Determines the creator's travel style, budget level, and preferences based on their travel history and content.",
                              request: {
                                inputSignals: {
                                  detectedLocations: (dossier.visitedDestinations || []).map(v => v.destination),
                                  mentionsSample: dossier.structuredContent?.mentions || []
                                }
                              },
                              response: {
                                inferences: {
                                  budgetProfile: dossier.travelPersona?.budgetProfile || 'pending',
                                  travelStyle: dossier.travelPersona?.travelStyle || 'pending',
                                  travellerType: dossier.travelPersona?.travellerType || 'pending',
                                  travelFrequency: dossier.travelPersona?.travelFrequency || 'pending',
                                  activityPreferences: dossier.travelPersona?.activityPreferences || [],
                                  hotelPreference: dossier.travelPersona?.hotelPreference || '',
                                  foodPreference: dossier.travelPersona?.foodPreference || '',
                                  summaryText: dossier.travelPersona?.summary || ''
                                },
                                confidence: dossier.travelPersona?.confidence || 0
                              }
                            },
                            {
                              name: "RecommendationAgent",
                              role: "Destination Matcher",
                              description: "Finds the best destination matches based on the creator's travel style — including similar, aspirational, and hidden gem picks.",
                              request: {
                                constraints: {
                                  budgetProfile: dossier.travelPersona?.budgetProfile || 'pending',
                                  travelStyle: dossier.travelPersona?.travelStyle || 'pending'
                                }
                              },
                              response: {
                                recommendationsCompiled: (dossier.recommendations || []).map(rec => ({
                                  destination: rec.destination,
                                  country: rec.country,
                                  category: rec.category,
                                  matchingScorePct: rec.score,
                                  scoreReason: rec.reason
                                }))
                              }
                            },
                            {
                              name: "PromptGenerationAgent",
                              role: "Itinerary Planner",
                              description: "Creates personalized trip briefs for each recommended destination, tailored to the creator's preferences.",
                              request: {
                                composerModel: "ItineraryPromptGenerator",
                                inputs: dossier.recommendations.map(r => ({ "dest": r.destination, "category": r.category })),
                                targetEngine: "GetSetYo API Standard v4"
                              },
                              response: {
                                promptsGenerated: dossier.prompts
                              }
                            },
                            {
                              name: "ItineraryGenerationAgent",
                              role: "Trip Builder",
                              description: "Creates real bookable trip packages on GetSetYo for each recommended destination.",
                              request: {
                                apiEndpoint: "POST https://www.getsetyo.club/itinerary/generate-ai-itinerary",
                                queries: dossier.prompts
                              },
                              response: {
                                packageCount: dossier.generatedItineraries.length,
                                resultsActive: dossier.generatedItineraries.map(it => ({
                                  destination: it.destination,
                                  dealId: it.packageDealId,
                                  status: it.status,
                                  productUrl: it.productUrl
                                }))
                              }
                            },
                            {
                              name: "MapAgent",
                              role: "Map Plotter",
                              description: "Places all visited and recommended destinations on an interactive map so you can see them at a glance.",
                              request: {
                                action: "PLOT_COORDINATES",
                                coordinateSchema: "EPSG:4326 (WGS84)",
                                poList: [
                                  ...dossier.mapData.visitedLocations.map(l => ({ name: l.name, type: "visited" })),
                                  ...dossier.mapData.recommendedLocations.map(l => ({ name: l.name, type: "recommended" }))
                                ]
                              },
                              response: {
                                plotStatus: "SUCCESS",
                                coordinatesRegistered: dossier.mapData
                              }
                            },
                            {
                              name: "ResultAggregatorAgent",
                              role: "Results Compiler",
                              description: "Assembles the final travel profile and saves the results so they load instantly for 30 days.",
                              request: {
                                cacheKeys: [
                                  `creator-analysis:${dossier.instagramUsername}`,
                                  `creator-itineraries:${dossier.instagramUsername}`
                                ]
                              },
                              response: {
                                outputSummary: "Creator dossier compiled and returned to the dashboard.",
                                presenterPayloadOk: true
                              }
                            }
                          ];

                          const activeTrace = traceList[selectedTraceIndex] || traceList[0];

                          return (
                            <div className="space-y-4">
                              {/* Header Meta */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-3 gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-400 font-semibold uppercase">
                                      Stage {selectedTraceIndex + 1}
                                    </span>
                                    <h5 className="text-base font-bold text-white tracking-tight">
                                      {activeTrace.name}
                                    </h5>
                                  </div>
                                  <p className="text-xs text-indigo-300 font-mono mt-0.5">Role: {activeTrace.role}</p>
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  <span>State: </span>
                                  <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2.5 py-1 rounded border border-emerald-950">
                                    ● COMPLETED
                                  </span>
                                </div>
                              </div>

                              <div>
                                <h6 className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-mono mb-1">
                                  Agent Description & Responsibility
                                </h6>
                                <p className="text-xs text-slate-300 leading-normal bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                                  {activeTrace.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left Pane: Request Call Details */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold font-mono text-cyan-400 flex items-center gap-1">
                                      <span>➡️ Call Input Request</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-600 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                                      POST/BODY
                                    </span>
                                  </div>
                                  <div className="bg-stone-50 p-4 rounded-xl border border-slate-100/10 font-mono text-xs text-slate-300 max-h-[300px] overflow-y-auto w-full leading-relaxed select-all">
                                    <pre className="whitespace-pre-wrap breakdown-words font-mono text-[11px]">
                                      {JSON.stringify(activeTrace.request, null, 2)}
                                    </pre>
                                  </div>
                                </div>

                                {/* Right Pane: Response Payloads */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1">
                                      <span>⬅️ Response Decoded Output</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-slate-100/10">
                                      JSON_OK
                                    </span>
                                  </div>
                                  <div className="bg-stone-50 p-4 rounded-xl border border-slate-100/10 font-mono text-xs text-slate-300 max-h-[300px] overflow-y-auto w-full leading-relaxed select-all">
                                    <pre className="whitespace-pre-wrap breakdown-words font-mono text-[11px]">
                                      {JSON.stringify(activeTrace.response, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 5: ARCHITECTURAL DESIGN SPECS (internal/debug only) */}
                {DEBUG_MODE && (
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-6 text-sm" id="tab-architecture">
                    <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
                      <ShieldCheck className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight">System Engineering Specifications</h4>
                        <p className="text-xs text-slate-500 font-mono">Multi-Agent State & Infrastructure mapping documentation</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Space 1: Data structure */}
                      <div className="space-y-2">
                        <h5 className="font-semibold text-stone-800 flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-400" />
                          Profile Data ({dossier.instagramUsername})
                        </h5>
                        <p className="text-xs text-stone-500">
                          Stores analyzed travel profiles and recommendations for instant retrieval on repeat visits.
                        </p>
                        <pre className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 text-xs text-stone-700 font-mono overflow-x-auto space-y-1 leading-relaxed">
                          {`// Profile: @${dossier.instagramUsername}
{
  "travelPersona": {
    "budgetProfile": "${dossier.travelPersona?.budgetProfile || 'analyzing...'}",
    "travelStyle": "${dossier.travelPersona?.travelStyle || 'analyzing...'}"
  },
  "visitedDestinations": [ ${(dossier.visitedDestinations || []).length} found ],
  "recommendations": [ ${(dossier.recommendations || []).length} generated ],
  "generatedAt": "${dossier.generatedAt}"
}

// Results saved for 30 days`}
                        </pre>
                      </div>

                      {/* Space 2: Agent workflow */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h5 className="font-semibold text-stone-800 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            Agent Workflow
                          </h5>
                          <p className="text-xs text-stone-500">
                            Each analysis runs through a 10-step AI agent pipeline. Agents execute sequentially, passing results through shared session state.
                          </p>
                          <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs font-mono">
                            <Compass className="w-4 h-4 text-indigo-400" />
                            <span>Pipeline: <code className="text-stone-800">Google ADK SequentialAgent</code></span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="font-semibold text-stone-800 flex items-center gap-1">
                            <Award className="w-4 h-4 text-amber-500" />
                            Status checks & Polls
                          </h5>
                          <p className="text-xs text-stone-500">
                            Itineraries poll status from <code className="text-stone-800 text-[11px]">PENDING</code> ➡️ <code className="text-stone-800 text-[11px]">GENERATING</code> ➡️ <code className="text-teal-400 text-[11px]">COMPLETED</code>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        )}
      </main>

      <footer className="border-t border-stone-200 px-5 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-stone-500 select-none mt-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-sage-500" strokeWidth={1.5} />
          <span className="tracking-wide">Private &amp; secure — we only read public profile data</span>
        </div>
        <span className="font-display italic text-stone-500">GetSetYo · {new Date().getFullYear()}</span>
      </footer>

      {/* Share Profile Modal */}
      {shareUrl && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShareUrl(null)}>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-medium text-stone-900">Share travel profile</h3>
              <button onClick={() => setShareUrl(null)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <p className="text-sm text-stone-500">Anyone with this link can view the travel profile.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-xs text-stone-700 font-mono select-all"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 2000);
                }}
                className="shrink-0 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors cursor-pointer"
              >
                {shareToast ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
            >
              Open in new tab <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
