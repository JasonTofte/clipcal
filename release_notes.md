# Release Notes

## v1.0.1 — 2026-04-11

### Collaborator Setup Guide

Added `COLLABORATOR_SETUP.md` at the repository root — a standalone onboarding guide that takes a new contributor from a fresh Windows machine to a running development environment in approximately 15 minutes.

**What it covers:**

- Prerequisite checks (Node.js 20+, npm, Git for Windows)
- GitHub CLI installation and authentication via `gh auth login`
- Collaborator invitation acceptance
- Repository clone via `gh repo clone`
- `npm install` with warning vs. error guidance
- `.env.local` creation with `git check-ignore` verification step
- Dev server launch and API key validation via flyer upload test
- Daily git workflow: pull, branch conventions, staged commits, push, PR
- Project tour: tech stack, key files, "Inform, don't decide" design principle
- 11-row troubleshooting table covering common failure modes
- Commands reference for git and npm operations

**Why Markdown:** the guide is authored in Markdown so it renders natively on GitHub, preserves exact code block characters for PowerShell commands (Word smart-quotes break shell commands), and is trivially convertible to `.docx` or PDF via pandoc if a non-technical format is needed.

**Target audience:** new collaborators onboarding to the hackathon project, particularly Windows users who need a step-by-step walkthrough rather than expecting them to piece together the setup from the `README.md`.
