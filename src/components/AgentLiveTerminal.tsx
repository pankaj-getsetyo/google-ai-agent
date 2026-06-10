import { useEffect, useRef } from "react";
import { AgentLog } from "../types";
import { Sparkles, Layers } from "lucide-react";

interface AgentLiveTerminalProps {
  logs: AgentLog[];
  status: 'running' | 'completed' | 'failed' | 'idle';
}

const agentLabels: Record<AgentLog['agentName'], string> = {
  PlannerAgent: 'Planning',
  InstagramExtractionAgent: 'Reading profile',
  ContentStructuringAgent: 'Structuring',
  TravelDetectionAgent: 'Detecting travel',
  TravelPersonaAgent: 'Travel style',
  RecommendationAgent: 'Recommending',
  PromptGenerationAgent: 'Composing',
  ItineraryGenerationAgent: 'Building trips',
  MapAgent: 'Mapping',
  ResultAggregatorAgent: 'Finishing up'
};

export default function AgentLiveTerminal({ logs, status }: AgentLiveTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, logs[logs.length - 1]?.id]);

  return (
    <div className="flex flex-col h-full bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm" id="agent-terminal-card">
      <div className="flex items-center px-5 py-4 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-brand-500" strokeWidth={1.5} />
          <span className="text-sm font-medium text-stone-800 tracking-wide">Live activity</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto max-h-[240px] md:max-h-[420px] scrollbar-thin text-[12px] leading-relaxed select-text space-y-3">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 py-12 gap-3 text-center">
            <Layers className="w-7 h-7 text-stone-300" strokeWidth={1.25} />
            <span className="text-xs text-stone-400 max-w-[180px]">Enter a handle to start crafting your trips.</span>
          </div>
        ) : (
          <>
            {logs.map((log) => {
              const label = agentLabels[log.agentName] || 'System';
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3"
                  id={`terminal-log-${log.id}`}
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-brand-600">{label}</span>
                      <span className="text-[10px] text-stone-400 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="text-stone-600 break-words leading-snug mt-0.5">{log.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-400 select-none">
        <span className="tracking-wide">GetSetYo Concierge</span>
        <div>
          {status === 'running' && <span className="text-brand-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" /> Working…</span>}
          {status === 'completed' && <span className="text-green-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Ready</span>}
          {status === 'failed' && <span className="text-red-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Failed</span>}
          {status === 'idle' && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" /> Idle</span>}
        </div>
      </div>
    </div>
  );
}
