# oh-my-gemini: MVP 품질 피드백 + PRD

작성일: 2026-02-27  
문서 범위: `oh-my-gemini`를 신규 MVP로 정의하기 위한 레퍼런스 기반 기획/설계 문서 (현재 로컬 실험 구현은 제외)

---

## PART 1: MVP 품질 피드백

### 1) MVP에서 반드시 구현해야 할 것 (오픈소스 멀티에이전트 하네스 기준)

1. **재현 가능한 팀 실행 파이프라인**
- 최소 `plan -> exec -> verify -> fix`의 명시적 상태 머신이 있어야 함.
- 상태 전이와 실패 조건이 파일 기반으로 추적 가능해야 함.

2. **tmux 기반 기본 런타임(디폴트)**
- 실제 CLI 워커 프로세스를 pane 단위로 스폰/감시/정리할 수 있어야 함.
- 워커별 `inbox.md`/`done.json` 계약이 명확해야 함.

3. **내결함성 있는 상태 저장**
- `.omg/state/` 하위에 팀/태스크/워커/이벤트 상태를 분리 저장.
- 재시작(resume) 시 상태 복원이 가능해야 함.

4. **설치(setup)/진단(doctor)/검증(verify) 루프**
- 설치는 idempotent해야 하며, scope 우선순위가 명확해야 함.
- doctor는 의존성(tmui/gemini/node) + 설정 충돌을 진단해야 함.
- verify는 smoke/integration/reliability를 명시적으로 분리해야 함.

5. **Gemini Extension 표준 적합성**
- `gemini-extension.json`, `commands/*.toml`, `skills/*/SKILL.md`, `GEMINI.md` 구조를 준수해야 함.

### 2) MVP의 본질적 한계 (인정해야 할 범위)

1. **완전 자율 복구의 한계**
- watchdog으로 죽은 pane/무응답 워커를 재배정할 수 있어도, 의미론적 오류(잘못된 요구사항 해석)는 자동 복구 어려움.

2. **LLM 실행의 비결정성**
- 동일 입력에서도 결과가 달라질 수 있어, 상태 파일/이벤트 로그로 사후 추적성을 확보해야 함.

3. **환경 의존성**
- tmux/OS/sandbox 엔진 차이로 로컬- CI 간 편차가 발생 가능.

4. **토큰/비용 제약**
- 멀티워커 병렬은 품질을 올릴 수 있으나 비용과 속도 편차를 증가시킴.

### 3) oh-my-codex / oh-my-claudecode 대비 Gap 분석

| 영역 | oh-my-codex 관찰 | oh-my-claudecode 관찰 | oh-my-gemini MVP 목표 | 현재 갭 |
|---|---|---|---|---|
| 팀 단계 파이프라인 | `team-plan -> team-prd -> team-exec -> team-verify -> team-fix` 명시 | team phase 추론 + fixing/failure 규칙 | `plan -> exec -> verify -> fix -> complete/failed` | **높음** |
| fix-loop 제어 | `max_fix_attempts`(기본 3) + 초과 시 failed | retryCount/maxRetries 기반 fixing/failure 분기 | 기본 3회 cap + 초과 실패 고정 | **높음** |
| tmux 런타임 | 팀 세션/워커 bootstrap/dispatch | pane 생존 + done.json + heartbeat watchdog | tmux 디폴트 백엔드 + watchdog | **높음** |
| 파일 계약 | worker identity/status/event/task 구조가 풍부 | `inbox.md`, `done.json`, `heartbeat.json` 계약 명확 | 동일 수준의 파일 계약 필요 | **높음** |
| 상태 저장 구조 | `.omx/state/team/*` + manifest/events/mailbox/approvals | `.omc/state/team/*` + tasks/workers/mailbox | `.omg/state/team/*` 표준화 | **높음** |
| setup scope | CLI > persisted scope > default 구조 | 플러그인/런타임 설치 흐름 성숙 | 동일 precedence + idempotent setup | **중간~높음** |
| marker 기반 설정 병합 | OMX 블록 strip/reinsert 방식 (수동 설정 보존) | 플러그인 메타 + 빌드 체계 | OMG marker merge 필요 | **중간** |
| doctor | setup/runtime/team diagnostics 제공 | 운영성 점검 커맨드 풍부 | `omg doctor --fix` 필수 | **중간** |
| verify 게이트 | 테스트/카탈로그 체크 기반 | 광범위 vitest/bridge 테스트 | smoke/integration/reliability 3단 | **높음** |
| extension 생태 연계 | Codex 중심 프롬프트/스킬 체계 | Claude plugin 중심 생태 | Gemini extension 표준 준수 | **높음** |

