import type { ComputedSignals } from "./signals";

export type Decision =
  | "execute_silently"
  | "execute_and_notify"
  | "confirm"
  | "clarify"
  | "escalate";

export type LLMSignals = {
  external_party_involved: boolean;
  ambiguous_entity: boolean;
  pending_condition: boolean;
  known_exception: boolean;
};

export type PolicyInput = ComputedSignals & LLMSignals & {
  clarification_attempts: number;
};

export function applyPolicy(input: PolicyInput): { decision: Decision; reason: string } {
  if (input.pending_condition) {
    return { decision: "confirm", reason: "Action has a pending condition" };
  }
  if (input.known_exception) {
    return { decision: "confirm", reason: "A known exception applies" };
  }
  if (input.ambiguous_entity && input.clarification_attempts < 2) {
    return { decision: "clarify", reason: "Entity is ambiguous and clarification attempts remain" };
  }
  if (input.ambiguous_entity && input.clarification_attempts >= 2) {
    return { decision: "escalate", reason: "Entity is ambiguous and clarification attempts exhausted" };
  }
  if (!input.is_reversible) {
    return { decision: "confirm", reason: "Action is not reversible" };
  }
  if (input.external_party_involved) {
    return { decision: "execute_and_notify", reason: "External party is involved" };
  }
  return { decision: "execute_silently", reason: "Action is safe to execute without notification" };
}
