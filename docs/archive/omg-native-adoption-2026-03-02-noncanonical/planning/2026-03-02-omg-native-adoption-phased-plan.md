# OmG-native Adoption Phased Plan — Team Orchestration + Role/Skill (2026-03-02)

## 0) 목표

OmG를 OmC/OmX와 동급의 팀 오케스트레이션 제품으로 끌어올리되, 다음 원칙을 유지한다.

- extension-first
- tmux-default
- deterministic durable-state
- verify-gated release
- incremental rollout

---

## 1) Phase Plan Overview

| Phase | Goal | Shipping posture | Exit signal |
|---|---|---|---|
| Phase 0 | 상태/계약 설계 잠금 | design-only | schema/API/CLI contract 승인 |
| Phase 1 | team lifecycle control-plane 최소선 | behind feature flags | status/resume/shutdown + claim transition tests pass |
| Phase 2 | role/skill v1 도입 | opt-in beta | planner/executor/verifier artifacts + verify gates pass |
| Phase 3 | subagents truthfulness + tmux parity 개선 | limited rollout | subagents completed 판정이 artifact/health 기반 |
| Phase 4 | docs/CI/GA rollout | default-on candidate | release gate + live team evidence pass |

---

## 2) Phase-by-Phase Execution

## Phase 0 — Design Lock

### Deliverables

- state transition contract (`claim/transition/release`)
- lifecycle CLI JSON schema (`status/resume/shutdown`)
- role artifact schema v1
- feature flag matrix

### Acceptance Criteria

- [ ] 모든 신규 필드가 `docs/architecture/*`에 명시됨
- [ ] 기존 legacy compatibility 정책이 문서화됨
- [ ] release에서 어떤 flag가 default-off인지 합의됨

### Required checks

- 문서 정합성 리뷰
- 변경 없는 상태에서 `npm run typecheck`, `npm run test:reliability`

---

## Phase 1 — Control Plane Minimum Viable Parity

### Scope

1. `omg team status`
2. `omg team resume`
3. `omg team shutdown`
4. `claimTask/transitionTaskStatus/releaseTaskClaim` 도입
5. worker bootstrap protocol enforcement (ACK/claim/result/idle)

### Acceptance Criteria

- [ ] `team status --json`가 phase/task/health/runtime gate를 반환
- [ ] `team resume`가 phase/snapshot 기반 재개 가능
- [ ] `team shutdown`이 graceful 종료 후 state를 반영
- [ ] claim token 없이 lifecycle status 변경 불가
- [ ] lease expiry/claim conflict/CAS mismatch가 deterministic error로 노출

### Test / CI gates

Blocking:

```bash
npm run typecheck
npm run test:reliability
npm run test:integration
npm run verify
```

Additional required coverage:

- lifecycle command integration tests
- claim/transition/release contract tests
- worker protocol negative tests (ACK missing, claim missing)

---

## Phase 2 — Role/Skill v1

### Scope

- core roles: `planner`, `executor`, `verifier`
- core extension skills: `plan`, `execute`, `verify`, `review` or equivalent
- role output/evidence schema 고정

### Acceptance Criteria

- [ ] subagent selection 결과가 runtime metadata + artifacts 양쪽에 남음
- [ ] planner artifact에 decomposition/acceptance criteria 존재
- [ ] executor artifact에 실행 증거(command/output summary) 존재
- [ ] verifier artifact에 PASS/FAIL + regression 판정 존재
- [ ] docs/help/examples가 동일 syntax를 사용

### Test / CI gates

Blocking:

```bash
npm run typecheck
npm run test:integration
npm run test:reliability
npm run verify
```

Additional required coverage:

- tag parsing (`$planner /executor`) contract tests
- explicit `--subagents` worker-count mismatch tests
- artifact schema validation tests

---

## Phase 3 — Runtime Truthfulness Hardening

### Scope

- subagents backend에 in-progress/blocked/failure semantics 추가
- verify baseline을 artifact/health 기반으로 재정의
- legacy bypass 감사/차단

### Acceptance Criteria

- [ ] subagents backend가 무조건 `completed`를 반환하지 않음
- [ ] verify gate는 role artifacts + health + task terminality를 함께 평가
- [ ] `OMG_LEGACY_*` 사용 시 event/state에 감사 흔적 남음
- [ ] release gate에서 legacy bypass ON 상태 실패

