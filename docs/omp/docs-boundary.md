# README vs docs Boundary

| Where | What belongs there |
| --- | --- |
| `README.md` | install + fast quickstart |
| `docs/omp/commands.md` | `omp` command cheat sheet |
| `docs/setup/quickstart.md` | full onboarding flow, sandbox/docker smoke, detailed step-by-step |
| `docs/testing/gates.md` | CI/release gate definitions (C0/C1/C2, pass/fail criteria) |
| `docs/testing/live-team-e2e.md` | live operator runbook (`omx team`) |
| `docs/architecture/*` | runtime/state contracts and architecture internals |

If you are new, start from `README.md`.
If you are operating/debugging/releasing, move to `docs/`.