**총평:** MVP로서 출시 가능하려면, `tmux runtime + phase state machine + durable state + setup/doctor/verify + extension spec`의 5축이 최소 완성도에 도달해야 한다. 그 외 고급 기능(원격 서브에이전트, 고급 UI, 광범위 skill 카탈로그)은 후속 버전으로 분리해야 한다.

---

## PART 2: oh-my-gemini PRD (Product Requirements Document)

## 1. 제품 비전 & 핵심 원칙

### 비전
`oh-my-gemini`는 Gemini CLI 사용자에게 **재현 가능하고 복구 가능한 멀티에이전트 실행 하네스**를 제공한다. 목표는 “한 번의 지시를 계획-실행-검증-수정 루프로 끝까지 밀어붙이는 팀 런타임”이다.

### 핵심 원칙

1. **Extension-first**: Gemini extension 표준(`gemini-extension.json`, `commands`, `skills`, `GEMINI.md`)을 중심으로 설계.
2. **tmux-default**: 기본 백엔드는 tmux, subagents는 실험적 opt-in.
3. **Durable state**: 모든 중요한 전이는 `.omg/state/`에 파일로 남긴다.
4. **Deterministic contracts**: `inbox.md`, `done.json`, `task.json` 계약을 엄격히 고정.
5. **Idempotent setup**: 설치를 반복해도 결과가 안정적이어야 한다.
6. **Verify-gated delivery**: smoke/integration/reliability 게이트를 통과해야 완료로 간주.

---

## 2. 아키텍처 층 (Layer A~E)

### Layer A: UX/Command Surface
- `omg` CLI (`setup`, `doctor`, `team run`, `verify`)
- Gemini slash commands (`/team:run`, `/team:verify`, `/setup`)

### Layer B: Orchestration Core
- Task decomposition
- Phase state machine
- Fix-loop 정책
- Dispatch policy

### Layer C: Runtime Backends
- `tmux` backend (default)
- `subagents` backend (experimental)
- 공통 `RuntimeBackend` 인터페이스

### Layer D: State & Persistence
- `.omg/state/` 하위 파일 시스템 저장
- JSON/JSONL atomic write
- Resume/recovery/read model

### Layer E: Platform Integration
- sandbox (docker/podman/seatbelt/none)
- CI verification gates
- extension packaging/release

---

## 3. CLI 커맨드 구체 인터페이스

### 3.1 `omg setup [--scope project|user|global] [--dry-run]`

**목적**
- extension/skill/prompt/runtime 기본 구조 설치
- scope 결정 및 저장

**옵션**
- `--scope`: 설치 대상 스코프 지정
- `--dry-run`: 실제 파일 변경 없이 계획만 출력

**행동 규칙**
- scope 우선순위: `CLI flag > .omg/setup-scope.json > default(user)`
- 필요한 디렉토리 생성
- marker merge로 설정 파일 병합
- 완료 후 설치 결과 요약 출력

**종료 코드**
- `0`: 성공
- `1`: 설치 실패(권한/파일 I/O/파싱)

### 3.2 `omg doctor [--fix]`

**목적**
- 런타임/의존성/설정 충돌 진단

**체크 항목 (MVP)**
- `node`, `npm`, `tmux`, `gemini` 존재 여부
- `.omg/setup-scope.json` 유효성
- extension manifest/commands/skills 파일 무결성
- state 디렉토리 권한/쓰기 가능 여부

**옵션**
- `--fix`: 안전한 자동 수정(디렉토리 생성, 누락 파일 scaffold)

### 3.3 `omg team run --task <text> [--backend tmux|subagents] [--workers N]`