### Test / CI gates

Blocking:

```bash
npm run typecheck
npm run test:reliability
npm run test:all
npm run verify
```

Additional required coverage:

- false-green regression tests
- stale heartbeat / non-reporting / dead worker tests on both backends
- artifact missing -> failed verify tests

---

## Phase 4 — Rollout + GA Candidate

### Scope

- docs/README/extension help sync
- live operator runbook 확정
- canary -> beta -> default-on rollout

### Acceptance Criteria

- [ ] `README.md`, `docs/omg/commands.md`, `docs/testing/gates.md`, CLI help 일치
- [ ] live tmux evidence 문서화
- [ ] canary/beta cohort 기준과 rollback 기준 확정
- [ ] publish gate가 신규 기능 계약을 차단 가능

### Test / CI gates

Blocking:

```bash
npm run gate:publish
npm run team:e2e -- "omg-native orchestration rollout smoke"
```

---

## 3) Feature Flag / Rollout Policy

| Capability | Initial state | Beta gate | GA gate |
|---|---|---|---|
| `team status/resume/shutdown` | default-on 가능 | integration pass | release docs synced |
| claim/transition/release enforcement | default-on after Phase 1 | migration compatibility proven | no direct lifecycle writes remain |
| role artifact schema v1 | default-on for subagents only | integration + docs + examples | role-based verify stable |
| subagents truthfulness hardening | default-off at first | reliability + false-green tests pass | live beta evidence pass |

Rollout stages:

1. **Canary**: maintainers only
2. **Beta**: opt-in via feature flags / explicit backend use
3. **Default-on**: tmux path first
4. **GA**: subagents backend once truthfulness criteria met

Rollback rule:

- release-blocking failure, false-green, or state corruption signal 발견 시 즉시 feature flag off.

---

## 4) Risk Register

| Risk ID | Risk | Likelihood | Impact | Mitigation | Trigger |
|---|---|---|---|---|---|
| R1 | direct file writes와 transition API 혼재 | High | High | lifecycle field mutation 금지 + tests | CAS mismatch/ghost transitions |
| R2 | subagents backend false-green | High | High | artifact-based verify + negative tests | completed without evidence |
| R3 | tmux shutdown/resume race | Medium | High | graceful shutdown contract + integration tests | orphan sessions |
| R4 | skill surface 확장으로 문서 drift 증가 | Medium | Medium | docs sync checklist + release gate | README/help mismatch |
| R5 | CI 시간 증가 | Medium | Medium | phased blocking + targeted suites | slow/flake CI |
| R6 | legacy env bypass가 숨어서 릴리즈 | Medium | High | gate failure + audit event | green build with bypass |
| R7 | 역할 수 과잉으로 유지보수 불가 | Medium | Medium | core role set only, later expansion | low adoption/high churn |
| R8 | state schema 변경으로 backward compatibility 손상 | Low | High | additive schema only + legacy read tests | old artifact read failure |

---

## 5) Release/CI Gate Expansion Proposal

### Mandatory CI additions

1. **Lifecycle CLI suite**
   - `team status/resume/shutdown` happy path + invalid input + no-state path
2. **Task lifecycle suite**
   - claim conflict
   - lease expiry
   - invalid from/to transition
   - terminal-phase immutability
3. **Worker protocol suite**
   - ACK missing
   - result missing
   - idle status missing
4. **Truthfulness suite**
   - verify artifact absent => fail
   - runtime says completed but task non-terminal => fail

### Release blocking policy

- any legacy bypass env in CI => fail
- docs/help drift => fail
- subagents deterministic green without artifacts => fail

---

## 6) Definition of Done (Program Level)

The adoption program is done only when all are true:

- [ ] OmG 자체 control-plane가 OmX 수준의 최소 무결성(claim/transition/lease)을 제공
- [ ] lifecycle CLI(`run/status/resume/shutdown`)가 문서/테스트/extension 표면과 동기화
- [ ] role/skill v1이 planner/executor/verifier 기준으로 작동
- [ ] verify gate가 runtime status만이 아니라 evidence truthfulness를 평가
- [ ] C0/C1/C2 + live team evidence가 모두 통과

Cross-link:

- Master synthesis: `docs/analysis/2026-03-02-omg-native-orchestration-role-skill-master-synthesis.md`
- Ralplan-ready tasks: `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`
