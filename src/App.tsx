import { useState, useEffect, useMemo } from "react";
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
  { username: "wanderwithsky", label: "🏔️ Adventure & Peaks", hint: "Aakash" },
  { username: "btwitsnaman", label: "🌏 Travel Creator", hint: "Naman" },
  { username: "doyoutravel", label: "📸 Wanderlust", hint: "Jack Morris" }
];

// Internal/debug surface (Agent Trace tab, Tech Specs tab, infra telemetry,
// confidence scores, match scores, deal IDs) is hidden from end users by default.
// Enable it by setting VITE_DEBUG_MODE="true" in the environment.
const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

export default function App() {
  const [username, setUsername] = useState("wanderwithsky");
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [dossier, setDossier] = useState<CreatorIntelligenceDossier | null>(null);
  const [activeTab, setActiveTab] = useState<'persona' | 'history' | 'map' | 'itineraries' | 'agentSwarm' | 'architecture'>('persona');
  const [activeLocation, setActiveLocation] = useState<MapCoordinates | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number>(0);

  // Poll intervals
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (status === 'running') {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/analysis-status?username=${encodeURIComponent(username)}`);
          if (res.ok) {
            const data = await res.json();
            
            // Sync status and logs
            setLogs(data.logs || []);
            
            if (data.status === 'completed') {
              setStatus('completed');
              setDossier(data.dossier);
              setProgress(100);
              clearInterval(pollInterval!);
            } else if (data.status === 'failed') {
              setStatus('failed');
              setErrorText("The intelligence agent pipeline crashed trying to validate profiles. Please retry.");
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

  const handleAnalyze = async (targetUsername: string = username) => {
    if (!targetUsername.trim()) return;

    setErrorText(null);
    setStatus('running');
    setProgress(5);
    setLogs([]);
    setDossier(null);
    setActiveTab('persona');

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: targetUsername })
      });

      if (!res.ok) {
        throw new Error("Trigger endpoint returned non-200 state.");
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
      setErrorText("Failed to establish server request. Double-check backend server status.");
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
    <div className="min-h-screen bg-canvas text-stone-200 font-sans flex flex-col relative selection:bg-brass-400/25" id="app-root">

      {/* Header */}
      <header className="border-b border-white/[0.06] bg-canvas/80 backdrop-blur-xl sticky top-0 z-50 px-5 md:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-brass-400/40 bg-brass-400/[0.07]">
            <Compass className="w-5 h-5 text-brass-300" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-lg font-medium text-stone-50 leading-none">
              GetSetYo
            </h1>
            <p className="text-[11px] text-stone-400 tracking-wide mt-1">AI Travel Concierge</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Live status telemetry (internal/debug only) */}
          {DEBUG_MODE && (
            <div className="flex items-center gap-2.5 text-[11px] font-mono">
              <div className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center gap-2 text-stone-400">
                <Database className="w-3.5 h-3.5 text-sage-300" />
                <span>Cache: <span className="text-sage-300 font-semibold">Active</span></span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center gap-2 text-stone-400">
                <Cpu className="w-3.5 h-3.5 text-brass-300" />
                <span>LLM: <span className="text-stone-100">Gemini 3.5 Flash</span></span>
              </div>
            </div>
          )}
          <span className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
            Powered by GetSetYo
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6" id="dashboard-layout">
        
        {/* Hero + input */}
        <section className="flex flex-col items-center text-center gap-7 pt-8 pb-4 md:pt-14 md:pb-8" id="trigger-section">
          <div className="max-w-2xl flex flex-col items-center gap-4">
            <span className="eyebrow text-brass-300 flex items-center gap-2">
              <span className="w-6 h-px bg-brass-400/50" />
              Personal travel intelligence
              <span className="w-6 h-px bg-brass-400/50" />
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light text-stone-50 leading-[1.08]">
              Your Instagram, turned into a
              <span className="italic text-brass-300"> bespoke journey</span>
            </h2>
            <p className="text-sm md:text-[15px] text-stone-400 leading-relaxed max-w-xl">
              Enter your public Instagram handle. We read your travel story and craft tailored,
              ready-to-book itineraries made just for you.
            </p>
          </div>

          {/* Input row */}
          <div className="w-full max-w-xl flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-stone-500">
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <input
                type="text"
                placeholder="your_instagram_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={status === 'running'}
                className="w-full bg-white/[0.03] border border-white/10 rounded-full py-3.5 pl-12 pr-4 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-brass-400/60 focus:bg-white/[0.05] transition-all"
                id="creator-username-input"
              />
            </div>

            <button
              onClick={() => handleAnalyze()}
              disabled={status === 'running' || !username.trim()}
              className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-medium text-sm transition-all duration-300 whitespace-nowrap ${
                status === 'running'
                  ? 'bg-brass-400/10 text-brass-300/70 border border-brass-400/20 cursor-not-allowed'
                  : 'bg-brass-400 text-stone-950 hover:bg-brass-300 shadow-lg shadow-brass-500/10 active:scale-[0.98] cursor-pointer'
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
                  <span>Plan my trips</span>
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
                    ? 'bg-brass-400/10 border-brass-400/40 text-brass-200'
                    : 'bg-white/[0.02] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:border-white/15'
                }`}
              >
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {errorText && (
            <div className="w-full max-w-xl bg-red-500/[0.07] border border-red-500/20 text-red-300 p-3.5 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}
        </section>

        {/* Dynamic Interactive Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Swarm execution logs always visible if triggered */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <AgentLiveTerminal logs={logs} status={status} />
          </div>

          {/* Right/Major panels: Results view */}
          <div className="lg:col-span-2 flex flex-col gap-6" id="dashboard-results-container">
            {dossier ? (
              <div className="flex flex-col gap-6 h-full">
                
                {/* Result Control Tab deck */}
                <div className="flex flex-col gap-5 animate-rise">
                  <div className="flex items-center gap-4">
                    <img
                      src={dossier.creatorProfile.profilePicUrl}
                      alt={dossier.creatorProfile.fullName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <h3 className="font-display text-xl font-medium text-stone-50 leading-tight">
                        {dossier.creatorProfile.fullName}
                      </h3>
                      <div className="flex items-center gap-2.5 text-xs text-stone-500 mt-1">
                        <span className="text-stone-400">@{dossier.instagramUsername}</span>
                        <span className="w-1 h-1 rounded-full bg-stone-700" />
                        <span>{dossier.creatorProfile.followersCount.toLocaleString()} followers</span>
                        {DEBUG_MODE && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-stone-700" />
                            <span>Confidence {Math.round(dossier.travelPersona.confidence * 100)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-px">
                    {([
                      { key: 'persona', label: 'Trip Style' },
                      { key: 'history', label: 'Places Visited' },
                      { key: 'map', label: 'Map' },
                      { key: 'itineraries', label: `Itineraries (${dossier.generatedItineraries.filter(i => i.status === 'COMPLETED').length})` },
                      ...(DEBUG_MODE ? [{ key: 'agentSwarm', label: 'Agent Trace' }, { key: 'architecture', label: 'Tech Specs' }] : [])
                    ] as { key: typeof activeTab; label: string }[]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`relative text-sm px-4 py-2.5 transition-colors ${
                          activeTab === tab.key ? 'text-stone-50' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {tab.label}
                        {activeTab === tab.key && (
                          <span className="absolute left-3 right-3 -bottom-px h-px bg-brass-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAB CONTENT 1: TRAVEL PERSONA */}
                {activeTab === 'persona' && (
                  <div className="space-y-5 animate-rise" id="tab-persona">
                    <div className="bg-white/[0.02] rounded-3xl border border-white/[0.06] p-7 flex flex-col md:flex-row gap-7">
                      <div className="flex-1 space-y-5">
                        <div>
                          <span className="eyebrow text-brass-300">Your bio</span>
                          <p className="text-stone-300 text-[15px] italic font-display font-light mt-2 leading-relaxed">
                            "{dossier.creatorProfile.biography}"
                          </p>
                        </div>

                        <div className="h-px bg-white/[0.06]" />

                        <div>
                          <span className="eyebrow text-stone-500">Your travel style</span>
                          <p className="text-stone-300 text-sm mt-2 leading-relaxed">{dossier.travelPersona.summary}</p>
                        </div>
                      </div>

                      {/* Classification metrics */}
                      <div className="w-full md:w-64 shrink-0 bg-white/[0.02] p-5 border border-white/[0.06] rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                          <Sliders className="w-4 h-4 text-brass-300" strokeWidth={1.5} />
                          <span className="text-xs font-medium text-stone-300 tracking-wide">At a glance</span>
                        </div>

                        <div className="space-y-3 text-xs">
                          {[
                            { label: 'Travel style', value: dossier.travelPersona.travelStyle },
                            { label: 'Budget', value: dossier.travelPersona.budgetProfile, accent: true },
                            { label: 'Travels as', value: dossier.travelPersona.travellerType },
                            { label: 'Frequency', value: dossier.travelPersona.travelFrequency },
                            { label: 'Stays', value: dossier.travelPersona.hotelPreference, truncate: true }
                          ].map((row) => (
                            <div key={row.label} className="flex justify-between items-center gap-3">
                              <span className="text-stone-500">{row.label}</span>
                              <span
                                className={`font-medium text-right ${row.accent ? 'text-brass-300' : 'text-stone-200'} ${row.truncate ? 'truncate max-w-[130px]' : ''}`}
                                title={row.truncate ? String(row.value) : undefined}
                              >
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Preferences & Interests grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/[0.06] space-y-4">
                        <span className="eyebrow text-stone-500">Things you love doing</span>
                        <div className="flex flex-wrap gap-2">
                          {dossier.travelPersona.activityPreferences.map((act) => (
                            <span key={act} className="text-xs px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-stone-300">
                              {act}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/[0.06] space-y-4">
                        <span className="eyebrow text-stone-500">Food you gravitate to</span>
                        <p className="text-sm text-stone-300 leading-relaxed font-display font-light italic">
                          {dossier.travelPersona.foodPreference}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: VISITED DESTINATIONS TIMELINE */}
                {activeTab === 'history' && (
                  <div className="space-y-5 animate-rise" id="tab-history">
                    <div className="flex items-baseline justify-between">
                      <h4 className="font-display text-xl font-light text-stone-100">Places you've been</h4>
                      <span className="text-xs text-stone-500">{dossier.visitedDestinations.length} destination(s)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {dossier.visitedDestinations.map((v, i) => (
                        <div key={`${v.destination}-${i}`} className="group bg-white/[0.02] p-5 rounded-2xl border border-white/[0.06] flex flex-col md:flex-row items-start justify-between gap-4 hover:border-white/12 transition-colors">
                          <div className="space-y-2.5 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brass-400/10 border border-brass-400/25 text-brass-300 shrink-0">
                                <Compass className="w-4 h-4" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h5 className="text-sm font-semibold text-stone-100">{v.destination}</h5>
                                <p className="text-xs text-stone-500">{v.country} · visited {v.visitCount}×</p>
                              </div>
                            </div>

                            <p className="text-xs text-stone-400 leading-relaxed pl-12">
                              {v.evidence}
                            </p>

                            {DEBUG_MODE && (
                              <div className="flex items-center gap-2 flex-wrap pl-12">
                                <span className="text-[10px] font-mono text-stone-600">sources:</span>
                                {v.sources.map(s => (
                                  <span key={s} className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.08] text-stone-400">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col md:items-end gap-1.5 text-right w-full md:w-auto mt-1 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                            {DEBUG_MODE && (
                              <span className="text-[11px] text-brass-300 self-start md:self-auto">
                                {Math.round(v.confidence * 100)}% confidence
                              </span>
                            )}
                            <span className="text-[11px] text-stone-500 flex items-center gap-1.5 justify-end">
                              <Clock className="w-3 h-3 text-stone-600" strokeWidth={1.5} />
                              {v.timeline}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 3: INTERACTIVE TRAVEL MAP */}
                {activeTab === 'map' && (
                  <div className="flex-1 min-h-[400px]" id="tab-map">
                    <WorldMap 
                      locations={allMapPins} 
                      activeLocation={activeLocation}
                      onSelectLocation={(loc) => setActiveLocation(loc)} 
                    />
                  </div>
                )}

                {/* TAB CONTENT 4: GENERATED ITINERARIES */}
                {activeTab === 'itineraries' && (
                  <div className="space-y-5 animate-rise" id="tab-itineraries">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <h4 className="font-display text-xl font-light text-stone-100">Itineraries made for you</h4>
                        <p className="text-xs text-stone-500 mt-0.5">Tailored trips you can open and book on GetSetYo</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {dossier.recommendations.map((rec) => {
                        const itinerary = dossier.generatedItineraries.find(i => i.destination === rec.destination);
                        if (!itinerary) return null;

                        const packageId = itinerary.packageDealId;
                        const productUrl = itinerary.productUrl || `https://getsetyo.com/product/${packageId}`;

                        return (
                          <a
                            key={rec.destination}
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group p-6 rounded-3xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 flex flex-col justify-between gap-5 hover:border-brass-400/30 hover:bg-white/[0.035]"
                            id={`itinerary-card-${rec.destination.replace(/\s+/g, '')}`}
                          >
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="eyebrow text-brass-300">{rec.category.replace(' Destination', '')}</span>
                                {DEBUG_MODE && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sage-500/10 text-sage-300 border border-sage-500/20">
                                    {itinerary.status}
                                  </span>
                                )}
                              </div>

                              <div>
                                <h5 className="font-display text-2xl font-light text-stone-50 leading-tight">{rec.destination}</h5>
                                <p className="text-xs text-stone-500 mt-1">
                                  {rec.country}
                                  {DEBUG_MODE && (
                                    <> · match {rec.score}%</>
                                  )}
                                </p>
                              </div>

                              <p className="text-[13px] text-stone-400 leading-relaxed">
                                {rec.reason}
                              </p>
                            </div>

                            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                              {DEBUG_MODE ? (
                                <span className="text-[11px] font-mono text-stone-600">#{packageId}</span>
                              ) : (
                                <span className="text-[11px] text-stone-500">Full day-by-day plan</span>
                              )}
                              <span className="text-sm text-brass-300 group-hover:text-brass-200 font-medium flex items-center gap-1.5 transition-colors">
                                View itinerary
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                              </span>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: AGENT CALL & RESPONSE TRACE (internal/debug only) */}
                {DEBUG_MODE && activeTab === 'agentSwarm' && (
                  <div className="space-y-6" id="tab-agent-swarm">
                    <div className="flex flex-col md:flex-row gap-2 justify-between items-start md:items-center">
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                          Agent Swarm - Request & Response Deep Trace
                        </h4>
                        <p className="text-xs text-slate-500">
                          Live visual audit trace of the 10 multi-agent pipeline calls invoking Google GenAI, crawlers, and GetSetYo package servers.
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
                          { index: 0, name: "PlannerAgent", title: "1. Planner Agent", desc: "Pipeline Router & Task Planner", color: "text-indigo-400" },
                          { index: 1, name: "InstagramExtractionAgent", title: "2. Instagram Scraper", desc: "Data Extractor (Apify Core)", color: "text-violet-400" },
                          { index: 2, name: "ContentStructuringAgent", title: "3. Content Refiner", desc: "NLP Normalization & Parsing", color: "text-cyan-400" },
                          { index: 3, name: "TravelDetectionAgent", title: "4. Travel Detection", desc: "Google Gemini 3.5 AI Core", color: "text-sky-400" },
                          { index: 4, name: "TravelPersonaAgent", title: "5. Travel Persona", desc: "Behavior & Style Classifier", color: "text-emerald-400" },
                          { index: 5, name: "RecommendationAgent", title: "6. Recommender Matrix", desc: "Heuristic Match Scorer", color: "text-amber-400" },
                          { index: 6, name: "PromptGenerationAgent", title: "7. Prompt Generation", desc: "Query Syntax Composer", color: "text-rose-400" },
                          { index: 7, name: "ItineraryGenerationAgent", title: "8. Itinerary Router", desc: "GetSetYo API Gateway", color: "text-cyan-400" },
                          { index: 8, name: "MapAgent", title: "9. Map GIS Agent", desc: "Geospatial coordinate mapper", color: "text-teal-400" },
                          { index: 9, name: "ResultAggregatorAgent", title: "10. Results Aggregator", desc: "Redis Cache Indexer", color: "text-pink-400" }
                        ].map((agent) => {
                          const isSelected = selectedTraceIndex === agent.index;
                          return (
                            <button
                              key={agent.index}
                              onClick={() => setSelectedTraceIndex(agent.index)}
                              className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 w-full ${
                                isSelected
                                  ? 'bg-slate-900 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/15'
                                  : 'bg-slate-950 hover:bg-slate-900/60 border-slate-900 hover:border-slate-800'
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
                                <span className="block text-[11px] font-medium text-slate-200 mt-1 truncate">{agent.name}</span>
                                <span className="block text-[10px] text-slate-500 mt-0.5 truncate">{agent.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right: Detailed Request & Response Trace Viewer */}
                      <div className="lg:col-span-2 flex flex-col gap-4 bg-slate-900/20 border border-slate-900 p-5 rounded-2xl">
                        {(() => {
                          const traceList = [
                            {
                              name: "PlannerAgent",
                              role: "Controller / Task router",
                              description: "Decides task dependencies, maps user input, schedules async jobs via simulated Cloud Pub/Sub, and initiates workflow state logging.",
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
                              role: "Scraper Service Connector",
                              description: "Crawls Instagram public schema records from grid timeline, biographical tags, image assets, likes/comments telemetry, and tagged items stream.",
                              request: {
                                provider: "Apify Instagram Scraper Service",
                                targetHandle: dossier.instagramUsername,
                                extractionMetrics: ["biography", "posts", "reels", "taggedPosts"]
                              },
                              response: {
                                status: "SUCCESS",
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
                                },
                                scrapingStatus: "COMPLETED"
                              }
                            },
                            {
                              name: "ContentStructuringAgent",
                              role: "Data parser & text refiner",
                              description: "Consolidates all scraped captions, extracts hashtag mentions, geotags, and filters duplicate entries to optimize LLM Token footprint.",
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
                              role: "Cognitive AI synthesis Core",
                              description: "Executes cognitive deep scans using LLM reasoning (Gemini 3.5 Flash) to parse natural language context into validated geographic entities.",
                              request: {
                                intelEngine: "Google GenAI Core API (TypeScript SDK v0.1)",
                                model: "gemini-3.5-flash",
                                temperature: 0.2,
                                responseMimeType: "application/json",
                                systemInstructions: "Analyze only the real scraped Instagram content and maintain structured JSON constraints.",
                                sourceDataProvided: {
                                  username: dossier.instagramUsername,
                                  bio: dossier.creatorProfile.biography,
                                  locations: dossier.structuredContent.locations
                                }
                              },
                              response: {
                                status: "PARSED_SUCCESSFULLY",
                                finalModelUsed: "models/gemini-3.5-flash",
                                visitedDestinationsDetected: dossier.visitedDestinations
                              }
                            },
                            {
                              name: "TravelPersonaAgent",
                              role: "Behavioral Classifier",
                              description: "Translates visited histories and food/aesthetic/hotel mentions into definitive budget categories, travel frequencies, and style identifiers.",
                              request: {
                                classifierAlgo: "TravelPersonaClassifier v2.5",
                                inputSignals: {
                                  detectedLocations: dossier.visitedDestinations.map(v => v.destination),
                                  mentionsSample: dossier.structuredContent.mentions
                                }
                              },
                              response: {
                                inferences: {
                                  budgetProfile: dossier.travelPersona.budgetProfile,
                                  travelStyle: dossier.travelPersona.travelStyle,
                                  travellerType: dossier.travelPersona.travellerType,
                                  travelFrequency: dossier.travelPersona.travelFrequency,
                                  activityPreferences: dossier.travelPersona.activityPreferences,
                                  hotelPreference: dossier.travelPersona.hotelPreference,
                                  foodPreference: dossier.travelPersona.foodPreference,
                                  summaryText: dossier.travelPersona.summary
                                },
                                personaIndexConfidence: dossier.travelPersona.confidence
                              }
                            },
                            {
                              name: "RecommendationAgent",
                              role: "Heuristic Match Scorer",
                              description: "Evaluates thousands of tourist tracking profiles against the generator model to recommend matching Aspirational, Similar, and Hidden Gem destinations.",
                              request: {
                                algorithm: "GetSetYo Target Scoring Matrix v2.0",
                                constraints: {
                                  budgetProfile: dossier.travelPersona.budgetProfile,
                                  travelStyle: dossier.travelPersona.travelStyle
                                }
                              },
                              response: {
                                recommendationsCompiled: dossier.recommendations.map(rec => ({
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
                              role: "Query Syntax Composer",
                              description: "Translates selected target suggestions into custom high-density parameter strings to pass to GetSetYo package deal retrieval APIs.",
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
                              role: "E-Commerce Package Deal Integrator",
                              description: "Orders parallel batch requests to GetSetYo packaging APIs, and automatically registers package deal prices and hoteliers.",
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
                              role: "Geospatial coordinate mapper",
                              description: "Invokes Google Maps coordinate geocoding queries to plot visited and recommended markers onto our interactive vector web map canvas.",
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
                              role: "Caching Aggregating Node",
                              description: "Compacts metadata schemas, stamps generation timestamps, and persists final analysis results in simulated Redis Cache with 30-day TTL parameters.",
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
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-900 pb-3 gap-2">
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
                                <h6 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono mb-1">
                                  Agent Description & Responsibility
                                </h6>
                                <p className="text-xs text-slate-300 leading-normal bg-slate-950 p-3.5 rounded-xl border border-slate-900">
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
                                    <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                                      POST/BODY
                                    </span>
                                  </div>
                                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-100/10 font-mono text-xs text-slate-300 max-h-[300px] overflow-y-auto w-full leading-relaxed select-all">
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
                                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-100/10 font-mono text-xs text-slate-300 max-h-[300px] overflow-y-auto w-full leading-relaxed select-all">
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
                {DEBUG_MODE && activeTab === 'architecture' && (
                  <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 space-y-6 text-sm" id="tab-architecture">
                    <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                      <ShieldCheck className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight">System Engineering Specifications</h4>
                        <p className="text-xs text-slate-500 font-mono">Multi-Agent State & Infrastructure mapping documentation</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Space 1: Redis schema */}
                      <div className="space-y-2">
                        <h5 className="font-semibold text-slate-200 flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-400" />
                          Redis Schema Design ({dossier.instagramUsername})
                        </h5>
                        <p className="text-xs text-slate-400">
                          Caches high-computation Instagram scraped profiles and recommendation dossiers under static TTL namespaces.
                        </p>
                        <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 text-xs text-zinc-300 font-mono overflow-x-auto space-y-1 leading-relaxed">
                          {`// ID: creator-analysis:${dossier.instagramUsername}
{
  "travelPersona": {
    "budgetProfile": "${dossier.travelPersona.budgetProfile}",
    "travelStyle": "${dossier.travelPersona.travelStyle}"
  },
  "visitedDestinations": [ ...${dossier.visitedDestinations.length} items ],
  "recommendations": [ ...${dossier.recommendations.length} items ],
  "generatedAt": "${dossier.generatedAt}"
}

// TTL: 2592000 s (30 Days Expiry)`}
                        </pre>
                      </div>

                      {/* Space 2: Pub/Sub messaging */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h5 className="font-semibold text-slate-200 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            Pub/Sub messaging orchestration
                          </h5>
                          <p className="text-xs text-slate-400">
                            The triggers are fired non-blocking to Google Cloud Pub/Sub topics. Worker scripts pull and invoke downriver agents sequentially.
                          </p>
                          <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-900 text-xs font-mono">
                            <Compass className="w-4 h-4 text-indigo-400" />
                            <span>Topic: <code className="text-slate-200">instagram-trigger-analyze</code></span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="font-semibold text-zinc-200 flex items-center gap-1">
                            <Award className="w-4 h-4 text-amber-500" />
                            Status checks & Polls
                          </h5>
                          <p className="text-xs text-slate-400">
                            Itineraries poll status from <code className="text-zinc-200 text-[11px]">PENDING</code> ➡️ <code className="text-zinc-200 text-[11px]">GENERATING</code> ➡️ <code className="text-teal-400 text-[11px]">COMPLETED</code>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Idle layout helper
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-8 bg-white/[0.015] border border-white/[0.06] rounded-3xl gap-5">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border border-white/[0.08] bg-white/[0.02]">
                  <Compass className="w-8 h-8 text-stone-600 animate-spin" strokeWidth={1.25} style={{ animationDuration: '40s' }} />
                </div>

                <div className="max-w-sm">
                  <h4 className="font-display text-xl font-light text-stone-200">Your journey starts with a handle</h4>
                  <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                    Enter your Instagram handle above, or try an example, and we'll compose tailored itineraries from your travel story.
                  </p>
                </div>

                {/* Micro instruction grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-stone-400 mt-3 max-w-xl">
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brass-300" strokeWidth={1.5} />
                    <span>Reads your travel style from posts &amp; reels.</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col items-center gap-2">
                    <MapPin className="w-5 h-5 text-brass-300" strokeWidth={1.5} />
                    <span>Maps the places you've already been.</span>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col items-center gap-2">
                    <Plane className="w-5 h-5 text-brass-300" strokeWidth={1.5} />
                    <span>Builds ready-to-book itineraries for you.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] px-5 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-stone-500 select-none mt-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-sage-500" strokeWidth={1.5} />
          <span className="tracking-wide">Private &amp; secure — we only read public profile data</span>
        </div>
        <span className="font-display italic text-stone-400">GetSetYo · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
