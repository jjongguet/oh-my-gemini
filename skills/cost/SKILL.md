---
name: cost
aliases: ["/cost", "token usage", "usage cost", "show spend"]
primaryRole: analyst
description: "Summarize token usage, API costs, and spending trends across daily, weekly, or monthly windows. Use when the user asks 'how much did I spend', 'token usage', 'usage stats', 'billing summary', or wants to review cost trends and session-level spend breakdowns."
---

# Cost Skill (oh-my-gemini)

Use this skill when the user wants visibility into usage volume, API spend, or cost trends.

## Commands

```bash
omg cost                    # default summary
omg cost --period daily     # last 24 hours
omg cost --period weekly    # last 7 days
omg cost --period monthly   # last 30 days
```

### When to use each period

- **Daily** — debugging recent sessions or checking today's usage.
- **Weekly** — tracking burn rate during active development sprints.
- **Monthly** — budget planning and reporting.

## Expected output

```
Period: weekly (Mar 18 – Mar 25, 2025)

Tokens     Input: 1,245,600   Output: 312,400   Total: 1,558,000
Sessions   12 completed, 2 failed
Trend      ▲ 18% vs previous week

Breakdown:
  team-orchestration    842,000 tokens   (54%)
  interactive-sessions  516,000 tokens   (33%)
  verification-runs     200,000 tokens   (13%)

⚠ Note: Sessions before Mar 10 lack token tracking metadata.
```

## Handling missing data

If output includes a tracking caveat (e.g., older sessions without metrics), explain to the user that earlier runs may not have recorded usage and recommend `omg doctor` to verify tracking is configured.

## Related surfaces

- `/omg:sessions` — session-level detail and run history
- `/omg:hud` — live dashboard with real-time token counters
- `/omg:status` — current orchestration state and active cost

Task: {{ARGUMENTS}}
