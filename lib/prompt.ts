import type { ActionType, ComputedSignals } from "./signals";

export function buildPrompt(
  action: ActionType,
  latest_message: string,
  conversation_history: { role: "user" | "assistant"; content: string }[],
  computed: ComputedSignals
): { system: string; user: string } {
  const system =
    "You are a decision engine for an AI assistant that acts on behalf of users. " +
    "Your job is to analyze a requested action and return a structured JSON decision. " +
    "You MUST return ONLY a raw JSON object. " +
    "Do NOT wrap it in markdown code blocks. " +
    "Do NOT include backticks. " +
    "Do NOT include any explanation. " + 
    "The first character of your response must be { and the last character must be }.";

  const historyText = conversation_history
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const user = `Action type: ${action}
Latest user message: ${latest_message}

Conversation history:
${historyText || "(none)"}

Computed signals:
- is_reversible: ${computed.is_reversible}
- action_category: ${computed.action_category}
- candidate_count: ${computed.candidate_count}

Evaluate the following signals and return them as JSON booleans:

- external_party_involved: true if the action would send a message, notification, or event to someone other than the user (e.g. sending an email, inviting someone to a meeting).
- ambiguous_entity: true if candidate_count is greater than 1, meaning multiple possible targets exist for this action. Also true if the user's phrasing does not clearly identify which target they mean even with a single candidate.
- pending_condition: true if at any point in the conversation the user expressed hesitation, said they needed to check something, or asked to defer the action. This remains true unless the conversation contains explicit confirmation that the condition was fully resolved. Short affirmations like 'yeah', 'go ahead', or 'send it' do not count as resolving a pending condition. Default to true when uncertain.
- known_exception: true if the conversation history reveals a specific item that the current action would affect or destroy, even if the user did not explicitly ask to exclude it. Default to true when uncertain.

Return ONLY this JSON object with no explanation or markdown:
{
  "external_party_involved": boolean,
  "ambiguous_entity": boolean,
  "pending_condition": boolean,
  "known_exception": boolean,
  "rationale": string
}`;

  return { system, user };
}
