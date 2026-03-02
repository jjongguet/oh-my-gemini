# OmG-native Capability Delta Matrix (OmG vs OmX/OmC) — 2026-03-02

## 0) 목적

마스터 문서의 결론을 구현 가능한 델타 항목으로 분해한다. 각 항목은 **현재 근거(As-Is)**, **목표 상태(To-Be)**, **구현 포인트**, **검증 포인트**를 가진다.

---

## 1) Command Surface Delta

| Delta ID | As-Is (OmG) | Reference Strength (OmX/OmC) | To-Be (OmG-native) | Primary Files |
|---|---|---|---|---|
| CMD-01 | `team run`만 공식 지원 | OmX `team status/resume/shutdown` | `team status/resume/shutdown` 추가 | `src/cli/index.ts`, `src/cli/commands/*` |
| CMD-02 | top-level 5 command | OmX 14 known commands / OmC 24 declarations | 기능 추가보다 team 운영명령 우선 | `src/cli/index.ts` |
| CMD-03 | extension team 명령 2개(run/subagents) | OmC/OmX는 실행 모드 다양 | extension 명령에 status/resume/shutdown 추가 | `extensions/oh-my-gemini/commands/team/*` |

Acceptance checks:

- CLI help/README/docs 명령 표면 동기화
- `--json` 출력 스키마 고정
- 잘못된 인자에 대해 exit code `2` 유지

---

## 2) Task Lifecycle + State Mutation Delta

| Delta ID | As-Is | Gap | To-Be | Verification |
|---|---|---|---|---|
| STATE-01 | `writeTask(expectedVersion)` 존재 | claim/transition API 전면 강제 없음 | `claimTask/transition/release` 도입 | CAS mismatch, lease expiry, claim conflict 테스트 |
| STATE-02 | task schema에 claim 필드 있음 | lifecycle와 claim token 결합 약함 | status 전이는 claim token 필수 | invalid transition deterministic fail |
| STATE-03 | monitor checklist는 task 상태 참조 | transition audit trail 제한적 | task history/audit 강화 | `team-state-store-contract` 확장 |
| STATE-04 | mailbox ndjson append 지원 | notified/delivered 상태 API 표준 부족 | mailbox lifecycle API 표준화 | mailbox dedupe/replay tests |

Key compatibility constraints:

- canonical 파일명 유지: `tasks/task-<id>.json`
- legacy read compatibility 유지: `tasks/<id>.json`, `mailbox/<worker>.json`
- phase legacy normalize 유지: `complete -> completed`

---

## 3) Worker Protocol Delta

| Delta ID | As-Is | To-Be | Expected Signal |
|---|---|---|---|
| WORKER-01 | tmux pane dispatch 중심 | ACK->claim->execute->result->idle 프로토콜 강제 | mailbox `worker_ack`, task claim token, status idle |
| WORKER-02 | worker bootstrap command 자유도 높음 | inbox 기반 프로토콜 준수 여부 검사 | non-compliant worker는 health fail |
| WORKER-03 | heartbeat/status merge 있음 | reasonCode taxonomy 추가 | dead/non-reporting/root-cause 분류 정확도 향상 |

---

## 4) Role/Skill Delta

| Delta ID | As-Is (OmG) | OmX/OmC reference | To-Be (OmG-native) |
|---|---|---|---|
| ROLE-01 | subagent role 선택 가능 | 역할+스킬 다수 + 실행 규약 | 핵심 role set(3~6개) output contract 고정 |
| ROLE-02 | extension skill `plan` 중심 | OmX/OmC 30+ skills | `plan + execute + verify + review + handoff` 최소셋 |
| ROLE-03 | role assignment는 있으나 artifact contract 약함 | role별 evidence 관례 존재 | role별 artifact schema + 위치 규약 |
| ROLE-04 | unified model 유지 | OmX도 unified principle 보유 | unified model 유지 + 정책 provenance 기록 |

Recommended minimum role contract v1:

- planner: work breakdown, dependencies, acceptance criteria
- executor: implementation diff summary + commands/evidence
- verifier: PASS/FAIL, regression status, retry recommendation
- reviewer(optional): severity-tagged findings

---

## 5) Runtime Backend Delta

| Delta ID | tmux backend | subagents backend | To-Be |
|---|---|---|---|
| RT-01 | 실실행 + pane 상태 기반 | deterministic completed snapshot 성향 | subagents도 in-progress/blocked/fail semantics 확보 |
| RT-02 | verifyBaselinePassed = terminal completion 중심 | verifyBaselinePassed=true 단순화 경향 | role artifact 기반 verify gate 판정 |
| RT-03 | shutdown 경로 있음 | context cleanup 중심 | status/resume/shutdown 공통 contract로 통합 |

---

## 6) Security/Trust Boundary Delta

| Delta ID | As-Is | To-Be |
|---|---|---|
| SEC-01 | sanitize/normalize가 분산 | team/worker/task id regex를 중앙 계약화 |
| SEC-02 | legacy compatibility env 존재 | legacy env 사용 시 이벤트 감사 + release gate 차단 |
| SEC-03 | state root 접근 통제가 약함 | allowlist/trusted-root 정책 명문화 |

---

## 7) CI/Test Gate Delta

| Delta ID | Existing Gate | Needed Expansion |
|---|---|---|
| QA-01 | C0/C1/C2 + reliability suite 존재 | lifecycle command(status/resume/shutdown) 통합 테스트 추가 |
| QA-02 | team-state-store contract tests 있음 | claim/lease/transition guard 정식 테스트군 추가 |
| QA-03 | subagents backend tests 존재 | role artifact contract + truthfulness tests 추가 |
| QA-04 | verify baseline strictness 있음 | legacy bypass ON 상태를 release gate에서 실패 처리 |

---

## 8) Priority-Ordered Delta Execution

1. **P0 (무결성)**: CMD-01, STATE-01/02, WORKER-01
2. **P1 (실효성)**: ROLE-01/02/03, RT-01
3. **P2 (운영성)**: SEC-01/02/03, QA-03/04
4. **P3 (확장성)**: advanced skills, optional model policy modes, richer telemetry

Cross-link:

- 상세 실행 계획: `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md`
- ralplan 태스크 분해: `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`
