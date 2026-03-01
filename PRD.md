# oh-my-gemini 종합 기획문서 (PRD)

<!-- markdownlint-disable MD013 -->

- 문서 버전: v2.1 (final)
- 작성/갱신일: 2026-03-01
- 기준 저장소: `/Users/teamipsiwikidev/jjk/jjong/oh-my-gemini`
- 문서 목적: 현재 구현 상태(As-Is)를 기준으로, 출시 가능한 품질로 수렴하기 위한 요구사항/로드맵/검증/피드백 체계를 확정한다.

---

## 0. Executive Summary

`oh-my-gemini`는 Gemini CLI 환경에서 **확장(Extension)-우선**,
**tmux-기본**, **내구성 상태 저장(Durable State)**,
**검증 게이트(verify)** 중심의 멀티에이전트 오케스트레이션을 제공한다.

현재 코드베이스는 Gate 1A/1B 수준의 기반 기능을 갖추고 있으며,
본 문서는 **신뢰성 하드닝(Gate 2)**과 **릴리즈 준비(Gate 3)**에 필요한
실행 계획을 완성본으로 정리한다.

---

## 1. 현재 상태 진단 (As-Is Snapshot)

### 1.1 이미 구현된 핵심 표면

- CLI: `setup`, `doctor`, `team run`, `verify`
- Runtime backend: `tmux`(기본), `subagents`(실험적 opt-in)
- 팀 단계: `plan -> exec -> verify -> fix -> completed|failed`
- 상태 저장: `.omg/state/team/<team>/...` 중심 파일 계약
- 테스트 하네스: `smoke`, `integration`, `reliability`

### 1.2 명령/스크립트 기준 운영 표면

- `npm run setup`
- `npm run doctor`
- `npm run omg -- doctor --fix --json` (필요 시)
- `npm run omg -- team run --task "..."`
- `npm run verify`
- `npm run test:smoke`
- `npm run test:integration`
- `npm run test:reliability`
- `npm run team:e2e -- "..."` (운영자 실사용 시나리오)

### 1.3 코드/문서 기준 확인된 정책

- 워커 수 계약: 기본 `3`, 허용 `1..8`
- fix-loop cap 기본값: `3`
- 터미널 phase canonical: `completed` (`complete`는 호환 정규화 대상)
- 성공 체크리스트: health + verify baseline + required task 완료 + failed task 없음

### 1.4 현재 갭 (핵심)

1. 장시간/실환경 운영에서의 장애 복구 시나리오 증거 축적 필요
2. 문서와 실제 런타임 규약의 지속 동기화 강화 필요
3. 린트 스크립트 부재로 스타일 품질 게이트가 약함
4. 운영자 관점의 실패 원인 분류/가이드 고도화 여지 존재

---

## 2. 문제 정의와 기회

### 2.1 문제

Gemini CLI 단독 사용만으로는 다음이 반복적으로 어렵다.

- 멀티 워커 작업의 재현 가능한 실행
- 실패 시 어떤 단계에서 왜 실패했는지 추적
- 자동 수정 루프의 종료 조건 통제
- 설치/검증/운영 절차의 일관성

### 2.2 기회

`oh-my-gemini`가 위 문제를 표준화하면:

- 개인/팀 모두 동일한 방식으로 멀티에이전트 작업을 반복 가능
- 장애 분석/복구 시간이 짧아짐
- 릴리즈 전 품질 검증을 자동화된 게이트로 강제 가능

---

## 3. 사용자/페르소나 및 JTBD

### Persona A — 확장형 파워 유저

- 목표: 하나의 지시를 계획-실행-검증까지 자동화
- JTBD: “복잡한 작업을 멀티 워커로 돌리고, 실패 시 자동 복구 루프까지 통제하고 싶다.”

### Persona B — 저장소 메인테이너

- 목표: PR/릴리즈 품질을 재현 가능한 기준으로 통일
- JTBD: “누가 실행해도 같은 품질 게이트를 통과하는 워크플로우를 유지하고 싶다.”

