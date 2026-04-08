# Team Orchestration + Agent Role/Skill 작업 분담 마스터 TODO (2026-03-02)

## 0) 목적

OmC/OmX에서 검증된 핵심 축을 기준으로, 현재 `oh-my-product`의

1. **Team Orchestration**
2. **Agent role/skill 기반 작업 분담**

현황(As-Is)과 갭(Gap)을 명세하고, 구현 가능한 TODO를 우선순위/수용조건까지 포함해 정리한다.

---

## 1) 기준 범위 및 근거

### 1.1 코드/문서 근거 (oh-my-product)

- 오케스트레이션 진입점: `src/cli/commands/team-run.ts`
- 런타임 계약/구현:
  - `src/team/runtime/runtime-backend.ts`
  - `src/team/runtime/tmux-backend.ts`
  - `src/team/runtime/subagents-backend.ts`
- 상태/내구성:
  - `src/state/team-state-store.ts`
  - `src/state/types.ts`
  - `docs/architecture/state-schema.md`
- 역할 카탈로그:
  - `src/team/subagents-blueprint.ts`
  - `src/team/subagents-catalog.ts`
  - `.gemini/agents/catalog.json`
- 기존 비교/리스크 문서:
  - `docs/analysis/omc-omx-omp-adversarial-comparison.md`

### 1.2 게이트/테스트 근거

- 계약/파싱: `tests/reliability/team-run-subagents-options.test.ts`
- 백엔드: `tests/reliability/subagents-backend.test.ts`, `tests/reliability/tmux-backend.test.ts`
- 오케스트레이터 실패 경로: `tests/reliability/orchestrator-failure-paths.test.ts`
- 상태 저장소 계약: `tests/reliability/team-state-store-contract.test.ts`
- 통합: `tests/integration/subagents-team-run.test.ts`, `tests/integration/team-lifecycle.test.ts`

---

## 2) As-Is 명세: Team Orchestration

## 2.1 현재 동작 계약 (확정)

1. **기본 backend = tmux**
   - `omp team run` 기본 경로
2. **대체 backend = subagents (실험적 opt-in)**
   - `.gemini/settings.json`의 `experimental.enableAgents=true` 또는 env flag 필요
3. **수명주기 phase**
   - `plan -> exec -> verify -> fix -> completed|failed`
4. **worker 수 계약**
   - `1..8`, default `3`
5. **fix loop cap**
   - default `3`, 상한 `3`

## 2.2 강점

- 런타임 추상화(`RuntimeBackend`)가 명확함
- 상태 저장 구조(`.omp/state/team/<team>/...`)가 문서화되어 있음
- health monitor(죽은 워커/무응답/watchdog)와 success checklist가 테스트로 고정됨
- verify gate(`runtime.verifyBaselinePassed`) 강제 계약 존재

## 2.3 현재 핵심 갭

1. **CLI 팀 제어면 부족**
   - `team run`만 있고 `team status/resume/shutdown` 부재
2. **실행 backend와 control-plane 분리 미완성**
   - task claim/lease/transition을 런타임 실행과 완전 연결하지 못함
3. **tmux worker lifecycle 표준 프로토콜 부족**
   - worker bootstrap 이후 task dispatch/ack/완료 신호의 통합도가 OmX 대비 낮음
4. **legacy bypass 플래그 의존 구간 존재**
   - `OMP_LEGACY_RUNNING_SUCCESS`, `OMP_LEGACY_VERIFY_GATE_PASS`

---

## 3) As-Is 명세: Agent role/skill 기반 작업 분담

## 3.1 현재 동작 계약 (확정)

1. **role source**
   - `.gemini/agents/catalog.json` (없으면 default blueprint fallback)
2. **role 선택 방식**
   - 명시형: `--backend subagents --subagents planner,executor`
   - 태그형: `--task "$planner /executor ..."`
3. **할당 일치 규칙**
   - subagent 개수 == workers (불일치 시 실패)
4. **unified model 규칙**
   - subagent별 모델 분리 없이 단일 모델 공유

## 3.2 강점

- role id 정규화/중복 제거/unknown id 에러가 명확함
- 태그 기반 role 라우팅이 CLI 레벨에서 이미 동작
- subagent assignment 결과가 runtime metadata로 남아 추적 가능

## 3.3 현재 핵심 갭

1. **role 실행이 실제 작업 분해/의존 실행으로 이어지지 않음**
   - 현재 subagents backend는 deterministic completed snapshot 성격이 강함
2. **skill surface 협소**
   - extension skill이 `plan` 중심으로 매우 작음
3. **role ↔ task contract 문서/스키마 부족**
   - 어떤 role이 어떤 입력/출력 계약을 가져야 하는지 명세가 없음
4. **tmux backend와 role 분담의 접점 부족**
   - tmux worker에도 role assignment를 강제/검증하는 일관 계층 부재

---

## 4) 마스터 TODO (우선순위 + 명세 + 수용조건)

## P0 — 동작 신뢰성/패리티 최소선

### P0-1. Team lifecycle CLI 확장 (`status`, `shutdown`, `resume`)

- **목표**: `team run` 단일 명령 의존 제거, 운영 제어면 확보
- **명세**:
  - `omp team status --team <name> [--json]`
  - `omp team shutdown --team <name> [--force] [--json]`
  - `omp team resume --team <name> [--max-fix-loop n] [--json]`
- **수용조건**:
  - 상태 파일(`phase.json`, `monitor-snapshot.json`) 기반 일관 출력
  - shutdown 후 runtime/backend 정리 + 상태 반영
  - 통합 테스트 추가

