---
name: project-memory
description: Keep persistent project memory for VaceUp — read the decision log at session start and record every user decision and mid-code change before finishing. Use at the start and end of every working session in this repository, especially when continuing work another agent started.
invocation: model
---

# Skill: Project Memory

Decisions made with the user must survive across agents, sessions and weeks. One file carries that memory:

- `.agents/project-memory.md` — the durable log: standing decisions, mid-code changes, and open threads, newest first.

## At session start (required)

1. Read `.agents/project-memory.md` in full before planning any work.
2. Treat its Decision entries as standing decisions. Never re-litigate or silently reverse one. If the user asks for a change of direction, apply it and record the reversal as a new entry with a reason.
3. Check Open threads — unfinished work or promises from earlier sessions may belong to this one.

## While working

4. When the user states a preference, correction or product decision mid-session ("make it a pop-up", "keep that optional", "we grade manually"), apply it immediately AND note it for the log. The user should never have to re-explain the same decision to a different agent.

## Before finishing (required)

5. Append a dated entry to `.agents/project-memory.md`, newest first, with three short sections:
   - **Decision** — what the user chose, one line each, in their intent (not implementation detail).
   - **Changed** — what was edited mid-code (file or area, what and why), one line each.
   - **Open** — anything started but unfinished, promised, or waiting on the user.
6. Keep entries short. No secrets, credentials or account names. No emoji. Never delete or rewrite earlier entries — append or add a dated reversal.