### Persona C — 운영자/검증 담당

- 목표: 장애 감지와 원인 파악을 빠르게 수행
- JTBD: “상태 파일/이벤트 로그만으로 실패 원인을 명확히 식별하고 복구 액션을 결정하고 싶다.”

---

## 4. 제품 목표 / 비목표

### 4.1 제품 목표 (Goals)

1. **Extension-first UX 고정**: 사용자는 Gemini extension을 기준 진입점으로 사용
2. **tmux-default 안정성 확보**: 기본 런타임 경로를 가장 견고하게 유지
3. **Durable state 보장**: 중요한 전이는 파일 상태로 원인 추적 가능
4. **Verify-gated delivery**: smoke/integration/reliability 통과 전 완료 불가
5. **고장-친화성(Fault-aware) 강화**: watchdog/heartbeat/fix-loop 정책 일관 적용

### 4.2 비목표 (Non-goals, 현 단계)

- GUI 대시보드 제품화
- 분산 멀티호스트 실행(클러스터 스케줄링)
- 서브에이전트별 독립 모델 선택
- 의미론적 요구사항 오해까지 완전 자동 복구

---

## 5. 범위 정의 (Must / Should / Later)

- **Must**
  - tmux 기본 경로 안정화
  - 상태 계약 고정
  - verify 3단 게이트
  - fix-loop cap=3
  - setup/doctor idempotent 및 안전한 auto-fix 유지
- **Should**
  - subagents backend 결정론/관측성 강화
  - 운영자 e2e 증거 자동 수집
  - 실패 분류(환경/계약/런타임/검증) 리포트 표준화
- **Later**
  - 고급 UI
  - 원격 워커 풀
  - 정책 엔진 고도화

---

## 6. 상세 요구사항

### 6.1 기능 요구사항 (FR)

### FR-SETUP-01 Idempotent Setup

- 동일 입력 N회 실행 시 결과가 안정적이어야 한다.
- 관리 블록(marker) 중복 삽입 금지.

### FR-DOCTOR-01 Actionable Diagnostics

- `node/npm/gemini/tmux/container` 사전조건을 검사한다.
- `--fix`는 안전한 변경만 수행하고 결과를 재검증한다.

### FR-TEAM-01 Team Run Contract

- `--task` 필수.
- `--workers`는 `1..8`, 기본 `3`.
- invalid 인자는 exit code `2`로 즉시 실패.

### FR-RUNTIME-01 Backend Determinism

- 기본 backend는 `tmux`.
- `subagents`는 명시적 opt-in이며 assignment 수와 worker 수가 일치해야 한다.

### FR-PHASE-01 Lifecycle FSM

- canonical phase: `plan -> exec -> verify -> fix -> completed|failed`
- `fix`는 최대 `3`회 후 강제 실패.

### FR-STATE-01 Durable State Contract

- canonical task 경로: `tasks/task-<id>.json`
- mailbox: `mailbox/<worker>.ndjson` append-only (legacy `.json` read 호환)
- worker 상태 아티팩트: `workers/<worker>/{inbox.md,identity,status,heartbeat,done}`

### FR-VERIFY-01 Gate Enforcement

- `verify` 기본 실행 스위트: `smoke,integration,reliability`
- 하나라도 실패하면 전체 실패.

### FR-OBS-01 Failure Explainability

- 실패 시 actionable reason을 상태/결과에 남긴다.
- health monitor의 dead/non-reporting/watchdog 신호를 기록한다.

### 6.2 비기능 요구사항 (NFR)

### NFR-REL-01 신뢰성

- 상태 쓰기는 원자적(atomic)이어야 한다.
- 비정상 종료 후에도 phase/task/mailbox 복구 가능해야 한다.

### NFR-DET-01 결정성

- 동일 입력 + 동일 환경에서 phase/event 결과가 일관되어야 한다.

### NFR-OPS-01 운영성

- 운영자는 `.omg/state` 아티팩트만으로 진행/장애를 파악할 수 있어야 한다.

