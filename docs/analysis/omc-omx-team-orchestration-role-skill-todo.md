# OmC/OmX 핵심축 정리 + oh-my-gemini TODO 명세

날짜: 2026-03-02  
대상: `oh-my-gemini` 현재 코드/문서 기준  
축: **(1) Team Orchestration** + **(2) Agent role/skill 기반 작업 분담**

---

## 0) 목적

이 문서는 OmC/OmX에서 실제로 강하게 쓰는 두 축을 기준으로, `oh-my-gemini`의 현재 상태(As-Is)를 구조적으로 정리하고, **바로 실행 가능한 TODO 명세**로 고정하기 위한 문서다.

- 축 1: 팀 실행/상태/복구를 다루는 Team Orchestration
- 축 2: 역할/스킬 기반으로 작업을 나눠 병렬 실행하는 Agent role/skill 분담

---

## 1) 근거 소스 (현재 저장소 기준)

### 1.1 Team orchestration 근거

- `src/cli/commands/team-run.ts`
- `src/team/team-orchestrator.ts`
- `src/team/runtime/runtime-backend.ts`
- `src/team/runtime/tmux-backend.ts`
- `src/team/runtime/subagents-backend.ts`
- `src/team/monitor.ts`
- `src/state/team-state-store.ts`
- `docs/architecture/runtime-backend.md`
- `docs/architecture/state-schema.md`
- `docs/testing/gates.md`
- `docs/testing/live-team-e2e.md`

### 1.2 Role/skill 분담 근거

- `src/team/subagents-blueprint.ts`
- `src/team/subagents-catalog.ts`
- `extensions/oh-my-gemini/commands/team/run.toml`
- `extensions/oh-my-gemini/commands/team/subagents.toml`
- `extensions/oh-my-gemini/skills/plan/SKILL.md`
- `docs/setup/quickstart.md`

---

## 2) As-Is: 축 1 Team Orchestration

## 2.1 실행 진입점/계약

- CLI 엔트리: `omg team run --task "..."`
- backend: `tmux`(기본) / `subagents`(옵트인)
- worker count 계약: `1..8` (기본 3)
- fix loop: `--max-fix-loop` 기본 3, 상한 3

## 2.2 lifecycle FSM

- canonical phase:
  - `plan -> exec -> verify -> fix -> completed|failed`
- `TeamOrchestrator.run()`이 phase 전환 + snapshot + 실패 reason 기록을 담당

## 2.3 runtime backend contract

`RuntimeBackend` 인터페이스:

- `probePrerequisites(cwd)`
- `startTeam(input)`
- `monitorTeam(handle)`
- `shutdownTeam(handle, opts)`

### tmux backend (현재 강한 경로)

- tmux 세션 생성 + pane 분할 + worker별 env 주입
- worker id canonical: `worker-<n>`
- pane 상태 기반으로 `running/completed/failed` 판정
- runtime verify gate 신호 생성:
  - `runtime.verifyBaselinePassed`
  - `runtime.verifyBaselineSource="tmux-runtime"`

### subagents backend (실험 경로)

- opt-in 요구:
  - env `OMG_EXPERIMENTAL_ENABLE_AGENTS=true` 또는
  - `.gemini/settings.json`의 `experimental.enableAgents=true`
- catalog 기반 역할 선택 (`.gemini/agents/catalog.json`)
- 현재 구현은 deterministic completion 성향이 강함 (실제 장기 실행 런타임보다는 계약 검증 성격)

## 2.4 상태 내구성

- 루트: `.omg/state/team/<team>/`
- 핵심 아티팩트:
  - `phase.json`
  - `events/phase-transitions.ndjson`
  - `monitor-snapshot.json`
  - `tasks/task-<id>.json`
  - `mailbox/<worker>.ndjson`
  - `workers/<worker>/{identity,heartbeat,status,done}.json`
  - `workers/<worker>/inbox.md`

## 2.5 신뢰성/헬스

- monitor는 다음을 실패 신호로 반영:
  - dead worker (`status=failed`)
  - non-reporting worker (heartbeat 없음/만료)
  - watchdog 만료 (`snapshot.updatedAt` stale/invalid)
