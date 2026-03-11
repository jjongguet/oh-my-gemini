# OmG-native Team Orchestration + Role/Skill Adoption — Master Synthesis (2026-03-02)

## 0) 목적과 결론 요약

이 문서는 `oh-my-gemini (OmG)`가 `oh-my-codex (OmX)`/`oh-my-claudecode (OmC)`의 강점을 가져오되, **OmG 고유 철학(Extension-first + tmux-default + deterministic durable-state + verify-gated delivery)**을 유지하는 통합 설계 결론(SSOT)이다.

핵심 결론:

1. OmG는 **표면(UX)보다 제어면(control-plane) 깊이**를 먼저 올려야 한다.
2. OmX의 팀 상태 API(claim/transition/lease/mailer) 엄격성을 우선 흡수해야 한다.
3. OmC/OmX의 역할/스킬 breadth는 그대로 복제하지 말고, OmG에 필요한 **핵심 역할군 최소셋**부터 단계적으로 도입해야 한다.
4. 결과적으로 목표 아키텍처는:
   - `team run` 중심 단일명령에서
   - `team run + status + resume + shutdown` + role/skill contract + evidence schema로 확장되는 구조다.

---

## 1) 분석 범위와 근거

### 1.1 OmG 기준 근거 (현재 저장소)

- CLI: `src/cli/index.ts`, `src/cli/commands/team-run.ts`
- 오케스트레이터: `src/team/team-orchestrator.ts`
- 런타임 백엔드: `src/team/runtime/runtime-backend.ts`, `tmux-backend.ts`, `subagents-backend.ts`
- 상태 저장소: `src/state/team-state-store.ts`, `src/state/types.ts`
- 아키텍처/게이트 문서: `docs/architecture/runtime-backend.md`, `docs/architecture/state-schema.md`, `docs/testing/gates.md`
- Extension 표면: `commands/omg/team/*.toml`, `skills/plan/SKILL.md`

### 1.2 OmX/OmC 비교 근거 (로컬 미러)

- OmX: `.omx/tmp/oh-my-codex/`
  - CLI/help/runtime/state/mcp team tool 스키마
- OmC: `.omx/tmp/oh-my-claudecode/`
  - CLI command breadth, skills breadth, packaging/runtime surface

### 1.3 사실 기반 스냅샷 (2026-03-02)

- OmG top-level CLI 분기: **5개** (`setup`, `doctor`, `extension`, `team`, `verify`)
- OmX known command set: **14개** (launch/setup/doctor/team/ralph/hud/status/cancel …)
- OmC command declarations: **24개**
- Skills 폴더 수:
  - OmG extension skills: **1개** (`plan`)
  - OmX skills: **30개**
  - OmC skills: **36개**
- OmX state-server team tools: **28개** (`team_claim_task`, `team_transition_task_status`, `team_send_message`, `team_mailbox_*`, `team_read_*`, `team_write_*` 등)

---

## 2) Concrete Differences (OmC/OmX vs OmG)

| 축 | OmC/OmX 공통 강점 | OmG 현재 상태 | 실질 갭 |
|---|---|---|---|
| Team lifecycle UX | `team status/resume/shutdown` 운영 명령 | `team run` 중심 | 운영 제어면 부족 |
| Task lifecycle 무결성 | claim-token + lease + transition guard | task schema에 claim 필드는 있으나 API 강제 약함 | 상태 전이 표준 미흡 |
| Worker protocol | ACK/claim/result/idle 프로토콜 실전 사용 | tmux backend는 bootstrap command dispatch 중심 | worker 실행 계약 일관성 부족 |
| Control-plane API | team_* 읽기/쓰기/이벤트 API 풍부 | OmG 자체의 동급 API 표면 미약 | 자동화/관측/복구 깊이 차이 |
| Role routing | 다수 role/skill + 실행 루틴 존재 | subagents 선택은 가능하나 실행은 deterministic summary 성격 | role이 실제 작업 분해로 약하게 연결 |
| Skill ecosystem | 넓은 실무 스킬 세트 | extension skill `plan` 중심 | 역할별 실전 액션 표면 부족 |
| Recovery semantics | resume/shutdown/monitoring 경로 성숙 | fix-loop는 강점, runtime resume 제어 부족 | 장시간 운영 복구성 제한 |
| Security boundary | path/id 검증 + trust boundary 정책 노출 | 일부 sanitize 있으나 운영 정책 표면 약함 | 안전성 정책 가시화 필요 |
| Observability | mailbox/task/worker/phase 이벤트 풍부 | state scaffold 좋음, 세밀한 운영 대시 신호 제한 | 운영 가시성 차이 |
| Release discipline | OmC/OmX도 규율 존재 | OmG는 gate/contract 측면 상대적 강점 | 강점을 orchestration parity로 연결 필요 |

---

## 3) OmG-native Adoption Principles (복제가 아닌 흡수 원칙)

1. **Extension-first 고정**
   - 모든 신기능은 CLI/문서뿐 아니라 extension 명령/스킬 표면에 즉시 반영.
2. **tmux-default 유지**
   - subagents는 옵트인 실험에서 시작하되, 완료 판정의 truthfulness를 tmux 수준으로 강화.
3. **State contract 우선 설계**
   - UX 추가 전에 상태 전이/무결성 계약부터 고정.
4. **Verify-gated 진화**
   - 모든 신규 orchestration 기능은 smoke/integration/reliability/verify 게이트와 함께 출시.
5. **Backward-compatible migration**
   - `task-<id>.json`, legacy read compatibility, phase normalization(`complete`→`completed`) 원칙 유지.

---

