import Anthropic from "@anthropic-ai/sdk";
import { computeSignals } from "@/lib/signals";
import type { ActionType } from "@/lib/signals";
import { applyPolicy } from "@/lib/policy";
import type { LLMSignals } from "@/lib/policy";
import { buildPrompt } from "@/lib/prompt";

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json();
  const {
    action,
    latest_message,
    conversation_history,
    candidate_count,
    clarification_attempts,
  }: {
    action: ActionType;
    latest_message: string;
    conversation_history: { role: "user" | "assistant"; content: string }[];
    candidate_count: number;
    clarification_attempts: number;
  } = body;

  const computed = computeSignals(action, candidate_count);
  const { system, user: userPrompt } = buildPrompt(
    action,
    latest_message,
    conversation_history,
    computed
  );

  let rawModelOutput: string;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    rawModelOutput = (message.content[0] as { type: string; text: string }).text;
  } catch {
    return Response.json({
      error: "llm_timeout",
      decision: "confirm",
      reason: "Defaulting to confirm due to LLM failure",
    });
  }

  let llmSignals: LLMSignals & { rationale: string };
  try {
    llmSignals = JSON.parse(rawModelOutput);
  } catch {
    return Response.json({
      error: "malformed_output",
      decision: "confirm",
      reason: "Defaulting to confirm due to malformed model output",
    });
  }

  const { decision, reason } = applyPolicy({
    ...computed,
    ...llmSignals,
    clarification_attempts,
  });

  return Response.json({
    decision,
    reason,
    computed_signals: computed,
    llm_signals: llmSignals,
    prompt_sent: userPrompt,
    raw_model_output: rawModelOutput,
    rationale: llmSignals.rationale,
  });
}
