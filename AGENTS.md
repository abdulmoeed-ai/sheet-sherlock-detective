# AGENTS.md

## Project

Sheet Sherlock frontend lives in this directory and runs with Bun.

## Commands

- Install dependencies: `bun install`
- Start dev server: `bun dev`
- Run tests: `bun test`
- Build: `bun run build`

## Branch Discipline

- Do not make implementation changes on `main`.
- Create a separate feature branch from `dev` for every frontend feature.
- Merge completed frontend feature branches back into `dev` only after relevant tests and build checks pass.

## Local Development

The frontend dev server is expected at `http://localhost:8080/` when started locally.

## UI Direction

- Keep the product in light mode.
- Do not introduce dark sections, dark panels, or dark page treatments unless the user explicitly asks for a dark-mode feature.
