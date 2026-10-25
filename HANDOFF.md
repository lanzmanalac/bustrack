# Handoff — cloud Agent → local Cursor Agent

**When:** 2026-10-25 (~13:30 UTC+8) · Codex × UX+AI Hackathon  
**Repo:** `lanzmanalac/bustrack` (app name: **SakayKita**)  
**Branch:** `main` @ `86e70f6` (+ skills commit after this handoff)  
**From:** Cursor Cloud / background Agent chat  
**To:** Local Cursor **Agent** chat (skills work there; not in Cloud Agent)

---

## Paste this into local Agent to continue

```
Read HANDOFF.md and AGENTS.md / BUILD_PLAN.md.

Context: we installed Matt Pocock skills in a Cloud Agent chat. Product work is already on main. I want to continue locally with skills enabled.

1. Confirm skills are available (type / and list a few).
2. Run /setup-matt-pocock-skills once for this repo (GitHub issues, triage labels, domain docs).
3. Then run /ask-matt so we pick the right next skill for the hackathon push.
```

---

## What this cloud session actually did

1. Ran `npx skills@latest add mattpocock/skills` — **38 skills** installed under `.agents/skills/`.
2. Mirrored into `.cursor/skills/` (symlinks) and also installed globally on the cloud VM (`~/.cursor/skills/`) — **global cloud install does not transfer to your laptop**; project `.agents/skills/` does, via git.
3. Explained why skills didn’t work in Cloud chat: Cloud/Background Agent has no Skill tool; most Matt skills set `disable-model-invocation: true` and must be invoked with `/skill-name` in local Agent.

**No product/code changes** were made in that cloud chat beyond adding skills + this handoff.

---

## Product state already on `main` (don’t redo)

Already merged / present in the tree:

| Area | Status | Pointers |
|------|--------|----------|
| Scaffold | Done | Vite + React + TS + Tailwind, routes, contracts |
| Commuter home | Done | `src/screens/commuter/*`, fixtures via `?state=` |
| Leave-plan / Plan B logic | Done | `src/logic/*` + tests |
| Route line | Done | `src/components/RouteLine/*`, `/dev/routeline` |
| README for judges | Done | `README.md` |
| Shared plan | Source of truth | `AGENTS.md` / `BUILD_PLAN.md` |

North star: **"When do I leave?"** — track buses, not people. Commuter coords never leave the phone.

Hackathon constraints (from `AGENTS.md`): feature freeze / submission timing — check the plan’s clock; prefer polish, demo, and submission over new scope.

---

## Skills — how to use locally

**Paths (project):** `.agents/skills/<name>/SKILL.md`  
Cursor also accepts that layout (skills.sh: Cursor project path = `.agents/skills/`).

**Invoke in local Agent chat:**

1. Open **Agent** mode (not Ask / not Cloud Agent).
2. Type `/` → pick a skill.
3. First-time repo setup: `/setup-matt-pocock-skills`
4. Router: `/ask-matt`

Useful for this hackathon day:

| Skill | When |
|-------|------|
| `/ask-matt` | Don’t know which skill |
| `/setup-matt-pocock-skills` | Once, before engineering skills |
| `/grill-me` / `/grill-with-docs` | Stress-test plan / demo story |
| `/tdd` | Bugfix or small feature test-first |
| `/diagnosing-bugs` | Something broken/slow |
| `/code-review` | Review since a commit/branch |
| `/pr` | Write PR body |
| `/retro` | After the session |
| `/handoff` | Next transfer |

If `/` shows nothing: `Developer: Reload Window`, confirm `.agents/skills` exists after `git pull`, re-run:

```bash
npx skills@latest add mattpocock/skills -y
# or restore from lockfile:
npx skills@latest experimental_install
```

---

## Suggested skills for the next local session

1. **`setup-matt-pocock-skills`** — wire issue tracker + domain doc layout for this repo.  
2. **`ask-matt`** — choose the right flow for remaining hackathon work.  
3. Likely follow-ups depending on answer: **`grill-me`** (demo/narrative), **`tdd`** / **`diagnosing-bugs`** (fix gaps), **`pr`** (ship), **`retro`** (after submit).

---

## Local bootstrap checklist

```bash
git pull origin main
npm install
npm run dev
# optional: confirm skills
npx skills@latest list
```

Then paste the prompt block at the top of this file into a **new local Agent** chat.

---

## Do not

- Re-install skills only in Cloud Agent and expect `/` to work there.
- Expect cloud VM global skills (`~/.cursor/skills`) to appear on your laptop.
- Expand scope past `AGENTS.md` priorities without an explicit call — submission time matters.
