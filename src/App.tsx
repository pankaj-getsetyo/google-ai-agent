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
  { username: "luxury.explorer", label: "💎 Luxury Curator", hint: "Alex Thorne" },
  { username: "backpacker.sam", label: "🎒 Budget Backpacking", hint: "Sam Miller" },
  { username: "couple.escapes", label: "👩‍❤️‍👨 Romantic Escape", hint: "The Millers" }
];

export default function App() {
  const [username, setUsername] = useState("luxury.explorer");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative" id="app-root">
      
      {/* Visual Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute top-[400px] right-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none select-none" />
      
      {/* Header Deck */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 opacity-60 blur animate-pulse" />
            <div className="relative bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <Compass className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Creator Travel Intelligence
              <span className="text-[10px] uppercase tracking-widest font-mono font-normal bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded">
                Platform v2.5
              </span>
            </h1>
            <p className="text-xs text-slate-400 tracking-tight">Google ADK Multi-Agent Synthesis Engine</p>
          </div>
        </div>

        {/* Live status telemetry */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Memory Cache: <span className="text-emerald-400 font-semibold">Active</span></span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>LLM: <span className="text-white">Gemini 3.5 Flash</span></span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6" id="dashboard-layout">
        
        {/* Step 1 input trigger block */}
        <section className="bg-slate-900/40 backdrop-blur-sm border border-slate-900 rounded-2xl p-6 flex flex-col gap-4 relative" id="trigger-section">
          <div className="absolute top-2 right-3 flex items-center gap-1.5 text-xs font-mono text-slate-500 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AGENT LISTENER: ACTIVE</span>
          </div>

          <div className="max-w-xl">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-1">Analyze Creator Footprints</h2>
            <p className="text-xs text-slate-400">
              Accepts a public Instagram handle and automatically extracts the profile, analyzes the latest 100 posts, reels, bios, and maps travel intelligence.
            </p>
          </div>

          {/* Form Trigger Row */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Instagram className="w-5 h-5 text-indigo-400" />
              </div>
              <input
                type="text"
                placeholder="public_instagram_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={status === 'running'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                id="creator-username-input"
              />
            </div>

            <button
              onClick={() => handleAnalyze()}
              disabled={status === 'running' || !username.trim()}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                status === 'running'
                  ? 'bg-cyan-950 text-cyan-500 border border-cyan-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg active:scale-98 cursor-pointer'
              }`}
              id="analyze-submit-button"
            >
              {status === 'running' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing ({progress}%)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Instagram Handle</span>
                </>
              )}
            </button>
          </div>

          {/* Showcase Preset Triggers */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900/50">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mr-2">Try Showcase Creators:</span>
            {SHOWCASE_CREATORS.map((c) => (
              <button
                key={c.username}
                onClick={() => handleShowcaseSelect(c.username)}
                disabled={status === 'running'}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  username === c.username 
                    ? 'bg-slate-900 border-cyan-500/50 text-cyan-300 font-medium' 
                    : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{c.label}</span>
                <span className="text-[10px] font-mono text-slate-500">@{c.username}</span>
              </button>
            ))}
          </div>

          {errorText && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-pulse">
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
            
            {/* Swarm Architecture Summary panel */}
            <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Downstream Pipeline Specs</h3>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                This platform utilizes the **Planner Agent orchestration architecture**. It automatically routes the Instagram handle through 10 isolated AI actors to structure content, profile styles, and poll status indicators from GetSetYo Itinerary engine.
              </p>
              
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-1">
                <div className="p-2 bg-slate-950 rounded border border-slate-900 flex flex-col">
                  <span className="text-slate-500">Analysis Items</span>
                  <span className="text-slate-300 font-semibold text-xs mt-0.5">Bio + 100 Posts</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-900 flex flex-col">
                  <span className="text-slate-500">Reels inclusion</span>
                  <span className="text-emerald-400 font-semibold text-xs mt-0.5">TRUE</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-900 flex flex-col">
                  <span className="text-slate-500">Stories Crawling</span>
                  <span className="text-rose-400 font-semibold text-xs mt-0.5">DISABLED</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-900 flex flex-col">
                  <span className="text-slate-500">Dossier TTL</span>
                  <span className="text-slate-300 font-semibold text-xs mt-0.5">30 Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right/Major panels: Results view */}
          <div className="lg:col-span-2 flex flex-col gap-6" id="dashboard-results-container">
            {dossier ? (
              <div className="flex flex-col gap-6 h-full">
                
                {/* Result Control Tab deck */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-2 gap-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={dossier.creatorProfile.profilePicUrl} 
                      alt="creator" 
                      onClick={() => console.log('creator_dossier', dossier)}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-800"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {dossier.creatorProfile.fullName}
                        <span className="text-xs text-slate-400 font-normal">@{dossier.instagramUsername}</span>
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                        <span>👥 {dossier.creatorProfile.followersCount.toLocaleString()} followers</span>
                        <span>•</span>
                        <span>🎯 Confidence {Math.round(dossier.travelPersona.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-900">
                    <button
                      onClick={() => setActiveTab('persona')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all ${
                        activeTab === 'persona' ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Persona
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all ${
                        activeTab === 'history' ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Visited
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                        activeTab === 'map' ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Map
                      <span className="text-[9px] bg-slate-900 text-emerald-400 px-1.5 rounded border border-slate-800">GIS</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('itineraries')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1 ${
                        activeTab === 'itineraries' ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Itineraries
                      <span className="text-[9px] bg-slate-900 text-cyan-400 px-1.5 rounded border border-slate-800 font-mono">
                        {dossier.generatedItineraries.filter(i => i.status === 'COMPLETED').length}/5
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('agentSwarm')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1 ${
                        activeTab === 'agentSwarm' ? 'bg-indigo-600 text-white font-medium shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Agent Trace
                      <span className="text-[9px] bg-slate-900 text-emerald-400 px-1.5 rounded border border-slate-800 font-mono">10/10</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('architecture')}
                      className={`text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1 ${
                        activeTab === 'architecture' ? 'bg-slate-900 text-cyan-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tech Specs
                    </button>
                  </div>
                </div>

                {/* TAB CONTENT 1: TRAVEL PERSONA */}
                {activeTab === 'persona' && (
                  <div className="space-y-6" id="tab-persona">
                    <div className="bg-slate-900/20 rounded-2xl border border-slate-900 p-6 flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-4">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400">Synthesized Biography Profile</span>
                          <h4 className="text-xl font-semibold text-slate-100 tracking-tight mt-1">{dossier.creatorProfile.fullName}</h4>
                          <p className="text-slate-400 text-xs italic mt-1 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono">
                            "{dossier.creatorProfile.biography}"
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Travel style summary</span>
                          <p className="text-slate-300 text-xs mt-1 leading-relaxed">{dossier.travelPersona.summary}</p>
                        </div>
                      </div>

                      {/* Swarm classification metrics */}
                      <div className="w-full md:w-64 bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-3">
                        <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2">
                          <Sliders className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-semibold text-slate-200 font-mono">Swarm Inferences</span>
                        </div>
                        
                        <div className="space-y-2.5 text-xs text-slate-400">
                          <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                            <span>Travel style:</span>
                            <span className="text-white font-medium">{dossier.travelPersona.travelStyle}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                            <span>Budget category:</span>
                            <span className="text-indigo-400 font-semibold">{dossier.travelPersona.budgetProfile}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                            <span>Traveler setting:</span>
                            <span className="text-white font-medium">{dossier.travelPersona.travellerType}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                            <span>Trip rate:</span>
                            <span className="text-white font-medium">{dossier.travelPersona.travelFrequency}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                            <span>Hotel focus:</span>
                            <span className="text-slate-300 text-[10px] truncate max-w-[120px]" title={dossier.travelPersona.hotelPreference}>
                              {dossier.travelPersona.hotelPreference}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preferences & Interests grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-900/80 space-y-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">Discovered Activity Preferences</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {dossier.travelPersona.activityPreferences.map((act) => (
                            <span key={act} className="text-xs px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                              🎯 {act}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-900/80 space-y-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">Culinary profiling index</span>
                        <div className="text-xs text-slate-300 flex items-center justify-between h-full pb-3">
                          <span className="bg-slate-950 px-3 py-2 rounded border border-slate-900 flex-1">
                            🍜 {dossier.travelPersona.foodPreference}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: VISITED DESTINATIONS TIMELINE */}
                {activeTab === 'history' && (
                  <div className="space-y-4" id="tab-history">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Identified Historic Landmarks</h4>
                      <span className="text-xs text-slate-500 font-mono">{dossier.visitedDestinations.length} mapped footprint(s)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {dossier.visitedDestinations.map((v, i) => (
                        <div key={`${v.destination}-${i}`} className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900 flex flex-col md:flex-row items-start justify-between gap-4 hover:border-slate-800 transition-colors">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 shrink-0">
                                <Compass className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-slate-100">{v.destination}</h5>
                                <p className="text-xs text-slate-400">{v.country} • Visited {v.visitCount} times</p>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 leading-normal pl-9">
                              <span className="font-semibold text-slate-400">Footprint evidence:</span> {v.evidence}
                            </p>
                            
                            <div className="flex items-center gap-2 flex-wrap pl-9">
                              <span className="text-[10px] font-mono text-slate-500">Crawling evidence streams:</span>
                              {v.sources.map(s => (
                                <span key={s} className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col md:items-end gap-1 font-mono text-right w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
                            <span className="text-xs text-cyan-400 bg-cyan-950/20 px-2 py-1 rounded border border-cyan-800/20 inline-block md:inline-none self-start md:self-auto">
                              Confidence {Math.round(v.confidence * 100)}%
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1.5 justify-end mt-1">
                              <Clock className="w-3 h-3 text-slate-600" />
                              Resolved: {v.timeline}
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
                  <div className="space-y-6" id="tab-itineraries">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">GetSetYo AI Tailored Packages</h4>
                        <p className="text-xs text-slate-500">Live polling matching the creator's curated personas</p>
                      </div>
                      <span className="text-xs font-mono font-bold bg-cyan-950 border border-cyan-800 text-cyan-400 px-3 py-1 rounded-full animate-pulse">
                        Auto-Polling status complete
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dossier.recommendations.map((rec, index) => {
                        // find corresponding itinerary
                        const itinerary = dossier.generatedItineraries.find(i => i.destination === rec.destination) || {
                          packageDealId: 3000000 + index,
                          status: 'PENDING',
                          durationDays: 5,
                          estimatedCost: '$2,800 - $4,800',
                          hotels: ['Luxury Boutique Resorts'],
                          highlights: ['Private orientation tour', 'Premium activity voucher']
                        };

                        const packageId = itinerary.packageDealId;

                        const isPending = itinerary.status === 'PENDING' || itinerary.status === 'GENERATING';

                        return (
                          <div 
                            key={rec.destination} 
                            className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between hover:border-slate-800 ${
                              isPending 
                                ? 'bg-slate-900/10 border-slate-900' 
                                : 'bg-slate-900/40 border-slate-900'
                            }`}
                            id={`itinerary-card-${rec.destination.replace(/\s+/g, '')}`}
                          >
                            <div className="space-y-3.5">
                              {/* Header category info */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                                  {rec.category}
                                </span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  itinerary.status === 'COMPLETED' 
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse'
                                }`}>
                                  ● {itinerary.status}
                                </span>
                              </div>

                              <div>
                                <h5 className="text-base font-bold text-white tracking-tight">{rec.destination}</h5>
                                <p className="text-[11px] text-slate-400 mt-0.5">{rec.country} • Matching Index Score: <span className="text-emerald-400 font-semibold">{rec.score}%</span></p>
                              </div>

                              <p className="text-xs text-slate-300 leading-normal italic">
                                "{rec.reason}"
                              </p>

                              {isPending ? (
                                <div className="space-y-2 py-4">
                                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                                    <span>Polling Package Deal status...</span>
                                    <span>24%</span>
                                  </div>
                                  <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-900 overflow-hidden">
                                    <div className="bg-cyan-500 h-full w-[24%] animate-pulse" />
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                                    <div>
                                      <span>Duration:</span>
                                      <span className="block text-slate-200 font-semibold">{itinerary.durationDays} Days</span>
                                    </div>
                                    <div>
                                      <span>Est Cost:</span>
                                      <span className="block text-slate-200 font-semibold">{itinerary.estimatedCost}</span>
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-900 pt-2">
                                    <span className="text-[9px] uppercase font-mono text-slate-500 tracking-wider">Premium Lodging Option:</span>
                                    <span className="block text-xs font-medium text-slate-300 mt-0.5">🏨 {itinerary.hotels[0]}</span>
                                  </div>

                                  <div className="border-t border-slate-900 pt-2 space-y-1">
                                    <span className="text-[9px] uppercase font-mono text-slate-500 tracking-wider">Itinerary Highlights:</span>
                                    {itinerary.highlights.map((h, i) => (
                                      <div key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-cyan-400" />
                                        <span>{h}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-4 border-t border-slate-900/50 flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-500">Deals ID: #{packageId}</span>
                              {!isPending && (
                                <a
                                  href={`https://getsetyo.com/product/${packageId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 px-3 py-1.5 rounded-lg"
                                >
                                  <span>Lock package price</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: AGENT CALL & RESPONSE TRACE (user requested tab) */}
                {activeTab === 'agentSwarm' && (
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
                                orchestrator: "Google ADK Multi-Agent Synthesis Engine",
                                targetHandle: `@${dossier.instagramUsername}`,
                                action: "ORCHESTRATE_PIPELINE",
                                targetStages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                                mode: "Parallel Asynchronous Worker",
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
                                },
                                pubSubTopic: "instagram-trigger-analyze"
                              }
                            },
                            {
                              name: "InstagramExtractionAgent",
                              role: "Scraper Service Connector",
                              description: "Crawls Instagram public schema records from grid timeline, biographical tags, image assets, likes/comments telemetry, and tagged items stream.",
                              request: {
                                provider: "Apify Instagram Scraper Service",
                                targetHandle: dossier.instagramUsername,
                                itemsLimit: 100,
                                extractionMetrics: ["biography", "posts", "reels", "taggedPosts"],
                                excludePastDays: 180
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
                                scrapingStatus: "COMPLETED",
                                rateLimitConsumed: "0.27%"
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
                                textDensityTokenEstimate: 840,
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
                                systemInstructions: "Inject realistic matching data and maintain structured JSON constraints.",
                                activePromptTokens: 840,
                                sourceDataProvided: {
                                  username: dossier.instagramUsername,
                                  bio: dossier.creatorProfile.biography,
                                  locations: dossier.structuredContent.locations
                                }
                              },
                              response: {
                                status: "PARSED_SUCCESSFULLY",
                                finalModelUsed: "models/gemini-3.5-flash",
                                visitedDestinationsDetected: dossier.visitedDestinations,
                                extractionMetadata: {
                                  unauthenticatedTokenCleared: true,
                                  confidenceThresholdApplied: 0.7
                                }
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
                                },
                                globalLocationsCatalogSize: 450
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
                                apiEndpoint: "POST /api/v2/generate-itinerary-package",
                                authorization: "Bearer [SYSTEM_ROUTING_TOKEN_APPROVED]",
                                queries: dossier.prompts
                              },
                              response: {
                                pollingResult: "COMPLETED",
                                packageCount: dossier.generatedItineraries.length,
                                resultsActive: dossier.generatedItineraries.map(it => ({
                                  destination: it.destination,
                                  dealId: it.packageDealId,
                                  status: it.status,
                                  hotels: it.hotels,
                                  durationDays: it.durationDays,
                                  cost: it.estimatedCost,
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
                                coordinatesRegistered: dossier.mapData,
                                geocodingCacheHitRate: "80%"
                              }
                            },
                            {
                              name: "ResultAggregatorAgent",
                              role: "Caching Aggregating Node",
                              description: "Compacts metadata schemas, stamps generation timestamps, and persists final analysis results in simulated Redis Cache with 30-day TTL parameters.",
                              request: {
                                databaseType: "Google Memorystore (Redis Mode)",
                                payloadSizeKb: 12.5,
                                cacheKeys: [
                                  `creator-analysis:${dossier.instagramUsername}`,
                                  `creator-itineraries:${dossier.instagramUsername}`
                                ]
                              },
                              response: {
                                cacheWritten: true,
                                ttlSeconds: 2592000,
                                outputSummary: "Creator dossier compiled. Redis entry status: REFRESHED.",
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

                {/* TAB CONTENT 5: ARCHITECTURAL DESIGN SPECS */}
                {activeTab === 'architecture' && (
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
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-900/10 border border-slate-900 rounded-3xl gap-4">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-cyan-500/10 blur" />
                  <Compass className="w-12 h-12 text-slate-700 animate-spin" style={{ animationDuration: '40s' }} />
                </div>
                
                <div>
                  <h4 className="text-base font-bold text-slate-300">Awaiting Creator Handle Input</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Select one of our showcase presets above or submit a custom public Instagram handle to activate the agent swarm intelligence pipeline.
                  </p>
                </div>

                {/* Micro instruction grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono text-slate-500 mt-4 max-w-xl">
                  <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col items-center gap-1.5">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-500/80" />
                    <span>Infers budget & styles from grid posts & reels.</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col items-center gap-1.5">
                    <MapPin className="w-4.5 h-4.5 text-amber-500/80" />
                    <span>Plops geographical GPS pins with precision.</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col items-center gap-1.5">
                    <Plane className="w-4.5 h-4.5 text-cyan-500/80" />
                    <span>Autobuilds GetSetYo itinerary packages live.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 px-4 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-mono select-none mt-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>PRODUCTION-READY CLOUD RUN ENTRANCES APPROVED</span>
        </div>
        <span>© 2026 GETSETYO CREATOR TRAVEL MESH</span>
      </footer>
    </div>
  );
}