### NFR-DOC-01 문서 정합성

- README/docs/CLI help의 명령 표면이 상충하지 않아야 한다.

---

## 7. UX/운영 플로우

### 7.1 초기 온보딩

1. `npm install`
2. `npm run setup`
3. `npm run setup:subagents` (subagents backend 사용 시)
4. `npm run doctor`
5. `npm run omg -- doctor --fix --json` (필요 시)
6. `npm run verify`

### 7.2 팀 실행

1. `npm run omg -- team run --task "..."`
2. phase 진행(`plan -> exec -> verify`)
3. 실패 시 `fix` 진입 후 재실행
4. `completed|failed` 터미널 상태 기록

### 7.3 장애 대응

1. monitor snapshot/phase/events 확인
2. dead/non-reporting/watchdog 분류
3. 원인별 조치(환경 재구성, task 재할당, 설정 수정)
4. verify 재실행 후 상태 확정

---

## 8. 피드백 루프 설계 (핵심)

요구사항 “피드백 진행”을 제품 프로세스에 내장하기 위해 두 계층 루프를 강제한다.

### 8.1 자동 피드백 루프 (Runtime Loop)

- `verify` 실패 → `fix` 시도 → 재검증
- 최대 `3`회 재시도
- 초과 시 `failed` + 실패 원인 확정 기록

### 8.2 인간 피드백 루프 (Planning/Review Loop)

- PRD/설계 변경 시 아래 템플릿으로 리뷰를 남긴다.

### 리뷰 템플릿

1. 어떤 요구사항이 불충분했는가?
2. 어떤 증거(테스트/로그/운영사례)로 확인했는가?
3. 문서/코드 중 무엇을 수정했는가?
4. 재발 방지를 위한 규약/게이트는 무엇인가?

### 반영 원칙

- 피드백은 반드시 **요구사항 번호(FR/NFR)** 또는 **게이트 항목**에 매핑한다.
- “의견”이 아니라 “검증 가능한 변경”으로 종료한다.

---

## 9. 아키텍처/계약 요약

### 9.1 Layered Architecture

- Layer A: CLI/Extension UX
- Layer B: Team Orchestrator + Phase Controller
- Layer C: Runtime Backends (`tmux`, `subagents`)
- Layer D: State Store (atomic JSON/NDJSON)
- Layer E: Verification & CI gates

### 9.2 Runtime Backend 계약

- `probePrerequisites(cwd)`
- `startTeam(input)`
- `monitorTeam(handle)`
- `shutdownTeam(handle)`

### 9.3 상태 계약 (Canonical)

```text
.omg/state/team/<team>/
  phase.json
  monitor-snapshot.json
  events/phase-transitions.ndjson
  tasks/task-<id>.json
  mailbox/<worker>.ndjson
  workers/<worker>/
    inbox.md
    identity.json
    status.json
    heartbeat.json
    done.json
```

---

## 10. 품질 게이트 및 검증 계획

### 10.1 Gate 기준

### Gate 1A (기반)

- setup/doctor/verify 정상 동작
- sandbox wiring 검증

### Gate 1B (오케스트레이션 MVP)

- team run 성공 경로
- worker count 계약 준수
- phase terminal `completed` 기록

### Gate 2 (신뢰성)

- dead/non-reporting/watchdog 감지
- fix-loop cap 강제
- verify baseline 신호 엄격 체크

### Gate 3 (릴리즈)

- 문서-코드 정합성
- reliability 포함 전체 게이트 녹색
- 운영자 e2e 증거 확보

### 10.2 실행 증거 포맷

- 명령
- 종료코드
- 핵심 출력 3~10줄
- PASS/FAIL 판정
- 실패 시 다음 액션

---

## 11. 로드맵 (2026-Q2 제안)

- **R1 Reliability Hardening (1~2주)**
  - 목표: watchdog/heartbeat/fix-loop 강화
  - Exit Criteria: reliability suite 안정 통과