- orchestrator 성공 체크리스트에 runtime gate + task 상태 + health를 결합

---

## 3) As-Is: 축 2 Agent role/skill 기반 분담

## 3.1 역할 선택 입력면

- 명시적: `--backend subagents --subagents planner,executor --workers 2`
- task 선행 태그 자동 파싱:
  - 예: `$planner /executor implement ...`
  - 파싱 범위: **task 시작 prefix only**
  - backend keyword: `/subagents`, `$agents` 등

## 3.2 subagent catalog/role 모델

- catalog schema: `schemaVersion`, `unifiedModel`, `subagents[]`
- unified model 기본값: `gemini-2.5-pro`
- 기본 blueprint role(21개):
  - analyst, architect, build-fixer, code-reviewer, code-simplifier, critic,
    debugger, deep-executor, designer, document-specialist, executor, explore,
    git-master, planner, qa-tester, quality-reviewer, scientist,
    security-reviewer, test-engineer, verifier, writer

## 3.3 skill surface (현재)

- `extensions/oh-my-gemini/skills/`에는 사실상 `plan` 중심
- 즉, role 카탈로그 대비 extension-level skill 실행면은 아직 얇음
- 결과적으로 “role selection 가능” 대비 “role별 실행 프로토콜 표준화”가 부족

---

## 4) 핵심 갭 요약 (OmC/OmX 스타일 운영축 대비)

1. **Team lifecycle CLI 폭 갭**
   - 현재 `team run` 중심, `status/resume/shutdown` 운영 명령은 `omg` 자체 표면에서 얇음

2. **Control-plane mutation 갭**
   - task claim/lease/transition을 강하게 표준화한 작업 API 표면이 `oh-my-gemini` 기본 UX에서 충분히 전면화되지 않음

3. **Role -> Skill -> Verification 연결 갭**
   - role 선택은 가능하지만, role별 “입력 템플릿/출력 스키마/검증 체크리스트”가 부족

4. **Subagents 실험경로 성숙도 갭**
   - 실험 옵트인 경로는 존재하지만, 장기 실행/복구/관측 parity는 tmux 기본경로 대비 약함

5. **문서 단일 소스화 갭**
   - orchestration 계약, role 분담 규칙, 운영 runbook이 여러 문서에 분산

---

## 5) TODO 백로그 (명세)

아래 항목은 “문서화 TODO”를 넘어, 실제 구현/검증까지 연결되는 스펙 단위다.

## 5.1 축 1 Team Orchestration TODO

| ID | Priority | TODO | 구현 범위(예시) | DoD |
|---|---|---|---|---|
| ORCH-P0-01 | P0 | `omg team status/resume/shutdown` 명령 표면 추가 | `src/cli/commands/*`, `src/cli/index.ts`, `docs/omg/commands.md` | 상태 조회/재개/종료가 CLI에서 일관 동작, usage/exit code 계약 문서 반영 |
| ORCH-P0-02 | P0 | Team handle/phase 관점의 운영 복구 시나리오 고정 | `src/team/team-orchestrator.ts`, `docs/testing/live-team-e2e.md` | 비정상 종료 후 재진입 경로가 문서+테스트로 증명 |
| ORCH-P0-03 | P0 | task mutation 계약(API 수준) 명문화/강제 | `src/state/team-state-store.ts`, `docs/architecture/state-schema.md` | expectedVersion/CAS/claim 필드 규칙을 contract로 고정 |
| ORCH-P1-01 | P1 | monitor/snapshot failure reason taxonomy 정규화 | `src/team/monitor.ts`, `docs/testing/gates.md` | dead/non-reporting/watchdog/runtime verify fail을 표준 reason code로 출력 |
| ORCH-P1-02 | P1 | runtime backend별 성공 체크리스트 세분화 | `src/team/team-orchestrator.ts`, `docs/architecture/runtime-backend.md` | tmux/subagents 각각 최소 성공 조건을 별도 표로 명시 |
| ORCH-P2-01 | P2 | 운영자용 장시간 실행 runbook 강화 | `docs/testing/live-team-e2e.md` | timeout/강제종료/정리검증 절차가 케이스별 템플릿화 |

