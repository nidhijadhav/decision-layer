import type { ActionType } from "./signals";

export type Scenario = {
  id: string;
  title: string;
  description: string;
  action: ActionType;
  latest_message: string;
  conversation_history: { role: "user" | "assistant"; content: string }[];
  candidate_count: number;
  clarification_attempts: number;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "s1",
    title: "Reminder: Housing Application",
    description: "User wants a reminder set for an upcoming housing application deadline.",
    action: "set_reminder",
    latest_message: "remind me to submit my housing application by Friday at 5pm",
    conversation_history: [],
    candidate_count: 1,
    clarification_attempts: 0,
  },
  {
    id: "s2",
    title: "Study Room Booking",
    description: "User confirms booking a study room after the assistant found an available slot.",
    action: "schedule_meeting",
    latest_message: "ok schedule it",
    conversation_history: [
      { role: "user", content: "can you book a study room at the library for thursday 3pm" },
      { role: "assistant", content: "I found one available — shall I book it?" },
    ],
    candidate_count: 1,
    clarification_attempts: 0,
  },
  {
    id: "s3",
    title: "Ambiguous Email: Two Drafts",
    description: "User asks to send an email but two drafts exist, making the target ambiguous.",
    action: "send_email",
    latest_message: "send it",
    conversation_history: [
      { role: "user", content: "draft an email to my professor asking for a deadline extension" },
      { role: "assistant", content: "Done, draft saved." },
      { role: "user", content: "also draft a reply to my TA about the homework question" },
      { role: "assistant", content: "Done, draft saved." },
    ],
    candidate_count: 2,
    clarification_attempts: 0,
  },
  {
    id: "s4",
    title: "Ambiguous Cancel: Two Meetings",
    description: "User wants to cancel a meeting but has two scheduled tomorrow.",
    action: "cancel_meeting",
    latest_message: "cancel my meeting tomorrow",
    conversation_history: [
      { role: "user", content: "what do i have tomorrow" },
      { role: "assistant", content: "You have a 1:1 with your research advisor at 10am and a club officer meeting at 4pm." },
    ],
    candidate_count: 2,
    clarification_attempts: 0,
  },
  {
    id: "s5",
    title: "Professor Email: Pending Condition",
    description: "User confirmed sending but previously paused to check a policy, leaving a pending condition.",
    action: "send_email",
    latest_message: "yeah go ahead",
    conversation_history: [
      { role: "user", content: "draft an email to Prof. Chen requesting an incomplete grade" },
      { role: "assistant", content: "Draft ready." },
      { role: "user", content: "wait let me check the incomplete policy first" },
      { role: "assistant", content: "Of course, take your time." },
    ],
    candidate_count: 1,
    clarification_attempts: 0,
  },
  {
    id: "s6",
    title: "Delete Registrar Emails: Known Exception",
    description: "User wants registrar emails deleted but previously flagged a financial aid email to keep.",
    action: "delete_emails",
    latest_message: "just clean up everything from the registrar",
    conversation_history: [
      { role: "user", content: "my inbox is so cluttered with registrar emails" },
      { role: "assistant", content: "I can clean those up for you." },
      { role: "user", content: "wait i need to find my financial aid disbursement email from last week" },
      { role: "assistant", content: "Got it, I'll hold off." },
    ],
    candidate_count: 1,
    clarification_attempts: 0,
  },
];
