# OmG-native Canonical C2 — Decision and Parity Principles

Date: 2026-03-02  
Status: Authoritative

---

## 1) Final strategic decision

OmG will use **adopt-and-adapt**, not clone:

- Adopt OmX control-plane rigor (claim/lease/transition/release discipline).
- Adapt OmC/OmX role-skill workflow discipline to OmG extension-first UX.
- Preserve OmG identity: tmux default backend, subagents opt-in, verify-first quality gates.

---

## 2) Adopt / adapt / defer matrix

| Domain | Decision | Canonical parity expectation |
|---|---|---|
| Lifecycle operator commands | Adopt now | `omg team status`, `omg team resume`, `omg team shutdown` added without breaking `team run` |
| Task lifecycle mutation APIs | Adopt now | claim/transition/release become only legal lifecycle mutation path |
| Worker protocol enforcement | Adopt now | ACK -> claim -> execute -> result -> idle enforced deterministically |
| Role output schemas | Adopt now (v1) | `planner`, `executor`, `verifier` schema-validated artifacts are mandatory |
| Extension orchestration skills | Adapt now | first-wave `plan`, `team`, `review`, `verify`, `handoff` |
| Subagent runtime realism | Adapt in phases | no production-complete claim without evidence artifacts |
| Large command/skill breadth parity | Defer | no broad command/catalog cloning this cycle |

---

## 3) Non-negotiable parity principles

1. **Control-plane first:** lifecycle safety before UX expansion.
2. **Protocol over prompting:** worker correctness must be state-machine enforced, not best-effort instructions.
3. **Evidence-backed completion:** completion requires terminal-state legality + verify evidence + role artifacts.
4. **Additive compatibility:** preserve readable legacy state while introducing canonical write behavior.
5. **Docs-help-prompt lockstep:** command behavior, CLI help, docs, extension prompts must ship together.

---

## 4) Contradictions resolved in this canonical set

| Conflict seen in source docs | Canonical resolution |
|---|---|
| 5-phase vs 6-phase vs 7-phase plans | Fixed to 6 phases (0..5) |
| role set includes `reviewer` in some drafts | mandatory role set = `planner`, `executor`, `verifier`; `reviewer` optional |
| skill set variants (`execute` vs `executor`) | skill set fixed to `plan`, `team`, `review`, `verify`, `handoff` |
| mixed gate naming (`R*`, `C*`) | gate taxonomy fixed to C0..C7 (C0..C2 existing, C3..C7 adoption) |
| lifecycle semantics spread across raw writes and API ideas | lifecycle mutations must flow through control-plane API only |

---

## 5) Program definition of done

Adoption is complete when all are true:

1. OmG supports operator lifecycle commands (`run/status/resume/shutdown`).
2. Lifecycle mutations are control-plane mediated and claim-token protected.
3. Worker protocol violations are rejected and surfaced with reason codes.
4. Role workflows produce schema-valid durable evidence.
5. C3..C7 gates block regressions before release.
