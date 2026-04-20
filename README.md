# Execution Decision Layer

A prototype decision engine that determines when an AI assistant should act silently, notify after acting, confirm before acting, ask a clarifying question, or refuse — given a proposed action and its conversation context.

Live: [decision-layer-livid.vercel.app](https://decision-layer-livid.vercel.app)

---

## What This Is

Most AI assistant prototypes treat execution as the default. This one treats it as a decision. Every proposed action passes through an explicit decision layer before anything happens — a pipeline that computes signals, reasons over context, and applies a deterministic policy to produce a verdict.

The core design principle is borrowed from Sun (2026): *stochastic signals should be separated from the policy that maps them to actions.* When assessment and action are fused inside a single LLM call, failures are opaque and hard to fix. When they're separated, failures are attributable, meaning you can point to exactly which signal was wrong and fix it without touching anything else.

---

## Signals

The system computes five signals before making any decision. They split cleanly into two categories.

**Computed by code (deterministic):**

- `is_reversible` — a lookup table by action type. Sending an email is always irreversible. Setting a reminder is always reversible. This never requires reading the conversation.
- `action_category` — the type of action being requested (send_email, delete_emails, schedule_meeting, cancel_meeting, set_reminder).
- `candidate_count` — the number of possible targets the action could apply to, computed from the data layer.

**Computed by LLM (contextual):**

- `external_party_involved` — whether the action affects someone other than the user. Action type alone doesn't tell you this — scheduling a meeting could be a personal time block or a calendar invite to your advisor.
- `ambiguous_entity` — whether the target of the action is unresolved. Uses `candidate_count` as a hard signal (>1 means ambiguous) but also asks the model to check whether conversation context resolves it.
- `pending_condition` — whether the user placed a hold or condition on the action that hasn't been explicitly resolved. Short affirmations like "yeah go ahead" do not count as resolution. Default: true when uncertain.
- `known_exception` — whether the conversation reveals a specific item that the current action would affect or destroy, even if the user didn't explicitly ask to exclude it. Default: true when uncertain.

The reason for this split is simple: some questions have objectively correct answers that don't require reading the conversation. Others require genuine judgment over context. Mixing them degrades both.

---

## Code vs. LLM Responsibility

**Code decides:**
- Whether an action is reversible
- Whether multiple candidates exist
- Which policy branch to apply given the signals
- What counts as an escalation (clarification attempts exhausted)

**LLM decides:**
- Whether an external party is involved given the conversation
- Whether the target is ambiguous given context
- Whether a pending condition exists and remains unresolved
- Whether a known exception is present

The model never decides the final action. It fills in four boolean signals. The policy function applies those signals deterministically. This means the same signals always produce the same decision — the LLM introduces uncertainty only in signal estimation, not in control.

---

## Policy

Rules are applied in priority order:

```
if pending_condition        → confirm
if known_exception          → confirm
if ambiguous_entity
  and attempts < 2          → clarify
  and attempts >= 2         → escalate
if not is_reversible        → confirm
if external_party_involved  → execute and notify
else                        → execute silently
```

The ordering matters. A pending condition blocks execution regardless of whether the action is reversible or involves an external party. Ambiguity is resolved before risk is assessed. Escalation is a loop exit condition, not a primary signal — it triggers only after clarification has been attempted and failed.

One additional behavior: if a user overrides a pending condition with an ambiguous affirmation, the system proceeds but appends a soft warning. This respects user autonomy while preserving alfred_'s role as a thoughtful assistant rather than a rubber stamp.

---

## Prompt Design

The system prompt instructs the model to return only raw JSON — no markdown, no explanation, first character `{`, last character `}`. The user prompt injects:

- The action type and latest message
- Full conversation history formatted as role: content pairs
- The three computed signals (is_reversible, action_category, candidate_count)
- Definitions for each of the four LLM signals, written to be conservative by default

The definitions for `pending_condition` and `known_exception` explicitly instruct the model to default to true when uncertain. This is intentional — the cost of a false positive (an unnecessary confirmation) is much lower than the cost of a false negative (an irreversible action taken on a misread context).

The model's output is stripped of any accidental markdown fences before parsing, and the full prompt and raw output are logged and exposed in the UI pipeline trace.

---

## Failure Modes

**LLM timeout** — if the Anthropic API call fails or times out, the system returns `decision: confirm` with a logged error. Default safe behavior avoids irreversible execution under uncertainty.

**Malformed model output** — if the response can't be parsed as JSON, same fallback: `decision: confirm`. A regex strip handles accidental markdown fences before the parse attempt.

**Missing critical context** — if conversation history is absent, the LLM signals default conservatively. `pending_condition` and `known_exception` both default to false when there's nothing to evaluate, but `ambiguous_entity` still fires if `candidate_count > 1`.

**Signal estimation failure** — the model can misread a pending condition as resolved, particularly when a user's follow-up message resembles a confirmation. This is the hardest failure mode to catch because it's a judgment call, not a format error. The current mitigation is conservative signal definitions that require explicit resolution evidence.

All three failure paths are visible in the UI. The simulate failure button triggers a malformed request and renders the error state inline.

---

## How This Evolves With Riskier Tools

This prototype implements one slice of a larger agentic loop. Specifically, it is the **Confidence Gate** — the control point that sits between planning and execution:

```
TRIGGER SOURCES  →  PERCEPTION  →  PLANNING  →  [CONFIDENCE GATE]  →  EXECUTION  →  OBSERVATION
```

As the assistant gains riskier tools, each surrounding layer needs to mature alongside the gate.

**Perception Layer.** Right now the system receives a clean `action` and `latest_message`. In production, the perception layer parses raw triggers (e.g. an email arrives, a calendar event changes, a webhook fires) and normalizes them into a structured event schema before the decision layer sees them. It also handles entity resolution: matching "Sarah" in a message to a known contact node with relationship strength, meeting history, and response time signals. The confidence gate is only as good as the context it receives.

**Planning Layer.** The current system assumes the action is already determined. A planning layer generates candidate actions, scores them, and builds a structured plan object (including fallback plans) before handing off to the gate. Plans are typed: single-step, sequential multi-step, branching, or parallel. Error handling and rollback strategy differ across these types. The gate treats each sub-plan independently, not the master plan as a whole.

**Confidence Gate (this prototype).** The current signal schema covers the most common risk dimensions: reversibility, external party involvement, ambiguity, pending conditions, and known exceptions. As action categories expand to other domains, the schema needs corresponding signals. A financial action needs an `amount_threshold` signal. Anything touching external legal relationships needs a `stakeholder_impact` signal. The architecture supports this cleanly because signals and policy are already separated: adding a new signal doesn't change the policy function.

The gate outcomes should also expand beyond the current five. A production gate distinguishes between:

```
confidence > 0.85  AND  autonomy_tier = auto    →  execute silently
confidence 0.70–0.85                            →  fast-track (30s undo window)
confidence 0.50–0.70                            →  warn + wait (explicit confirm)
confidence < 0.50                               →  surface + clarify (one question)
irreversible action                             →  always explicit confirm, regardless of confidence
```

**Execution Layer.** The current system flags `is_reversible` but can't actually undo anything. A production execution layer captures rollback state before any tool call, runs a circuit breaker across multi-step plans (partial execution is worse than no execution), and tracks every side effect in an audit log. If step 3 of 4 fails, steps 1 and 2 are rolled back. If rollback itself fails, the user is immediately notified with a full audit trail.

**Observation Layer.** Every execution is logged as a structured episode: what triggered it, what signals fired, what decision was made, how the user responded, what the outcome was. This episode log feeds two things: a consolidation process that promotes recurring patterns into standing rules, and an autonomy score that tracks per-action-category trust over time. Consecutive confirmations nudge the score up; rejections and modifications nudge it down. When a score crosses a tier threshold, the system proposes an autonomy upgrade rather than applying it silently.

---

## What I'd Build Next

The current system is stateless — each evaluation is independent, and every user gets the same policy. That's the right place to start, but it's not where this ends.

The most interesting next layer is a **per-user trust model** that lives alongside the signal layer and evolves the policy thresholds over time. Not a black-box score — a structured history: action category × signal pattern × outcome × whether the user overrode a recommendation. The policy then becomes dynamic:

```python
def compute_gate_confidence(plan, context, user_profile):
    return weighted_score({
        "rule_coverage":        coverage_score(plan, user_profile.l3_rules),
        "episode_consistency":  episode_agreement_rate(plan, user_profile.l2),
        "autonomy_tier":        user_profile.autonomy_registry[plan.action_category],
        "action_reversibility": reversibility_score(plan.action),
        "relational_confidence": user_profile.l4_trust_score(plan.entities),
    })
```

A user who has confirmed 50 low-risk actions correctly gets a lower confirmation threshold for those actions. A user who has had false negatives — irreversible actions taken on misread context — gets a higher one. The thresholds shift per user, per action category, over time.

The harder problem is the **sycophancy trap**: an agent that only does what you confirm stops proposing anything you might disagree with. It becomes a yes-machine. The mitigation is to explicitly track cases where the agent was right but overridden — and if downstream signals show the user reversed course (re-opened the meeting, un-archived the email), surface that pattern: *"You've overridden this three times and then reversed — want to let me handle it?"* Trust should be bidirectional.

The other thing I'd build is **confidence calibration**. As the rule base grows, confidence scores drift artificially high — the agent becomes overconfident. A periodic calibration check compares predicted confidence against actual confirmation rates. If the agent is 85% confident but only confirmed 60% of the time, the scoring weights recalibrate. This is the difference between a system that stays reliable over time and one that degrades silently.

None of this changes the core architecture — signals separate from policy, policy deterministic given signals, LLM filling in context-dependent signals only. That separation is what makes all of it improvable without breaking everything else.

---

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Anthropic API (claude-sonnet-4-5)
- Deployed on Vercel

---

## References

Sun, W. (2026). *Decision-Centric Design for LLM Systems.* IBM Research. arXiv:2604.00414v1.

*Built as part of an application challenge for alfred_, an AI assistant that manages email, calendar, and scheduling on behalf of users.*