**목적**
- 멀티워커 팀 실행 시작

**옵션**
- `--task <text>`: 필수, 상위 목표
- `--backend`: 기본 `tmux`
- `--workers N`: 워커 수 (기본 3, MVP 최대 8)

**행동 규칙**
- 팀 이름 생성/정규화
- task 파일 생성
- worker inbox 초기화
- backend별 spawn
- watchdog 시작
- phase monitor 루프 시작

### 3.4 `omg verify [--suite smoke|integration|reliability]`

**목적**
- 품질 게이트 실행

**옵션**
- `--suite smoke|integration|reliability`

**매핑 (MVP 기본)**
- `smoke`: typecheck + 핵심 커맨드 헬프/기본 실행
- `integration`: team run/resume/shutdown 시나리오
- `reliability`: watchdog/fix-loop/복구 시나리오 장시간 검증

---

## 4. Extension 커맨드 정의

## 4.1 `gemini-extension.json` 스키마 (MVP)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "version"],
  "properties": {
    "name": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "version": { "type": "string" },
    "description": { "type": "string" },
    "mcpServers": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["command"],
        "properties": {
          "command": { "type": "string" },
          "args": { "type": "array", "items": { "type": "string" } },
          "cwd": { "type": "string" },
          "env": { "type": "object", "additionalProperties": { "type": "string" } }
        }
      }
    },
    "contextFileName": { "type": "string", "default": "GEMINI.md" },
    "excludeTools": { "type": "array", "items": { "type": "string" } },
    "settings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "description", "envVar"],
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "envVar": { "type": "string" },
          "sensitive": { "type": "boolean", "default": false }
        }
      }
    }
  }
}
```

## 4.2 TOML 예시 (team/run, team/verify, setup)

### `commands/team/run.toml`
```toml
description = "Run omg multi-agent team workflow for the given task."
prompt = """
Start oh-my-gemini team execution for: {{args}}

Run:
!{omg team run --task {{args}} --backend tmux --workers 3}

Then summarize:
1. team name
2. initial phase
3. worker spawn status
"""
```

### `commands/team/verify.toml`
```toml
description = "Run reliability-focused verification for omg."
prompt = """
Execute verification suite: {{args}}

Command:
!{omg verify --suite {{args}}}

Return a concise report:
- pass/fail
- failing checks
- next required fixes
"""
```

### `commands/setup.toml`
```toml
description = "Run omg setup with optional scope."
prompt = """
Initialize oh-my-gemini environment.

If scope is provided, use it; otherwise use user default.
Command:
!{omg setup {{args}}}

After execution, summarize created/updated files.
"""
```

---

## 5. SKILL.md 포맷 예시 (plan 스킬)

`skills/plan/SKILL.md`

```markdown
---
name: plan
description: Strategic planning for complex engineering tasks.
---

# Plan Skill

## Purpose
Create an actionable plan before implementation.

## Use When
- Task is broad or ambiguous
- User asks for phased execution

## Steps
1. Clarify scope and constraints
2. Produce acceptance criteria
3. Define phased implementation steps
4. Define verification plan

## Output Format
- Requirements summary
- Acceptance criteria
- Implementation steps
- Risks and mitigations
- Verification checklist
```

---

## 6. GEMINI.md 컨텍스트 파일 구조

Gemini CLI 계층 규칙 기반:

1. Global: `~/.gemini/GEMINI.md`
2. Workspace/Environment: 워크스페이스 상위에서 탐색된 `GEMINI.md`
3. JIT context: 현재 작업 디렉토리 및 상위 경로의 `GEMINI.md`

### 권장 구조

```markdown
# Project: oh-my-gemini

## Core Rules
- tmux backend is default
- subagents backend is experimental
- all state transitions must be persisted

## Coding Standards
- strict TypeScript
- deterministic JSON writes

@./docs/architecture/runtime.md
@./docs/testing/gates.md
```

---

## 7. tmux 런타임 설계

## 7.1 `RuntimeBackend` 인터페이스 (TypeScript)

```ts
export type BackendKind = 'tmux' | 'subagents';