### P0-2. Control-plane task lifecycle API를 런타임 경로와 일원화

- **목표**: task를 파일이 아니라 계약 기반 상태 전이로 처리
- **명세**:
  - claim(token, lease), transition(from->to), release를 공식 경로로 강제
  - task 직접 파일 overwrite 관행 차단(유틸/API 경유)
- **수용조건**:
  - CAS mismatch/lease expiry 테스트 필수
  - phase 실패 시 관련 task 상태/오류 원인 추적 가능

### P0-3. tmux worker bootstrap 표준화

- **목표**: worker가 동일 프로토콜(ACK/claim/result/status idle)을 강제 준수
- **명세**:
  - worker init 시 team/worker identity 검증
  - ACK mailbox 쓰기, task claim 선행, 완료 보고 포맷 강제
- **수용조건**:
  - 라이브 e2e에서 ACK 누락/claim 없는 실행이 실패 처리됨

### P0-4. Legacy compatibility 플래그 축소/감사화

- **목표**: false-green 제거
- **명세**:
  - legacy 플래그 사용 시 경고를 넘어서 state/event에 명시적 기록
  - 릴리즈 게이트에서 legacy 플래그 ON 상태 차단
- **수용조건**:
  - CI에서 legacy bypass가 있으면 실패

## P1 — role/skill 분담 실효성 강화

### P1-1. Role-to-Task 분해 계약 정의

- **목표**: subagent 선택이 실제 작업 계획/분담으로 이어지게 하기
- **명세**:
  - 최소 표준 role set: `planner, executor, verifier`
  - 입력/출력 계약:
    - planner: task decomposition + acceptance criteria
    - executor: 구현/산출물
    - verifier: 검증/회귀 판정
- **수용조건**:
  - run 결과에 role별 artifact 경로/요약이 남아야 함

### P1-2. 태그 라우팅 문법 정식화

- **목표**: `$planner /executor` 파싱 규칙의 문서-코드-테스트 정렬
- **명세**:
  - 허용 토큰, 중복 처리, 정규화 규칙, 실패 메시지 규약 문서화
- **수용조건**:
  - docs/CLI help/test가 동일 예시를 공유

### P1-3. Skill 카탈로그 확장 (extension-first)

- **목표**: role 분담과 연결되는 최소 skill 표면 확보
- **명세**:
  - 우선 도입: `team`, `review`, `verify`, `handoff` 스킬
  - 각 skill은 team state artifact와 연결된 증거 포맷 포함
- **수용조건**:
  - 각 skill 실행 결과가 `.omp/state` 추적 정보와 연결

### P1-4. Unified model 정책의 운영 옵션화

- **목표**: 현재 원칙은 유지하되 정책화(명시/검증) 강화
- **명세**:
  - 기본 unified model 유지
  - 향후 분리 모델 모드 대비 feature flag 자리만 선점
- **수용조건**:
  - metadata에 정책 출처(기본/설정/플래그)가 기록됨

## P2 — 운영성/문서성 완성

### P2-1. Team 운영 런북 통합

- **목표**: docs 흩어짐 제거
- **명세**:
  - `docs/testing/live-team-e2e.md` + architecture/state 문서를
    “운영 runbook + 장애대응” 관점으로 교차 링크
- **수용조건**:
  - 신규 운영자가 status→shutdown→복구까지 문서만으로 수행 가능

### P2-2. Role/Skill 분담 관측 대시보드(요약 JSON)

- **목표**: 실행 후 분담 품질을 수치화
- **명세**:
  - role별 task count, 완료율, 재시도율, 실패사유 분포
- **수용조건**:
  - verify 단계에서 summary artifact 생성

### P2-3. OmC/OmX parity 추적표 정례화

- **목표**: 비교 분석을 일회성 문서에서 운영 backlog로 전환
- **명세**:
  - 월 1회 parity snapshot 문서 갱신
  - 항목별 상태: `not_started | in_progress | landed`
- **수용조건**:
  - 본 문서 TODO와 비교 문서(`docs/analysis/...`)가 상호 링크됨

---

## 5) 구현 순서 제안 (실행 단위)

1. `team status/shutdown/resume` CLI 추가 (P0-1)
2. task lifecycle API 강제 및 CAS/lease 테스트 보강 (P0-2)
3. tmux worker 표준 프로토콜 강제 및 live e2e 검증 (P0-3)
4. legacy bypass 차단 정책 CI 반영 (P0-4)
5. role-to-task 계약/아티팩트 스키마 도입 (P1-1)
6. skill 표면 확장 + 문서/예시 통합 (P1-3)

---

## 6) 검증 체크리스트 (이 TODO 문서 기준)

### 6.1 코드/계약 검증

- `npm run typecheck`
- `npm run test:reliability`
- `npm run test:integration`
- `npm run verify`

### 6.2 오퍼레이터 검증

- `npm run omp -- team run --task "smoke" --dry-run --json`
- (live) `npm run team:e2e -- "oh-my-product live team smoke"`

### 6.3 문서 정합 검증

- `README.md`, `docs/omp/commands.md`, `docs/testing/gates.md`, 본 문서의
  command contract가 충돌하지 않아야 함

---

## 7) 상태 표기 규칙 (권장)

본 문서의 TODO 항목은 아래 상태를 사용한다.

- `todo`: 미착수
- `active`: 진행 중
- `blocked`: 외부 의존/결정 대기
- `done`: 머지 및 게이트 통과 완료

각 항목 업데이트 시 최소 메타데이터를 남긴다.

- owner
- PR/commit reference
- evidence command
- updated_at (ISO8601)

