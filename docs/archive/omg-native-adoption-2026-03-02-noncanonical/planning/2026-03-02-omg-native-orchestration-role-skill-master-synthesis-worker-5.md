# Master synthesis: OmG-native adoption of OmC/OmX team orchestration + role/skill capabilities (Worker 5)

Date: 2026-03-02  
Author: worker-5  
Status: Proposal-ready (analysis + migration + phased plan + risk + rollout + task graph)

Supporting docs:

- Analysis deltas: `docs/analysis/2026-03-02-omg-native-adoption-delta-analysis-worker-5.md`
- Migration constraints + risk register: `docs/planning/2026-03-02-omg-native-migration-constraints-risk-register-worker-5.md`
- Phased plan + gates + ralplan tasks: `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md`

---

## 1) Final recommendation

Adopt a **hybrid strategy**:

1. **Preserve OmG identity** (extension-first, typed runtime/state contracts, tmux default).
2. **Import OmX control-plane rigor** (team lifecycle commands, claim/transition discipline, protocol enforcement).
3. **Import OmC stage + role governance** (explicit stage handoffs, role-specialized outputs, verify-linked evidence).
4. **Bind everything to release gates** so completion truthfulness cannot regress.

This path gives OmG operational parity without turning OmG into a clone of OmC/OmX.

---

## 2) Concrete differences and architectural deltas

## 2.1 Key differences today

1. OmG has clean orchestration internals but a smaller operator command surface (`team run` only).
2. OmG has rich role catalog data but shallow role/skill execution contract.
3. OmG has strong gate docs, but live operator runbook still leans on OmX command path for lifecycle e2e evidence.
4. OmG still carries legacy success toggles that can weaken completion truth.

## 2.2 Target architecture delta

From:

```text
CLI(team run) -> TeamOrchestrator -> RuntimeBackend -> TeamStateStore
```

To:

```text
CLI(run/status/resume/shutdown)
  -> TeamControlPlane
    -> TeamOrchestrator (execution lifecycle)
    -> TeamStateStore (single mutation authority)
    -> RuntimeBackend adapter
  -> RoleSkillContractRegistry (role -> artifact -> verify)
```

Result:

- operational controls become first-class,
- state mutation invariants are enforceable,
- role/skill usage produces verifiable artifacts.

---

## 3) Migration constraints (must shape design)

1. Additive-first CLI evolution (do not break `team run`).
2. Dual-read compatibility window for state/env migration.
3. Single-write canonical path for task lifecycle updates.
4. Subagents stays opt-in until parity criteria pass.
5. Existing C0/C1/C2 release gates remain mandatory.

---

## 4) Phased execution summary

1. **Phase 0**: contract lock (control-plane, worker protocol, role-skill schema)
2. **Phase 1**: lifecycle command MVP (`status/resume/shutdown`) + control-plane scaffold
3. **Phase 2**: worker protocol enforcement (ACK/claim/result/idle)
4. **Phase 3**: role/skill operationalization (core role mapping + extension skills + artifacts)
5. **Phase 4**: reliability + deprecation hardening (legacy toggle sunset, namespace migration)
6. **Phase 5**: rollout + GA cleanup

---

## 5) Acceptance criteria (global)

A release can claim parity progress only if all are true:

1. OmG can start, observe, resume, and shutdown teams natively.
2. Worker lifecycle violations fail deterministically with explicit reasons.
3. Required role artifacts are emitted and verified.
4. Legacy success shortcuts cannot pass release gates.
5. Operator runbooks and live e2e evidence are OmG-native.

---

## 6) Test and CI gate strategy

- Keep existing C0/C1/C2 gates.
- Add adoption gates:
  - **A1** lifecycle command contract
  - **A2** control-plane integrity
  - **A3** worker protocol enforcement
  - **A4** role/skill evidence compliance
  - **A5** deprecation safety

No phase is complete unless its associated adoption gate passes.

---

## 7) Risk register summary

Highest-priority risks:

1. direct lifecycle write bypass (integrity risk)
2. env namespace migration regressions (`OMX_*` -> `OMG_*`)
3. role catalog vs skill/runtime mapping drift
4. status truth mismatch vs actual worker health
5. false-green completion via legacy compatibility toggles

Mitigation pattern:

- enforce single mutation authority,
- dual-read + telemetry for migration windows,
- schema-validated role artifacts,
- strict gate promotion path (warn -> block).

---

## 8) Rollout strategy

1. Internal feature-flag rollouts
2. Canary with selected team workloads
3. Soft default with rollback path
4. GA strict mode
5. Post-GA compatibility cleanup

Rollback triggers include lifecycle instability, worker bootstrap regressions, or completion-truth incidents.

---

## 9) Ralplan-ready decomposition (execution package)

Use the task graph in:

- `docs/planning/2026-03-02-omg-native-phased-execution-gates-and-ralplan-worker-5.md`

Immediate start set (P0-critical):

- RP-01 control-plane contract spec
- RP-04/05/06 lifecycle command parsers
- RP-07 control-plane service scaffold
- RP-11/RP-12 worker protocol enforcement
- RP-18/RP-19 lifecycle + protocol tests

These tasks deliver the fastest path to credible lifecycle parity and truth-preserving orchestration.

---

## 10) Go/No-Go decision criteria

**Go** when:

- lifecycle commands and worker protocol are implemented and gate-backed,
- verify stage cannot pass without concrete runtime + role evidence,
- canary telemetry shows stable operations.

**No-Go** when:

- any legacy bypass remains release-eligible,
- role evidence contracts are missing for required roles,
- status output cannot be trusted under failure scenarios.

---

## 11) Bottom line

OmG should grow as an **OmG-native control-plane product**:

- not a feature clone,
- not a thin wrapper,
- but a deterministic, extension-first team orchestration system with role-aware, evidence-backed execution semantics.