export interface TeamTask {
  id: string;
  subject: string;
  description: string;
}

export interface WorkerHandle {
  workerName: string;
  backendPid?: number;
  paneId?: string;
}

export interface RuntimeBackend {
  kind: BackendKind;
  startTeam(input: {
    teamName: string;
    cwd: string;
    workers: number;
    tasks: TeamTask[];
  }): Promise<{ sessionId: string; workers: WorkerHandle[] }>;

  spawnWorker(input: {
    teamName: string;
    workerName: string;
    taskId: string;
    inboxPath: string;
  }): Promise<WorkerHandle>;

  isWorkerAlive(input: { teamName: string; workerName: string; paneId?: string }): Promise<boolean>;

  shutdownTeam(input: { teamName: string; sessionId: string; force?: boolean }): Promise<void>;
}
```

## 7.2 워커 스폰 명령어 (tmux)

```bash
# 팀 세션 생성 (leader pane)
tmux new-session -d -s omg-team-<teamName>

# 워커 pane 추가
tmux split-window -t omg-team-<teamName> -h

# 워커 실행 (예시)
gemini -p "Read and execute your task from: .omg/state/team/<team>/workers/<worker>/inbox.md"
```

## 7.3 `inbox.md` 포맷

```markdown
## Initial Task Assignment
Task ID: <id>
Worker: <worker-name>
Subject: <short subject>

<full instruction>