- **R2 Operator Readiness (1주)**
  - 목표: 실패 분류 리포트/운영 가이드 개선
  - Exit Criteria: 장애 재현-복구 runbook 완성
- **R3 Release Prep (1주)**
  - 목표: 문서/게이트/샘플 워크플로우 마감
  - Exit Criteria: verify 전체 + live e2e 증거

---

## 12. 성공 지표 (KPI)

1. **검증 통과율**: main 브랜치 기준 verify 통과율 95%+
2. **재현성 지표**: 동일 시나리오 재실행 시 phase/event 편차 최소화
3. **장애 감지 시간**: dead/non-reporting 탐지 평균 시간 단축
4. **수정 루프 효율**: fix-loop 1~2회 내 해결 비율 증가
5. **문서 신뢰도**: README/CLI/docs 불일치 이슈 건수 감소

---

## 13. 리스크와 대응

| 리스크                | 영향             | 대응                              |
| --------------------- | ---------------- | --------------------------------- |
| tmux/환경 의존성 편차 | 실행 실패/불안정 | doctor 사전검증 + runbook 명시    |
| LLM 비결정성          | 결과 편차        | 상태/이벤트/검증 게이트로 통제    |
| 문서-구현 드리프트    | 운영 혼선        | PR 체크리스트에 문서 정합성 포함  |
| 과도한 자동복구 기대  | 문제 은닉        | fix-loop cap + 명시적 failed 전이 |

---

## 14. 오픈 이슈 (결정 필요)

1. 린트 게이트를 공식 검증 체인에 포함할지 여부 (`npm run lint` 부재)
2. live team e2e를 정식 릴리즈 필수 게이트로 승격할지 여부
3. subagents backend의 안정성 기준(실험 단계 종료 조건) 정의
4. legacy compatibility env(`OMG_LEGACY_*`) 유지 기간 결정

---

## 15. 이번 문서 반영 피드백 로그 (Self-review 포함)

### Round 1 — 문제 식별

- 일부 과거 문서에서 `complete`/`completed` 용어 혼재
- task/mailbox 경로 표기가 legacy와 canonical이 혼용
- “피드백 진행” 요구가 프로세스로 정의되지 않음

### Round 2 — 수정 반영

- 터미널 phase를 `completed`로 통일
- 상태 경로를 canonical 기준으로 재정의
- 자동/인간 피드백 루프를 분리 정의
- Gate/KPI/리스크/오픈이슈까지 포함해 실행 가능성 강화
- 중복 초안 문서(`docs/planning/2026-03-01-complete-planning-worker-3.md`)는
  PRD 최종본과 내용이 중복되어 제거하고,
  합의 실행 계획은 `.omx/plans/ralplan-prd-finalization-2026-03-01.md`로 일원화

### Round 3 — 완료 판정

- 본 PRD는 현재 저장소 상태와 운영 요구를 기준으로 실행 가능한 계획 문서로 확정
- 다음 변경은 반드시 FR/NFR 또는 Gate 항목에 매핑하여 업데이트

---

## 16. Definition of Done (문서 기준)

- [x] 현재 구현 상태(As-Is) 반영
- [x] 목표/범위/요구사항/검증/로드맵 포함
- [x] 피드백 루프(자동 + 인간) 명시
- [x] 운영 가능한 게이트/증거 포맷 정의
- [x] 리스크 및 오픈 이슈 명시

---

## 17. 문서 정리/중복 제거 로그 (2026-03-01)

- 제거 대상: `docs/planning/2026-03-01-complete-planning-worker-3.md` (초안)
- 제거 이유:
  1. `PRD.md`와 문제정의/범위/게이트/로드맵이 중복되어 단일 기준 문서 원칙 위반.
  2. 동일 시점 다중 기준 문서가 있으면 운영/검증 시 참조 충돌 가능성이 높음.
  3. 최종 실행계획은 `.omx/plans/ralplan-prd-finalization-2026-03-01.md`로 분리해
     “전략(PRD) vs 실행(ralplan)” 역할을 명확히 고정.
