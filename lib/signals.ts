export type ActionType =
  | "send_email"
  | "delete_emails"
  | "schedule_meeting"
  | "cancel_meeting"
  | "set_reminder";

export type ComputedSignals = {
  is_reversible: boolean;
  action_category: ActionType;
  candidate_count: number;
};

export function computeSignals(action: ActionType, candidateCount: number): ComputedSignals {
  return {
    is_reversible: action !== "send_email" && action !== "delete_emails",
    action_category: action,
    candidate_count: candidateCount,
  };
}
