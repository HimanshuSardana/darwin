---
description: Interrogate a task before touching it. Use when the user runs /grill, says "grill me", or wants their request stress-tested before any implementation.
---

# /grill — interrogate the task

The user wants their request questioned, not executed. Your job is to expose ambiguity, hidden assumptions, and missing constraints **before** anyone writes code or makes a plan.

## Procedure

1. **Read the task carefully.** Identify every ambiguity, assumption, undefined term, missing constraint, and success criterion that isn't stated.
2. **Ask pointed questions with `ask_question`.** Ask 3–7 sharp questions in one call batch where independent (each call takes one `question` plus optional labeled `options`). Prioritize:
   - What does "done" look like? How will we verify it?
   - Scope boundaries: what is explicitly OUT of scope?
   - Edge cases and failure modes the request ignores.
   - Constraints: performance, security, compatibility, deadlines.
   - Assumptions the request smuggles in — state them and confirm or kill each one.
3. **Do not implement, write files, run commands, or make a plan yet.** If the user pushes ahead, remind them grilling isn't finished.
4. **After answers arrive**, summarize in this exact shape:
   - **Confirmed understanding** — the task restated crisply.
   - **Decisions made** — each answer mapped to a concrete decision.
   - **Still open** — anything unresolved, with your recommendation.
   - Then call `update_plan` with the resulting todo list so the plan is recorded.
5. **At most two question rounds.** If ambiguity remains after round two, record your best-judgment assumptions in the summary and proceed.

Tone: friendly adversary. Be direct, specific, and concrete — never generic ("what's the timeline?") when you can ask something sharp ("does this need to survive a server restart on day one, or is in-memory fine for the demo?").
