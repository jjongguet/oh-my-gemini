# OmG-Native Canonical 01 — Decision, Scope, and Adoption Principles

Status: **Canonical (authoritative)**  
Date: 2026-03-02  
Scope: OmG adoption of OmC/OmX strengths for **team orchestration** and **agent role/skill execution**.

## 1) Final decision (single source of truth)

OmG will adopt an **adapt-not-copy** strategy:

1. Adopt OmX-grade control-plane rigor (claim/lease/transition/mailbox lifecycle semantics).
2. Adapt OmC/OmX role workflow discipline into OmG’s extension-first UX.
3. Preserve OmG core identity:
   - extension-first,
   - tmux-default runtime,
   - deterministic durable state,
   - verify-gated release discipline.

## 2) Canonical scope

In scope:

- Team lifecycle operator commands: `run`, `status`, `resume`, `shutdown`
- Control-plane mutation APIs for task lifecycle integrity
- Worker protocol contract enforcement (ACK -> claim -> execute -> result -> idle)
- Role/skill contract v1 with evidence artifacts
- CI gate expansion and rollout governance

Out of scope (for this cycle):

- Full OmC/OmX command-surface parity
- Bulk import of 30+ external skill catalogs
- Default-on subagents strictness before evidence model is stable

## 3) Non-negotiable invariants

1. **Lifecycle invariants**: task lifecycle fields must be mutated only via control-plane APIs.
2. **Protocol invariants**: workers that skip ACK/claim/evidence/idle are non-compliant.
3. **Evidence invariants**: role execution without required artifacts cannot be marked complete.
4. **Compatibility invariants**: migration is additive-first; legacy reads remain supported during transition.
5. **Operational invariants**: operators can manage teams using OmG-native commands only (no OmX fallback dependency).

## 4) Contradictions resolved

This canonical set resolves prior drift as follows:

- Phase model is fixed to **Phase 0..5** (six phases total).
- Rollout terminology is fixed to **Ring 0..3**.
- Gate naming is fixed to **C0..C7** (C0/C1/C2 existing + C3..C7 new adoption gates).
- Initial role set is fixed to **planner, executor, verifier**.
- Initial skill set is fixed to **plan, team, review, verify, handoff**.

## 5) Canonical precedence

If another adoption doc conflicts with this document or Canonical 02..07, this canonical set wins.