## 5.2 축 2 Role/Skill 분담 TODO

| ID | Priority | TODO | 구현 범위(예시) | DoD |
|---|---|---|---|---|
| ROLE-P0-01 | P0 | Role assignment 입력 규칙 단일 명세화 | `docs/architecture/runtime-backend.md`, `docs/setup/quickstart.md` | `$role`, `/role`, `--subagents` 우선순위/충돌규칙/오류문구 표준화 |
| ROLE-P0-02 | P0 | role별 최소 output contract 정의 | 신규 문서(`docs/architecture/role-skill-contract.md`) | 각 role에 required fields + evidence 규칙 + failure/report 규칙 명시 |
| ROLE-P0-03 | P0 | role -> verification 매핑 고정 | `docs/testing/gates.md` | planner/executor/reviewer/verifier 등 role별 필수 검증 명령 정의 |
| ROLE-P1-01 | P1 | extension-level skill 표면 확장(최소 핵심역할) | `extensions/oh-my-gemini/skills/*` | `plan` 외 core skill(예: execute/review/verify) 추가 및 사용가이드 반영 |
| ROLE-P1-02 | P1 | catalog role과 extension skill 간 매핑표 제공 | `docs/omg/project-map.md` 또는 신규 docs | blueprint role 21개 중 지원/미지원/planned 상태 추적 가능 |
| ROLE-P2-01 | P2 | 역할별 품질 메트릭 추가 | 테스트/리포트 문서 | 역할별 성공률/재시도율/검증실패 패턴 수집 지표 정의 |

---

## 6) 우선 실행 제안 (2주 단위)

## Sprint A (즉시)

- ORCH-P0-01, ORCH-P0-03
- ROLE-P0-01, ROLE-P0-02

산출물:

- CLI lifecycle 명령 최소 3종
- role/skill 계약 문서 1개
- task mutation contract 문서 강화

## Sprint B

- ORCH-P0-02, ORCH-P1-01
- ROLE-P0-03, ROLE-P1-01

산출물:

- 복구 시나리오 테스트 증거
- role별 검증 매핑 + extension core skill 확장

## Sprint C

- ORCH-P1-02, ORCH-P2-01
- ROLE-P1-02, ROLE-P2-01

산출물:

- backend별 성공 체크리스트 분리
- role coverage/quality metric 초안

---

## 7) 검증 프로토콜 (이 TODO 문서를 실제 작업으로 옮길 때)

1. 타입 안정성

```bash
npm run typecheck
```

2. 스위트 검증

```bash
npm run test
```

3. 린트(현재 저장소는 typecheck 기반 lint)

```bash
npm run lint
```

4. 오케스트레이션 계약 검증

```bash
npm run omg -- team run --task "contract smoke" --dry-run --json
```

5. 회귀 검증

```bash
npm run verify
```

---

## 8) 문서 반영 대상 (후속 PR 체크리스트)

- [ ] `docs/architecture/runtime-backend.md`: role assignment 규칙/우선순위 표 추가
- [ ] `docs/architecture/state-schema.md`: task mutation 계약 강화 문장 반영
- [ ] `docs/omg/commands.md`: lifecycle command 확장 시 즉시 반영
- [ ] `docs/setup/quickstart.md`: role/skill 사용 예제와 실패 대응 예시 추가
- [ ] `docs/testing/gates.md`: role별 검증 체크리스트 반영

---

## 9) 결론

`oh-my-gemini`는 **team orchestration의 뼈대(phase/state/monitor/backend)**는 이미 갖췄다.  
다음 점프는 명확하다:

1. 운영 제어면(status/resume/shutdown + mutation contract) 강화  
2. role 선택을 넘어 role별 skill 실행/검증 계약까지 연결  

즉, OmC/OmX의 핵심 강점은 “많은 기능” 자체보다 **역할 분담 + 상태 전이 + 검증 루프를 한 시스템으로 묶는 운영 규율**이고, 이 문서의 TODO는 그 규율을 `oh-my-gemini`에 이식하기 위한 실행 명세다.
