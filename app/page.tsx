"use client";

import { useState } from "react";
import { SCENARIOS } from "@/lib/scenarios";
import type { ActionType } from "@/lib/signals";

const ACTION_TYPES: ActionType[] = [
  "send_email",
  "delete_emails",
  "schedule_meeting",
  "cancel_meeting",
  "set_reminder",
];

const DECISION_STYLES: Record<string, { color: string }> = {
  execute_silently:   { color: "#289b45ff" },
  execute_and_notify: { color: "#0014FF" },
  confirm:            { color: "#FF8C00" },
  clarify:            { color: "#FF2D00" },
  escalate:           { color: "#0a0a0a" },
};

const PLAYFAIR = "var(--font-playfair)";

type ApiResult = {
  decision?: string;
  reason?: string;
  computed_signals?: Record<string, unknown>;
  llm_signals?: Record<string, unknown>;
  prompt_sent?: string;
  raw_model_output?: string;
  rationale?: string;
  error?: string;
};

type FormData = {
  action: ActionType;
  latest_message: string;
  conversation_history: string;
  candidate_count: number;
  clarification_attempts: number;
};

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    action: "send_email",
    latest_message: "",
    conversation_history: "[]",
    candidate_count: 1,
    clarification_attempts: 0,
  });

  function selectScenario(id: string) {
    const s = SCENARIOS.find((sc) => sc.id === id);
    if (!s) return;
    setActiveScenario(id);
    setFormData({
      action: s.action,
      latest_message: s.latest_message,
      conversation_history: JSON.stringify(s.conversation_history, null, 2),
      candidate_count: s.candidate_count,
      clarification_attempts: s.clarification_attempts,
    });
    setResult(null);
    setTraceOpen(false);
  }

  async function simulateFailure() {
    setLoading(true);
    setResult(null);
    setTraceOpen(false);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_email",
          latest_message: "",
          conversation_history: "not_an_array",
          candidate_count: 1,
          clarification_attempts: 0,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "network_error", decision: "confirm", reason: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setTraceOpen(false);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: formData.action,
          latest_message: formData.latest_message,
          conversation_history: JSON.parse(formData.conversation_history),
          candidate_count: formData.candidate_count,
          clarification_attempts: formData.clarification_attempts,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "network_error", decision: "confirm", reason: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const decisionKey = result?.decision?.toLowerCase() ?? "";
  const decisionStyle = DECISION_STYLES[decisionKey] ?? DECISION_STYLES.confirm;

  const inputBase =
    "w-full border-2 border-black font-mono text-sm bg-white text-[#0a0a0a] p-2 outline-none focus:border-black";

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] font-sans">

      {/* HEADER */}
      <header className="w-full bg-[#0a0a0a] border-b-2 border-black flex items-center justify-between px-6 py-3">
        <span className="font-mono text-[11px] text-white tracking-widest opacity-60">v1.0</span>
        <span className="font-sans font-bold text-xs text-white uppercase tracking-widest">
          Execution Decision Layer
        </span>
      </header>

      {/* TWO-COLUMN GRID */}
      <div className="flex w-full" style={{ minHeight: "calc(100vh - 52px)" }}>

        {/* LEFT COLUMN — 2/5 */}
        <div className="w-2/5 border-r-2 border-black flex flex-col bg-white">

          {/* Scenarios header */}
          <SectionHeader label="Scenarios" />

          {/* Scenario list */}
          <div className="flex flex-col border-b-2 border-black">
            {SCENARIOS.map((s, i) => {
              const isActive = activeScenario === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s.id)}
                  className="flex items-start gap-3 p-3 border-b border-black text-left transition-colors hover:bg-[#f4f4f4]"
                  style={{
                    borderLeft: isActive ? "4px solid #0a0a0a" : "4px solid transparent",
                  }}
                >
                  <span className="font-mono font-bold text-xs shrink-0 px-1.5 py-0.5 border-2 border-black bg-[#0a0a0a] text-white">
                    {String(i).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="font-sans font-bold text-sm leading-tight">
                      {s.title}
                    </div>
                    <div className="font-mono text-[10px] text-[#666] mt-0.5 leading-snug">
                      {s.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Input header */}
          <SectionHeader label="Input" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-0 flex-1 bg-white">
            <div className="p-3 border-b border-black">
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1 text-[#666]">
                Action
              </label>
              <select
                className={inputBase}
                value={formData.action}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, action: e.target.value as ActionType }))
                }
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="p-3 border-b border-black">
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1 text-[#666]">
                Latest Message
              </label>
              <textarea
                className={`${inputBase} resize-none`}
                rows={2}
                value={formData.latest_message}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, latest_message: e.target.value }))
                }
              />
            </div>

            <div className="p-3 border-b border-black">
              <label className="font-mono text-[10px] uppercase tracking-widest block mb-1 text-[#666]">
                History (JSON)
              </label>
              <textarea
                className={`${inputBase} resize-none`}
                rows={4}
                value={formData.conversation_history}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, conversation_history: e.target.value }))
                }
              />
            </div>

            <div className="flex border-b border-black">
              <div className="flex-1 p-3 border-r border-black">
                <label className="font-mono text-[10px] uppercase tracking-widest block mb-1 text-[#666]">
                  Candidates
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputBase}
                  value={formData.candidate_count}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, candidate_count: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="flex-1 p-3">
                <label className="font-mono text-[10px] uppercase tracking-widest block mb-1 text-[#666]">
                  Clarif. Attempts
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputBase}
                  value={formData.clarification_attempts}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      clarification_attempts: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0a0a0a] text-white font-sans font-bold text-sm uppercase tracking-widest py-4 border-t-2 border-black transition-colors hover:bg-white hover:text-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Evaluate →"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={simulateFailure}
              className="w-full bg-[#FF2D00] text-white font-sans font-bold text-sm uppercase tracking-widest py-4 border-t-2 border-[#FF2D00] transition-colors hover:bg-white hover:text-[#FF2D00] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Simulate Failure →
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN — 3/5 */}
        <div className="w-3/5 flex flex-col bg-white">

          {/* Idle state */}
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 px-12">
              <span className="font-mono text-4xl text-[#0a0a0a] tracking-tight text-center">
                AWAITING INPUT_
              </span>
              <span className="font-mono text-xs text-[#999] uppercase tracking-widest">
                Select a scenario or submit an action
              </span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center flex-1">
              <span className="font-mono text-sm uppercase tracking-widest text-[#0a0a0a]">
                PROCESSING...
              </span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="flex flex-col">

              {/* Error block */}
              {result.error && (
                <div
                  className="bg-[#0a0a0a] text-white border-b-2 border-black px-6 py-5"
                  style={{ borderLeft: "6px solid #FF2D00" }}
                >
                  <div className="font-mono text-xs uppercase tracking-widest text-[#FF2D00] mb-2">
                    ERROR: {result.error}
                  </div>
                  <div className="font-mono text-sm text-white font-bold uppercase tracking-wide mb-1">
                    Fallback: {result.decision?.replace(/_/g, " ")}
                  </div>
                  <div className="font-mono text-xs text-[#aaa]">{result.reason}</div>
                </div>
              )}

              {/* Verdict block */}
              {result.decision && (
                <div
                  className="flex flex-col justify-center px-8 border-b-2 border-black"
                  style={{ borderLeft: `8px solid ${decisionStyle.color}`, minHeight: "200px" }}
                >
                  <div
                    className={`font-black uppercase leading-none tracking-tight mb-3 ${
                      ["execute_silently", "execute_and_notify"].includes(result.decision)
                        ? "text-5xl"
                        : "text-8xl"
                    }`}
                    style={{ fontFamily: PLAYFAIR, color: decisionStyle.color }}
                  >
                    {result.decision.replace(/_/g, "\u00A0")}
                  </div>
                  <div className="font-mono text-sm text-[#0a0a0a]">{result.reason}</div>
                </div>
              )}

              {/* Signal grid */}
              <div className="grid grid-cols-2 border-b-2 border-black">
                <div className="border-r-2 border-black">
                  <SectionHeader label="Computed Signals" />
                  {result.computed_signals &&
                    Object.entries(result.computed_signals).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-4 py-2 border-b border-black">
                        <span className="font-mono text-[11px] uppercase tracking-wide">
                          {k.replace(/_/g, " ")}
                        </span>
                        <SignalBadge value={v} />
                      </div>
                    ))}
                </div>
                <div>
                  <SectionHeader label="LLM Signals" />
                  {result.llm_signals &&
                    Object.entries(result.llm_signals)
                      .filter(([k]) => k !== "rationale")
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-4 py-2 border-b border-black">
                          <span className="font-mono text-[11px] uppercase tracking-wide">
                            {k.replace(/_/g, " ")}
                          </span>
                          <SignalBadge value={v} />
                        </div>
                      ))}
                </div>
              </div>

              {/* Rationale */}
              {result.rationale && (
                <div className="px-5 py-4 border-b-2 border-black border-l-4 border-l-black">
                  <div className="font-sans font-bold text-xs uppercase tracking-wider text-[#0a0a0a] mb-2">
                    Rationale
                  </div>
                  <p className="font-mono text-xs text-[#0a0a0a] leading-relaxed">
                    {result.rationale}
                  </p>
                </div>
              )}

              {/* Pipeline trace toggle */}
              <div className="border-b-2 border-black">
                <button
                  onClick={() => setTraceOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#f4f4f4] transition-colors"
                >
                  <span className="font-sans font-bold text-xs uppercase tracking-wider">
                    Pipeline Trace {traceOpen ? "↑" : "↓"}
                  </span>
                </button>

                {traceOpen && (
                  <div className="flex flex-col border-t-2 border-black">
                    <div className="border-b-2 border-black">
                      <div className="bg-[#0a0a0a] px-4 py-1">
                        <span className="font-mono text-[10px] uppercase text-white tracking-widest">
                          Prompt Sent
                        </span>
                      </div>
                      <pre className="font-mono text-[10px] p-3 bg-white overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {result.prompt_sent}
                      </pre>
                    </div>
                    <div>
                      <div className="bg-[#0a0a0a] px-4 py-1">
                        <span className="font-mono text-[10px] uppercase text-white tracking-widest">
                          Raw Model Output
                        </span>
                      </div>
                      <pre className="font-mono text-[10px] p-3 bg-white overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {result.raw_model_output}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-[#0a0a0a] px-4 py-2">
      <span className="font-sans font-bold text-xs uppercase tracking-wider text-white">
        {label}
      </span>
    </div>
  );
}

function SignalBadge({ value }: { value: unknown }) {
  if (typeof value === "boolean") {
    return (
      <span
        className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 border border-black"
        style={
          value
            ? { background: "#0a0a0a", color: "#ffffff" }
            : { background: "#ffffff", color: "#0a0a0a" }
        }
      >
        {value ? "TRUE" : "FALSE"}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] text-[#555] truncate max-w-[120px]">
      {String(value)}
    </span>
  );
}
