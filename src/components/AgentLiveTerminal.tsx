import { useEffect, useRef, useState } from "react";
import { AgentLog } from "../types";
import { Terminal, Shield, Play, Pause, RefreshCw, Layers } from "lucide-react";

interface AgentLiveTerminalProps {
  logs: AgentLog[];
  status: 'running' | 'completed' | 'failed' | 'idle';
}

const agentStyles: Record<AgentLog['agentName'], { bg: string; text: string; label: string }> = {
  PlannerAgent: { bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400', label: 'Planner Agent' },
  InstagramExtractionAgent: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', label: 'Instagram Scraper' },
  ContentStructuringAgent: { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-400', label: 'Structurer Agent' },
  TravelDetectionAgent: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'Travel Detector' },
  TravelPersonaAgent: { bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400', label: 'Persona Architect' },
  RecommendationAgent: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Recommend Agent' },
  PromptGenerationAgent: { bg: 'bg-lime-500/10 border-lime-500/30', text: 'text-lime-400', label: 'Prompt Composer' },
  ItineraryGenerationAgent: { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', label: 'GetSetYo Worker' },
  MapAgent: { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', label: 'Map GIS Agent' },
  ResultAggregatorAgent: { bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400', label: 'Aggregator Agent' }
};

export default function AgentLiveTerminal({ logs, status }: AgentLiveTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoscroll, setAutoscroll] = useState(true);

  useEffect(() => {
    if (autoscroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoscroll]);

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl font-mono" id="agent-terminal-card">
      {/* Title block */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <Terminal className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300 tracking-wide">Multi-Agent Consensus Console</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-600/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-600/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-600/60" />
          </div>
          
          <button
            onClick={() => setAutoscroll(!autoscroll)}
            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
              autoscroll 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            AUTOSCROLL
          </button>
        </div>
      </div>

      {/* Terminal Grid */}
      <div className="flex-1 p-3 overflow-y-auto max-h-[220px] md:max-h-[300px] scrollbar-thin text-[11px] leading-relaxed select-text space-y-2">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 py-12 gap-2 text-center">
            <Layers className="w-8 h-8 text-slate-800 animate-pulse-slow" />
            <span className="text-xs">No active execution. Enter a creator handle above to fire.</span>
          </div>
        ) : (
          logs.map((log) => {
            const style = agentStyles[log.agentName] || { bg: 'bg-slate-800', text: 'text-slate-400', label: 'System' };
            return (
              <div 
                key={log.id} 
                className="flex items-start gap-2.5 border-l-2 border-slate-900 pl-2 hover:bg-slate-900/30 py-1 rounded transition-colors"
                id={`terminal-log-${log.id}`}
              >
                <span className="text-slate-600 shrink-0 select-none text-[10px]">{log.timestamp}</span>
                
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded border ${style.bg} ${style.text} font-semibold uppercase tracking-wider scale-95 origin-left`}>
                  {style.label}
                </span>

                <span className="text-slate-300 break-words flex-1 tracking-tight">
                  {log.message}
                </span>

                {log.status === 'running' && (
                  <span className="shrink-0 w-2 h-2 rounded-full bg-cyan-400 animate-ping self-center" />
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* System Status Foot */}
      <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-600" />
          <span>PROT: GOOGLE ADK MULTI-AGENT SWARM v2.5</span>
        </div>
        <div>
          {status === 'running' && <span className="text-cyan-400 animate-pulse">● PIPELINE RUNNING</span>}
          {status === 'completed' && <span className="text-emerald-400">● MESH CONVERGED</span>}
          {status === 'failed' && <span className="text-rose-400">● PIPELINE FAILED</span>}
          {status === 'idle' && <span>● READY</span>}
        </div>
      </div>
    </div>
  );
}
