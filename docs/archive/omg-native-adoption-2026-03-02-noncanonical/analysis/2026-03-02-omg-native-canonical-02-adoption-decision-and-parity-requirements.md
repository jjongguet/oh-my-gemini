# OmG-native Adoption Decision and Parity Requirements

Date: 2026-03-02  
Canonical ID: C2  
Scope: final product/architecture decisions for adopting OmC/OmX team-orchestration and role/skill strengths in OmG

---

## 1) Executive decision

OmG will **adopt control-plane rigor**, **adapt role/skill operating patterns**, and **reject command-surface sprawl**.

The target is:

- OmG remains **extension-first**,
- `tmux` remains the **default backend**,
- `subagents` remains **opt-in**,
- release quality remains **verify-gated**,
- team execution semantics become **claim/transition/evidence driven**.

---

## 2) Adopt / adapt / reject matrix

| Area | Decision | Canonical rule |
|---|---|---|
| Team lifecycle commands | Adopt+adapt | Add `status/resume/shutdown`, but keep OmG CLI minimal |
| Task lifecycle control plane | Adopt | Introduce first-class `claimTask`, `transitionTaskStatus`, `releaseTaskClaim` semantics |
| Worker bootstrap protocol | Adopt | Enforce ACK -> claim -> execute -> report -> idle |
| Role/skill execution model | Adapt | Start with `planner`, `executor`, `verifier`; optional `reviewer` later |
| Extension skill surface | Adapt | Minimum skill band: `plan`, `execute`, `review`, `verify`, `handoff` |
| Subagents backend depth | Adapt in stages | Artifact-truthful first, live delegation later |
| Full OmX/OmC command breadth | Reject for now | No parity chase beyond team orchestration and role/skill necessities |
| Per-role model heterogeneity | Reject for v1 | Preserve unified-model default until justified by evidence |

---

## 3) Product invariants that must not regress

| ID | Requirement |
|---|---|
| INV-01 | OmG must continue to feel like a Gemini-native, extension-first product. |
| INV-02 | `omg team run` must remain backward compatible while new lifecycle commands are added. |
| INV-03 | `.omg/state/team/<team>/...` remains the canonical state root and path family. |
| INV-04 | `tmux` stays default; `subagents` never becomes default before parity gates are green. |
| INV-05 | Existing C0/C1/C2 quality posture remains mandatory. |
| INV-06 | State/schema evolution remains additive and backward-readable. |

---

## 4) Concrete parity requirements

### 4.1 Team lifecycle parity

| ID | Requirement | Implementation consequence | Verification consequence |
|---|---|---|---|
| PAR-CLI-01 | OmG **must** add `omg team status`. | Add CLI handler and extension command surface. | Integration tests for text + JSON output. |
| PAR-CLI-02 | OmG **must** add `omg team resume`. | Rehydrate from persisted team state. | Integration tests for resumable + non-resumable cases. |
| PAR-CLI-03 | OmG **must** add `omg team shutdown`. | Support graceful and force shutdown with coherent state writes. | Integration + live smoke evidence. |
| PAR-CLI-04 | OmG **must not** add unrelated top-level command sprawl in this cycle. | Limit change set to lifecycle-critical commands. | Docs/help drift review. |

### 4.2 Control-plane parity

| ID | Requirement | Implementation consequence | Verification consequence |
|---|---|---|---|
| PAR-STATE-01 | New lifecycle writes **must** flow through claim/transition/release APIs. | No new direct task status overwrite paths. | Reliability tests for illegal bypass attempts. |
| PAR-STATE-02 | Task claims **must** issue token+lease metadata. | Control-plane module and task schema support lease expiry. | Claim conflict and stale-lease tests. |
| PAR-STATE-03 | Status transitions **must** validate legal from->to edges. | Explicit transition matrix in code/contracts. | Invalid-transition tests. |
| PAR-STATE-04 | Dependency-blocked tasks **must not** be claimable. | Dependency-readiness check before claim success. | Deterministic blocked-claim tests. |
| PAR-STATE-05 | Mailbox delivery lifecycle **must** be explicit. | Standardize list/mark-notified/mark-delivered helpers. | Mailbox replay/dedupe tests. |

### 4.3 Worker protocol parity

| ID | Requirement | Implementation consequence | Verification consequence |
|---|---|---|---|
| PAR-WORKER-01 | Every worker **must** ACK before task execution. | Runtime bootstrap writes identity and ACK. | Live smoke and protocol tests. |
| PAR-WORKER-02 | Every worker **must** claim before in-progress work. | Dispatch path blocked until claim success. | Missing-claim failure tests. |
| PAR-WORKER-03 | Every worker **must** emit structured completion evidence. | Result schema enforced in worker template/runtime helpers. | Evidence-missing rejection tests. |
| PAR-WORKER-04 | Every worker **must** write terminal idle/fail state. | Worker status helper standardization. | Monitor snapshot consistency tests. |

### 4.4 Role/skill parity

| ID | Requirement | Implementation consequence | Verification consequence |
|---|---|---|---|
| PAR-ROLE-01 | OmG v1 **must** support `planner`, `executor`, `verifier`. | Role registry and contract schema. | Contract tests for required fields. |
| PAR-ROLE-02 | Core role outputs **must** be artifact-backed, not nominal. | Deterministic artifact locations and schemas. | Artifact discovery/validation tests. |
| PAR-ROLE-03 | Verifier output **must** be able to fail the run. | Orchestrator completion logic checks verifier artifacts. | Negative-path reliability tests. |
| PAR-ROLE-04 | Minimum extension skill set **must** be `plan`, `execute`, `review`, `verify`, `handoff`. | Expand extension prompts/skills in OmG-native style. | Skill smoke + docs contract checks. |

### 4.5 Runtime truthfulness parity

| ID | Requirement | Implementation consequence | Verification consequence |
|---|---|---|---|
| PAR-RT-01 | Completion **must not** be inferred from synthetic runtime success alone. | Terminal success requires artifact + task + verification coherence. | False-green prevention tests. |
| PAR-RT-02 | `status` **must** merge persisted state with runtime health truth. | Status command reads phase/tasks/workers/runtime summary together. | Status truth integration tests. |
| PAR-RT-03 | Subagents parity **must** start with truthful artifacts before live delegation claims. | Stage subagents rollout. | Role-artifact gating before defaulting. |

---

## 5) Minimal role contract v1

| Role | Required output |
|---|---|
| `planner` | work breakdown, dependencies, acceptance criteria |
| `executor` | implementation/result summary, changed paths, commands run, evidence |
| `verifier` | PASS/FAIL verdict, regression status, retry recommendation |

Optional later role:

| Role | Deferred use |
|---|---|
| `reviewer` | severity-tagged findings and design/code review evidence |

---

## 6) Non-goals for this cycle

1. Full OmX command catalog parity.
2. Full OmC/OmX skill catalog parity.
3. Per-role model routing complexity.
4. Re-rooting state under a new directory family.
5. Replacing `team run` with a different public entrypoint.

---

## 7) Program-level definition of success

This adoption cycle is successful only when all are true:

1. OmG can start, observe, resume, and shut down teams natively.
2. Task lifecycle concurrency is tokenized, leased, and test-covered.
3. Worker runtime behavior matches documented protocol.
4. Role selection produces usable artifacts and verifier truth.
5. CI/release gates can detect false-green, docs drift, and legacy bypass misuse.

