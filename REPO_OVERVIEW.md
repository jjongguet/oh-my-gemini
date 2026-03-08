# REPO_OVERVIEW

## 1) 저장소 한 줄 요약
`oh-my-gemini`는 **Gemini CLI 워크플로를 확장(extension)-우선으로 오케스트레이션**하는 TypeScript 기반 CLI 프로젝트입니다.
핵심 산출물은 `omg`/`oh-my-gemini` CLI, Gemini 확장 패키지, 팀 실행(runtime) 오케스트레이터입니다.

---

## 2) 테스트를 기준으로 본 핵심 기능(우선 분석)
이 저장소의 동작 계약은 `tests/`가 가장 명확하게 정의합니다.

### Smoke (`tests/smoke`)
- `setup`이 **idempotent**하게 동작(재실행 시 불필요한 변경 없음)
- `.gemini/sandbox.Dockerfile` 및 sandbox smoke 스크립트 존재 보장
- `--version/-V`가 `package.json` 버전과 일치

### Integration (`tests/integration`)
- `team status/resume/shutdown`이 `.omg/state`의 영속 상태와 연동
- `team run --backend subagents` 실행 시 phase/snapshot/role output 아티팩트가 결정적으로 기록
- 태스크의 `$plan`, `/verify` 같은 태그가 서브에이전트 선택으로 매핑
- `writeWorkerContext`가 `.gemini/GEMINI.md`를 생성하고 팀/스킬 컨텍스트 주입

### Reliability (`tests/reliability`)
- heartbeat/watchdog/non-reporting 감지 로직 검증
- Task claim/transition/release의 **토큰 기반 원자적 제어** 검증
- Team state store의 CAS(version)·식별자(path traversal 차단)·NDJSON 내구성 계약 검증
- role↔skill 매핑 및 verify 명령 스위트 계약(npm 스크립트 기반) 검증

즉, 이 프로젝트의 코어는 **“팀 실행 제어 + 상태 영속화 + 신뢰성 보장”**입니다.

---

## 3) 코드 구조 요약 (`src/`)
- `src/cli/`: 명령 라우팅 (`setup`, `doctor`, `extension path`, `team *`, `verify`, `worker run`, `skill`)
- `src/installer/`: setup 산출물 생성/병합 (`.gemini/settings.json`, `GEMINI.md`, sandbox Dockerfile, subagents catalog)
- `src/team/`: `TeamOrchestrator` 중심 실행·검증·fix-loop, runtime backend(tmux 기본 + subagents)
- `src/state/`: `.omg/state` 아래 task/phase/mailbox/worker 신호(JSON/NDJSON) 영속화
- `src/hooks/`, `src/skills/`: 워커 컨텍스트 주입과 스킬 디스패치

---

## 4) 패키지/배포 관점 (`package.json`)
- 패키지명: `oh-my-gemini-sisyphus` (현재 `0.2.0`)
- CLI bin: `omg`, `oh-my-gemini` → `dist/cli/index.js`
- 검증 체인: `typecheck` + `test:smoke/integration/reliability` + `verify`
- 배포 가드: `prepublishOnly -> gate:publish`로 스모크/검증 통과 강제

---

## 5) 실무에서 자주 쓰는 명령
```bash
npm run typecheck
npm run test
npm run verify

# 팀 실행
npm run omg -- team run --task "smoke"
```

---

## 6) 결론
이 저장소는 단순 CLI 유틸이 아니라,
**멀티 워커 실행을 신뢰성 있게 운영하기 위한 제어면(control plane) + 상태 모델 + 검증 하네스**를 함께 갖춘 오케스트레이션 시스템입니다.