When complete, write done signal to .omg/state/team/<team>/workers/<worker>/done.json:
{"taskId":"<id>","status":"completed","summary":"<summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY this task. After writing done.json, exit immediately.
```

## 7.4 `done.json` 스키마

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["taskId", "status", "summary", "completedAt"],
  "properties": {
    "taskId": { "type": "string" },
    "status": { "type": "string", "enum": ["completed", "failed"] },
    "summary": { "type": "string", "minLength": 1 },
    "completedAt": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

## 7.5 watchdog 로직

기본 정책:
- tick interval: `1s`
- 우선순위: `done.json 확인 -> pane 생존 확인 -> heartbeat stall 확인`
- 무응답 기준: `heartbeat 60s stale`
- kill threshold: 연속 `3`회 stale
- watchdog 자체 연속 실패 `3`회 시 `watchdog-failed.json` 기록 후 팀 실패 처리

---

## 8. team phase 상태 머신

## 8.1 Phase enum

```ts
type TeamPhase = 'plan' | 'exec' | 'verify' | 'fix' | 'complete' | 'failed';
```

## 8.2 전이 테이블

| From | To | 조건 |
|---|---|---|
| `plan` | `exec` | 태스크 분해 완료 |
| `exec` | `verify` | 모든 태스크가 terminal(`completed`/`failed`) |
| `verify` | `complete` | 검증 통과 + 실패 태스크 없음 |
| `verify` | `fix` | 검증 실패 또는 실패 태스크 존재 |
| `fix` | `exec` | 수정 태스크 재배치 완료 |
| `fix` | `failed` | fix-loop cap 초과 |
| `exec`/`verify`/`fix` | `failed` | 치명적 런타임 오류(세션 손실, state corruption)

## 8.3 fix-loop cap
- 기본값: `3`
- `fix` 진입 시 `currentFixAttempt++`
- `currentFixAttempt > 3`이면 `failed`

---

## 9. 상태 파일 구조 (`.omg/state/` 전체 리스트, JSON 예시)

```text
.omg/state/
  session.json
  team/
    <team-name>/
      config.json
      phase.json
      monitor-snapshot.json
      watchdog-failed.json
      tasks/
        1.json
        2.json
      events/
        events.ndjson
      mailbox/
        worker-1.jsonl
        worker-2.jsonl
      workers/
        worker-1/
          inbox.md
          done.json
          heartbeat.json
          status.json
          identity.json
          outbox.jsonl
          shutdown-ack.json
        worker-2/
          ...
```

### `config.json` 예시
```json
{
  "teamName": "mvp-task-a",
  "backend": "tmux",
  "workerCount": 3,
  "createdAt": "2026-02-27T05:00:00.000Z",
  "task": "Implement MVP runtime",
  "tmuxSession": "omg-team-mvp-task-a"
}
```

### `phase.json` 예시
```json
{
  "currentPhase": "verify",
  "maxFixAttempts": 3,
  "currentFixAttempt": 1,
  "updatedAt": "2026-02-27T05:10:00.000Z",
  "transitions": [
    { "from": "plan", "to": "exec", "at": "2026-02-27T05:02:00.000Z" },
    { "from": "exec", "to": "verify", "at": "2026-02-27T05:09:00.000Z" }
  ]
}
```

### `tasks/1.json` 예시
```json
{
  "id": "1",
  "subject": "Build runtime backend interface",
  "description": "Add RuntimeBackend contract and tmux implementation stub",
  "status": "in_progress",
  "owner": "worker-1",
  "createdAt": "2026-02-27T05:01:00.000Z",
  "assignedAt": "2026-02-27T05:02:00.000Z"
}
```

---

## 10. 설치 시스템

## 10.1 marker merge 알고리즘

목표: 사용자 수동 설정은 보존하고, OMG 관리 블록만 교체.

알고리즘:
1. 기존 설정 파일 로드
2. `# oh-my-gemini (OMG) Configuration` ~ `# End oh-my-gemini` 블록 탐색
3. 기존 OMG 블록 제거
4. OMG 소유 키(top-level) strip 후 재삽입
5. 기능 플래그 upsert (`multi_agent=true` 등)
6. 새 OMG 블록 append
7. atomic write

## 10.2 scope precedence

1. CLI flag `--scope`
2. `.omg/setup-scope.json`
3. default(`user`)

## 10.3 idempotency 보장 조건

1. 동일 입력에서 setup N회 실행 시 결과 파일 hash가 안정적이어야 함.
2. marker 블록 중복 생성 금지.
3. 누락 파일만 생성하고 기존 사용자 커스텀 값은 보존.
4. `--dry-run`에서 실제 파일 변경 0건 보장.

---

## 11. Sandbox 통합

## 11.1 설정 옵션

`settings.json` / env / CLI flag 우선순위:
1. CLI: `--sandbox`
2. ENV: `GEMINI_SANDBOX=true|docker|podman|sandbox-exec`
3. 설정: `tools.sandbox`

OMG 추가 설정:
- `runtime.sandbox`: `none|docker|podman|seatbelt`
- `runtime.sandboxFlags`: 추가 런타임 플래그
- `runtime.sandboxImage`: 컨테이너 이미지 이름

## 11.2 Dockerfile 템플릿

```dockerfile
FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
  tmux git ripgrep ca-certificates && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# optional: preinstall gemini cli + omg deps
# RUN npm i -g @google/gemini-cli

CMD ["bash"]
```

## 11.3 CI 통합 (GitHub Actions 예시)

```yaml
name: omg-verify
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run verify -- --suite smoke
```

---

## 12. 디렉토리 blueprint (tree)

```text
oh-my-gemini/
  package.json
  README.md
  PRD.md
  src/
    cli/
      index.ts
      commands/
        setup.ts
        doctor.ts
        team-run.ts
        verify.ts
    team/
      orchestrator.ts
      phase-controller.ts
      runtime/
        backend.ts
        tmux-backend.ts
        subagents-backend.ts
      state/
        paths.ts
        io.ts
        schema.ts
    installer/
      setup.ts
      marker-merge.ts
    verify/
      smoke.ts
      integration.ts
      reliability.ts
  extensions/
    oh-my-gemini/
      gemini-extension.json
      GEMINI.md
      commands/
        setup.toml
        team/
          run.toml
          verify.toml
      skills/
        plan/
          SKILL.md
  docs/
    architecture/
      runtime.md
      state.md
    setup/
      sandbox.md
    testing/
      gates.md
  tests/
    smoke/
    integration/
    reliability/
  .omg/
    setup-scope.json
    state/
      ...
```

---

## 13. Gate 0~3 수락 기준 (체크리스트)

## Gate 0: Foundation
- [ ] `omg setup`/`omg doctor`/`omg team run`/`omg verify` 명령 엔트리 동작
- [ ] extension manifest + commands + skill scaffold 생성
- [ ] 기본 state 디렉토리 생성

## Gate 1: Core Runtime MVP
- [ ] tmux backend로 워커 스폰/태스크 할당 가능
- [ ] `inbox.md`/`done.json` 계약 준수
- [ ] phase 전이(`plan/exec/verify/fix/complete/failed`) 기록

## Gate 2: Reliability
- [ ] watchdog이 dead pane/stale heartbeat 감지
- [ ] fix-loop cap(기본 3) 초과 시 failed 전이
- [ ] resume/shutdown 시 상태 일관성 유지
- [ ] integration/reliability 테스트 통과

## Gate 3: Release Readiness
- [ ] docs(architecture/setup/testing) 완성
- [ ] verify 전체 스위트 green
- [ ] 샘플 extension 명령과 skill 동작 검증
- [ ] CI에서 smoke gate 상시 통과

---

## 참고 레퍼런스 (직접 조회)

1. `Yeachan-Heo/oh-my-codex` README 및 `src/team/*`, `src/cli/setup.ts`, `src/config/generator.ts`
2. `Yeachan-Heo/oh-my-claudecode` README 및 `src/team/runtime.ts`, `src/team/phase-controller.ts`, `src/team/state-paths.ts`, `.claude-plugin/plugin.json`
3. `google-gemini/gemini-cli` docs:
   - `docs/extensions/writing-extensions.md`
   - `docs/extensions/reference.md`
   - `docs/cli/custom-commands.md`
   - `docs/cli/gemini-md.md`
   - `docs/cli/sandbox.md`
   - `docs/core/subagents.md`

---

## 14. 2026-02-27 검증 기반 계획반영 업데이트 (Team consensus input)

본 섹션은 2026-02-27에 5개 병렬 워커(`$team 5:codex`)가 `PRD.md` 범위를 교차 검토한 결과를 반영한다.

### 14.1 검증 결과 요약

- PRD의 핵심 11개 항목(비전/CLI/Extension/Skill/GEMINI.md/tmux/FSM/상태/설치/Sandbox/Gate) 존재 확인
- 구현 갭 우선순위는 기존 제안과 동일하게 재확인:
  1) tmux runtime
  2) phase state machine(fix-loop cap=3)
  3) durable state
  4) verify reliability gate
  5) setup marker merge + idempotency