## 4) Architectural Deltas (핵심 설계 변화)

## AD-01. Team Control Plane 모듈 도입

- As-Is: `TeamOrchestrator.run()`가 실행/모니터/phase 전이 중심.
- To-Be: `src/team/control-plane/` 계층 추가.
  - 책임: task claim/transition/release, mailbox delivery semantics, worker signal merge.
- 기대효과: backend와 상태무결성을 분리해 재개/복구 가능한 운영면 확보.

## AD-02. CLI Lifecycle 표면 확장

- 신규: `omg team status`, `omg team resume`, `omg team shutdown`.
- 계약:
  - `status`: phase + task counts + health + runtime verify gate 노출
  - `resume`: phase/snapshot 기반 재진입
  - `shutdown`: graceful 기본, `--force` 선택

## AD-03. Task Transition Contract 강제

- 현재 `writeTask(expectedVersion)` 수준을 확장:
  - `claimTask(team, task, worker, expectedVersion)`
  - `transitionTaskStatus(team, task, from, to, claimToken)`
  - `releaseTaskClaim(team, task, claimToken, worker)`
- 모든 lifecycle 필드(status/owner/result/error)는 transition API로만 변경.

## AD-04. Worker Bootstrap Protocol 표준화

- 표준 순서 강제:
  1) identity 검증
  2) lead ACK
  3) inbox 읽기
  4) task claim
  5) 실행
  6) 결과 쓰기
  7) idle status
- non-compliant worker는 monitor에서 deterministic fail 처리.

## AD-05. Role→Skill→Evidence Contract

- role 선택만으로 끝내지 않고 role output schema를 고정:
  - planner: decomposition + acceptance
  - executor: artifact diff + 실행증거
  - verifier: PASS/FAIL evidence + regression 판정
- `.omg/state/team/<team>/artifacts/<role>/...` 형태 권장.

## AD-06. Subagents Backend의 "진짜 실행"화

- 현재 deterministic-completed 성향을 단계적으로 축소.
- 최소 목표:
  - role별 in_progress/blocked/completed 신호
  - heartbeat/status 반영
  - verify gate를 실제 산출물 기반으로 평가

## AD-07. State Schema v2 (호환 유지)

- 추가 필드(예시):
  - task.claim.leasedUntil mandatory (claim된 task)
  - task.history[] (transition audit)
  - worker.status.reasonCode (taxonomy)
  - monitor.runtime.successChecklistVersion
- 기존 legacy read compatibility 유지.

## AD-08. Security/Trust Boundary 명문화

- team/worker/task identifier regex 고정.
- state root 접근 허용 범위 정책(allowlist) 도입.
- legacy bypass env 사용 시 phase/event에 명시 기록.

## AD-09. Observability 강화

- `events/team-events.ndjson` 신설(또는 동급).
- 이벤트 예시: `worker_ack`, `claim_conflict`, `lease_expired`, `transition_rejected`, `shutdown_requested`.

## AD-10. Gate-aware Release Wiring

- 신규 lifecycle/role 기능은 C0/C1/C2 + reliability gate 증거 없으면 merge 금지.

---

## 5) Migration Constraints (반드시 고려할 제약)

1. **기존 state artifact 호환성**
   - 기존 `task-<id>.json`, mailbox legacy read 경로를 깨면 안 됨.
2. **tmux 운영 안정성 우선**
   - lifecycle 명령 추가 시 session orphan/kill race를 우선 해결해야 함.
3. **subagents 실험 플래그 정책**
   - opt-in 정책은 유지하되, fail reason이 명확해야 함.
4. **문서-코드 동시 진화**
   - `README/docs/help` drift 발생 시 release gate에서 차단.
5. **역할 폭발 억제**
   - 30+ skill 복제보다 핵심 role(3~6개) 먼저 고정해야 유지보수 가능.
6. **검증 비용 관리**
   - reliability suite 확장 시 CI 시간 증가를 고려해 단계별 blocking 정책 설계 필요.

---

## 6) What to Adopt / Adapt / Reject

| 항목 | 분류 | 이유 |
|---|---|---|
| OmX claim-token transition semantics | Adopt | 상태 무결성 핵심이며 OmG gap 직접 해소 |
| OmX team_* control-plane API 패턴 | Adapt | OmG 구조/명명/extension UX에 맞게 경량화 필요 |
| OmC/OmX 대규모 skill breadth 즉시 도입 | Reject(현 단계) | OmG 유지비/검증비 급증 위험 |
| OmC 생태계형 plugin 폭 확장 | Adapt(Later) | OmG는 extension-first이므로 단계적 연동이 적합 |
| Legacy bypass 관용 운영 | Reject | false-green/운영 신뢰 하락 |

---

## 7) 실행 산출물 맵 (이 분석의 후속 문서)

- 상세 델타/의사결정 매트릭스:
  - `docs/analysis/2026-03-02-omg-native-capability-delta-matrix.md`
- 단계별 실행/게이트/리스크/롤아웃:
  - `docs/planning/2026-03-02-omg-native-adoption-phased-plan.md`
- `/ralplan` 즉시 투입 가능한 작업 분해:
  - `docs/planning/2026-03-02-omg-native-ralplan-task-decomposition.md`

---

## 8) 최종 권고

OmG는 이미 좋은 뼈대(Extension-first, RuntimeBackend 추상화, Verify-gated release)를 갖고 있다. 다음 단계의 승부는 기능 수가 아니라 **제어면 엄격성**이다. 즉, OmX 수준의 task lifecycle/state mutation rigor를 OmG-native UX로 흡수하는 것이 가장 높은 ROI를 가진 경로다.
