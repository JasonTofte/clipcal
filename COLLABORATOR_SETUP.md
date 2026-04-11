# ClipCal — Collaborator Setup Guide

> Welcome to the ClipCal hackathon project. This guide walks you from a fresh Windows machine to a running development environment and your first contribution. Should take about 15 minutes end-to-end if Node.js is already installed.

**Project:** [ClipCal](https://github.com/JasonTofte/clipcal) — AI-powered flyer → calendar web app
**Stack:** Next.js 16 · TypeScript · Tailwind 4 · shadcn/ui · Claude Haiku 4.5 via Vercel AI SDK
**Hackathon window:** April 10–13, 2026

---

## Before you begin

You should have received from Jason:
1. A **GitHub collaborator invitation** to `JasonTofte/clipcal` (check your email or https://github.com/notifications)
2. An **Anthropic API key** (sent via Signal, 1Password, or similar — not email)

If you are missing either, stop here and message Jason before continuing.

---

## Prerequisites

Open **PowerShell** (not as Administrator) and run these three commands to check what you already have:

```powershell
node --version
npm --version
git --version
```

**Required versions:**

| Tool | Minimum | Install from |
|---|---|---|
| Node.js | 20.0+ | https://nodejs.org (download the LTS installer, click Next through everything) |
| npm | 10.0+ | Ships automatically with Node.js |
| Git for Windows | 2.40+ | https://git-scm.com/downloads/win |

If any command errors or shows a version below the minimum, install or upgrade the missing tool before continuing. If you have questions about Node upgrade paths, ping Jason — do not proceed with an outdated Node version, it will cause confusing errors later.

---

## Step 1 — Install the GitHub CLI

The GitHub CLI (`gh`) is the easiest way to authenticate your machine with GitHub. It stores a credential in Windows Credential Manager that Git then picks up automatically for clones and pushes. Without it, you would have to manually create a Personal Access Token and configure Git's credential helper — a 20-minute headache.

```powershell
winget install --id GitHub.cli
```

**Close and reopen PowerShell** after the install finishes, then verify:

```powershell
gh --version
```

You should see a version number (e.g., `gh version 2.x.x`). If the command is not found, the install did not complete or PATH was not refreshed — close the terminal fully and open a new one.

---

## Step 2 — Authenticate with GitHub

```powershell
gh auth login
```

You will be prompted in sequence. Answer as follows:

| Prompt | Answer |
|---|---|
| What account do you want to log into? | `GitHub.com` |
| What is your preferred protocol for Git operations? | `HTTPS` |
| Authenticate Git with your GitHub credentials? | `Yes` |
| How would you like to authenticate? | `Login with a web browser` |

The CLI displays an 8-character code like `ABCD-1234`. Copy it, then press **Enter**. Your default browser opens to https://github.com/login/device — paste the code, click **Authorize github**, and close the browser tab.

Back in PowerShell, you should see `✓ Logged in as yourusername`.

**Verify the auth worked:**

```powershell
gh auth status
```

Expected output: `Logged in to github.com account yourusername (keyring)`.

---

## Step 3 — Accept the collaborator invite

If you have not already, go to https://github.com/JasonTofte/clipcal/invitations and click **Accept invitation**. Without accepting, the next step will fail with a 404 — GitHub hides private repositories from non-collaborators.

You only need to do this once. After accepting, you have permanent access until Jason removes you.

---

## Step 4 — Clone the repository

Choose a folder on your machine for the project. A common convention is `Documents\hackathons`:

```powershell
cd $env:USERPROFILE\Documents
mkdir hackathons -Force
cd hackathons
gh repo clone JasonTofte/clipcal
cd clipcal
```

Verify the clone succeeded:

```powershell
ls
```

You should see folders and files including `app`, `components`, `lib`, `package.json`, `README.md`, and `docs`. If you see an empty folder or get a 404 error, your collaborator invite was not accepted yet — go back to Step 3.

---

## Step 5 — Install project dependencies

```powershell
npm install
```

This takes 2–4 minutes. It reads `package.json`, downloads approximately 400 MB of packages (Next.js, React, Tailwind, shadcn, Vercel AI SDK, Claude SDK) into the `node_modules/` folder, and resolves the lockfile.

**You will see warnings.** Warnings about deprecated packages or peer dependency mismatches are normal and can be ignored. Only stop if the command exits with a red **error** message. If that happens, copy the error output and send it to Jason.

---

## Step 6 — Configure your environment file

ClipCal reads secrets from a file called `.env.local` in the repository root. This file is git-ignored, meaning it will never be committed to the repository — that is by design.

**Create the file:**

```powershell
New-Item -ItemType File -Path .env.local
notepad .env.local
```

Notepad opens with an empty file. Paste this line, replacing the placeholder with the actual API key Jason sent you:

```
ANTHROPIC_API_KEY=sk-ant-api03-paste-jasons-key-here
```

Save the file (`Ctrl+S`) and close Notepad.

**Verify the file is gitignored** — this check is important, do not skip it:

```powershell
git check-ignore .env.local
```

- **Expected output:** `.env.local`
- **If you see nothing:** stop and tell Jason. The file is not being ignored and the API key could be committed by accident.

---

## Step 7 — Start the development server

```powershell
npm run dev
```

After 2–5 seconds, you should see output similar to:

```
▲ Next.js 16.x.x (Turbopack)
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
✓ Ready in 2.1s
```

Open your browser to **http://localhost:3000**. You should see the ClipCal home page with a file upload input.

### Test the API key

The core feature of ClipCal is extracting event details from a flyer image using Claude. To confirm the API key is wired up correctly:

1. Find a flyer image — Google "event flyer" and save any result, or use a photo of a real poster
2. Upload it using the input on the page
3. Wait a few seconds

**If it works:** you will see JSON output with fields like `title`, `date`, `time`, `location`, and `category`. Your setup is complete.

**If it fails:** you will see an error mentioning `ANTHROPIC_API_KEY`, `401`, or `unauthorized`. In that case:
- Press `Ctrl+C` in PowerShell to stop the dev server
- Open `.env.local` in Notepad and double-check for typos, extra spaces, or missing characters
- Restart the server with `npm run dev`
- Try the upload again

> **Important:** Next.js reads `.env.local` only at server startup. If you change the file while the dev server is running, the change does not take effect until you restart. This trips up everyone the first time.

---

## Step 8 — Stop the dev server

When you are done working:

1. Click into the PowerShell window
2. Press **Ctrl+C**
3. If prompted `Terminate batch job (Y/N)?`, press `Y` and Enter

Setup is complete. Message Jason when you have successfully run a flyer extraction — that is the signal you are fully operational.

---

# Daily workflow

Once setup is done, your daily loop looks like this.

## Starting a session

```powershell
cd $env:USERPROFILE\Documents\hackathons\clipcal
git checkout main
git pull
npm run dev
```

`git pull` grabs any work Jason or other collaborators pushed since you last synced. **Run it every time you start**, otherwise you will create merge conflicts that are annoying to resolve.

## Creating a new branch for your work

Never commit directly to `main`. Always work on a branch:

```powershell
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**

| Prefix | Use for | Example |
|---|---|---|
| `feature/` | New functionality | `feature/add-photo-upload` |
| `fix/` | Bug fixes | `fix/calendar-timezone-bug` |
| `refactor/` | Code cleanup with no behavior change | `refactor/extract-event-card` |
| `docs/` | Documentation only | `docs/update-readme` |

Use descriptive names. Jason should be able to tell what your branch is about without asking. Avoid names like `feature/work`, `feature/test`, or `my-branch`.

## Making changes and committing

Edit files however you prefer — VS Code, Cursor, Notepad++, any editor works. Once you have made meaningful progress:

```powershell
git status                    # see what changed
git add path/to/file1 path/to/file2    # stage specific files
git commit -m "short description of what this commit does"
```

> **Important:** Avoid `git add .` or `git add -A`. Those stage *everything* including cached files, temp artifacts, or (worst case) `.env.local`. Stage files by name. The extra typing is worth the safety.

Good commit messages describe **what changed and why**, in one short sentence. Examples:

-  `add drag-and-drop support to flyer upload input`
-  `fix timezone offset in extracted event dates`
-  `refactor extraction route to separate parsing from validation`
- Bad: `updates`, `fixes stuff`, `wip`

## Pushing to GitHub

```powershell
git push -u origin feature/your-feature-name
```

The `-u` flag tells Git to track the upstream branch — you only need it the first time you push a new branch. Subsequent pushes on the same branch use plain `git push`.

## Opening a pull request

Two options:

**From the GitHub website:** After pushing, visit https://github.com/JasonTofte/clipcal. GitHub shows a yellow banner with a "Compare & pull request" button. Click it, fill in a title and description, click **Create pull request**.

**From the command line:**

```powershell
gh pr create --title "What this PR does" --body "Longer description of the changes"
```

Jason will review and either merge, request changes, or ask questions. Watch your GitHub notifications.

## Ending a session

```powershell
# Ctrl+C to stop the dev server if it is running
git status     # confirm you have no uncommitted changes you want saved
```

If `git status` shows changes you want to keep, commit them before closing. Uncommitted changes are only on your local machine — a disk failure would lose them.

---

# Project tour

## Tech stack

- **Frontend:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4, shadcn/ui
- **AI:** Claude Haiku 4.5 (primary) with Sonnet 4.5 (fallback) via Vercel AI SDK v6 (`@ai-sdk/anthropic`)
- **Type safety:** Zod schemas validate structured output from Claude
- **Calendar out:** `ics` npm package + Google/Outlook render-URL deeplinks *(coming in Session 3)*
- **Calendar in:** Google Calendar `freebusy.query` *(coming in Session 3)*
- **Persistence:** `localStorage` only — no database, no auth
- **Testing:** Vitest for unit tests
- **Deploy:** Vercel (Jason handles deployments)

## Key files and folders

| Path | What it does |
|---|---|
| `app/page.tsx` | The main landing page you see at http://localhost:3000 |
| `app/api/extract/route.ts` | The server route that sends flyer images to Claude and returns parsed events |
| `lib/schema.ts` | Zod schemas defining the shape of extracted event data |
| `lib/schema.test.ts` | Unit tests for the schemas (run with `npm test`) |
| `components/ui/` | shadcn primitives (buttons, cards, inputs, badges) — do not edit these directly |
| `docs/brief.md` | The product brief. **Read this before you start coding.** |
| `docs/` | All project documentation |
| `mockups/index.html` | Static HTML mockups showing three design directions |
| `README.md` | High-level project overview |

## Design principle — read this before you code

ClipCal's core design principle is **"Inform, don't decide."**

The app surfaces trade-offs (`12-min walk · first open Sat · ends after your 8am class`) so the user can make a better decision themselves — it never auto-rejects events, never nags, never shames. This is grounded in cognitive offloading research (Risko & Gilbert 2016) and the Ottawa Decision Support Framework.

Most non-obvious design decisions trace back to this principle. If you propose a feature that makes choices *for* the user (auto-declining conflicting events, hiding flyers below a relevance threshold, gamification streaks), Jason will push back and explain why. Save yourself a round-trip by reading `docs/brief.md` first.

## Where to ask questions

Ping Jason directly on whatever channel you normally use. For a three-day hackathon, async chat beats trying to document every edge case upfront.

---

# Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `claude: command not found` | PATH not refreshed after install | Close and reopen PowerShell |
| `npm install` errors with EACCES or permission denied | Node was installed as Administrator | Reinstall Node as your regular user |
| `npm run dev` errors `Module not found` | Dependency install incomplete | Run `npm install` again |
| Page loads but flyer upload returns 401 or "unauthorized" | API key not loading | Check `.env.local` for typos, restart the dev server |
| Page loads but flyer upload hangs forever | Network or API timeout | Check your internet connection, try a different flyer |
| `git push` prompts for username and password | `gh auth login` did not complete | Run `gh auth status`, re-authenticate if needed |
| Tailwind styling looks broken or unstyled | Cached build artifacts | Delete the `.next` folder, rerun `npm run dev` |
| `git pull` fails with "merge conflict" | You and Jason edited the same lines | **Stop and ask Jason.** Do not try to resolve blindly |
| `git check-ignore .env.local` prints nothing | `.gitignore` does not cover it | **Stop and tell Jason immediately** — do not commit |
| `npm run dev` fails with `EADDRINUSE` | Port 3000 already in use | Run `npm run dev -- -p 3001` or close the other process |

## Useful commands reference

```powershell
# Check which branch you are on
git branch --show-current

# See what you have changed but not committed
git status
git diff

# See recent commit history
git log --oneline -10

# Undo changes to a file you have not committed yet
git checkout -- path/to/file

# Pull latest main into your feature branch
git checkout main
git pull
git checkout feature/your-branch
git merge main

# Delete a local branch you no longer need (after PR is merged)
git branch -d feature/old-branch

# List all dev server processes (if something seems stuck)
Get-Process node

# Run the unit tests
npm test
```

---

# Security notes

- **Never commit `.env.local`.** The `.gitignore` file protects against this, but verify with `git check-ignore .env.local` after any setup.
- **Never screenshot or paste the API key** into anything public — issue tracker, Slack channel, PR description, commit message.
- **If you think the key has been exposed**, tell Jason immediately. He can revoke and rotate it.
- **Do not install npm packages casually.** New dependencies expand the supply chain attack surface. If a task seems to need a new package, ask Jason first.

---

# Reference links

- **Repository:** https://github.com/JasonTofte/clipcal
- **Issues:** https://github.com/JasonTofte/clipcal/issues
- **Pull requests:** https://github.com/JasonTofte/clipcal/pulls
- **Next.js docs:** https://nextjs.org/docs
- **Tailwind 4 docs:** https://tailwindcss.com/docs
- **shadcn/ui components:** https://ui.shadcn.com
- **Vercel AI SDK docs:** https://sdk.vercel.ai/docs
- **Anthropic API reference:** https://docs.claude.com/en/api/overview

---

*Last updated: April 2026 · Hackathon build*