- 검증 명령 보고:
  - PASS: `npm run typecheck`
  - PASS: `npm run test`
  - PASS: `npm run verify` (또는 smoke/integration/reliability 지정 실행)
  - PASS/N/A: 린트는 `package.json`에 `lint` 스크립트 미정의

### 14.2 우선순위 재정렬 (계획 반영)

#### P0 (즉시)
1. **tmux 멀티 워커 실행 계약 완성**
   - pane spawn/dispatch, worker inbox 전달, done 신호 수집
2. **`.omg/state/team/<name>/` 내구 상태 확장**
   - `tasks/`, `mailbox/`, `workers/*`를 atomic write로 일관 저장

#### P1 (다음)
1. **Phase FSM 고정**
   - `plan -> exec -> verify -> fix -> complete/failed`
   - 기본 `fix-loop cap = 3`, 전이 로그/실패 이유 필수 기록
2. **Verify 게이트 상향**
   - release 기준 기본 검증을 smoke+integration+reliability 3단으로 고정

#### P2 (후속)
1. **setup/doctor 고도화**
   - marker merge idempotency 보장 강화
   - scope precedence/auto-fix 안정화

### 14.3 ralplan 입력용 실행 백로그 (합의 계획 초안)

1. **Wave 1 (Foundation, 1주)**: 상태 경로/스키마/atomic IO 고정
2. **Wave 2 (Runtime, 1~2주)**: tmux 멀티 워커 spawn + inbox/done 계약
3. **Wave 3 (Control Loop, 1주)**: phase-controller + fix-loop=3 + 실패 분류
4. **Wave 4 (Quality Gates, 1주)**: verify 3단 통합 + CI gate 반영
5. **Wave 5 (Ops Hardening, 1주)**: doctor/setup idempotency + resume/shutdown 안정화
