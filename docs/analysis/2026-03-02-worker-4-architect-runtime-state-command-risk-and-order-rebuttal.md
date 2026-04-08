# Worker 4 — Architect 단계: 런타임/상태/명령면 리스크 + 의존성 순서 반박 검토

Date: 2026-03-02  
Status: Draft for team reconcile

## 1) 검토 범위

- Runtime backend: `src/team/runtime/{tmux-backend,subagents-backend}.ts`
- Control-plane/state: `src/team/control-plane/*`, `src/state/team-state-store.ts`, `docs/architecture/state-schema.md`
- Command surface: `src/cli/commands/team-{status,resume,shutdown}.ts`, `src/cli/index.ts`, `docs/testing/live-team-e2e.md`

## 2) 핵심 리스크 (Architect 관점)

### R-STATE-01 (High): "control-plane 존재"와 "전면 강제" 사이 갭
- 사실: claim/transition/release API는 도입됨 (`src/team/control-plane/task-lifecycle.ts`).
- 리스크: `TeamStateStore.writeTask` 직접 호출/파일 직접쓰기 경로가 남아 있으면 lifecycle 무결성(토큰/lease/from-status)이 우회될 수 있음.
- 영향: false-green 완료, 경쟁 상태, dependency 역전.

### R-RUNTIME-01 (High): subagents 완료 판정의 truthfulness 리스크
- 사실: `subagents` backend는 `monitorTeam()`에서 deterministic `completed` + `verifyBaselinePassed=true`를 구성 가능 (`src/team/runtime/subagents-backend.ts`).
- 리스크: 실제 실행 증거보다 계약 스텁/합성 출력이 먼저 통과할 수 있음.
- 영향: tmux 대비 parity claim 과장, gate 신뢰도 저하.

### R-CMD-01 (Medium): 명령면/운영 runbook 표면 불일치
- 사실: CLI에는 `omp team status/resume/shutdown`가 존재 (`src/cli/index.ts`, command files).
- 리스크: 운영 runbook 일부는 여전히 `omx team ...` 중심 (`docs/testing/live-team-e2e.md`).
- 영향: 운영자 혼선, 장애 시 잘못된 복구 절차 선택.

### R-CMD-02 (Medium): shutdown 의미론이 phase 종결과 결합
- 사실: `team shutdown`은 비종결 phase를 `completed`로 전이 가능 (`team-shutdown.ts` 내부 `persistShutdownTransition`).
- 리스크: "운영 종료"와 "작업 성공 완료"가 의미적으로 혼합될 수 있음.
- 영향: status/resume 판단 오해, 사후 분석 난이도 증가.

### R-ORDER-01 (High): 구현 순서 역전 시 리스크 증폭
- 사실: command surface를 먼저 강화하면 adoption이 빨라짐.
- 리스크: 상태/프로토콜 강제 전에 명령 사용이 확산되면 잘못된 의미론이 고착됨.
- 영향: 이후 breaking correction 필요, 롤백 비용 상승.

## 3) 의존성 순서(권고) + 반박 논리

## 권고 순서 (P0/P1)
1. **State invariants first**: claim/transition/release + direct-write 금지 경계 명확화
2. **Worker protocol enforcement**: ACK→claim→execute→result→idle 추적/검증
3. **Command surface hardening**: status/resume/shutdown 의미론을 위 두 계약에 종속
4. **Runtime truthfulness parity**: subagents 완료 판정을 evidence-gated로 정렬
5. **Docs/help/gates lockstep**: runbook/help/CI 게이트를 동시 갱신

## 반박 포인트 (Counterarguments)

### 반박 A: "명령부터 먼저 내놓고 내부는 나중에"
- 반박: operator 습관이 먼저 형성되면, 이후 의미론 교정이 사실상 breaking change가 됨.
- 근거: 현재도 `omp` 명령 존재 vs 일부 `omx` runbook 공존으로 drift 조짐.

### 반박 B: "subagents completed면 parity 달성"
- 반박: completion 문자열이 아니라 **증거-기반 완료 규칙**이 parity 기준.
- 근거: deterministic role output/verify gate 신호만으로는 실제 작업성 보증이 부족.

### 반박 C: "gates는 마지막에 붙이면 된다"
- 반박: gate가 늦으면 잘못된 계약이 누적되어 교정비용이 폭증.
- 권고: C3..C7 성격의 검증을 구현 파동과 같은 wave에서 추가.

## 4) Go/No-Go 체크포인트

- **Go**
  - lifecycle mutation이 control-plane 경로로만 수행됨을 테스트/리뷰 규칙으로 증명
  - status/resume/shutdown가 runbook/help/tests와 동기화
  - subagents 완료 판정이 artifact + verification evidence 기반

- **No-Go**
  - legacy/bypass 토글 없이는 baseline 미통과
  - "completed"가 evidence 없이 산출되는 경로 존재
  - command docs/help/runbook 중 하나라도 계약에서 이탈

## 5) 결론

Architect 관점의 핵심은 **명령 표면 확장보다 상태/프로토콜 무결성을 선행하는 순서 통제**다.  
현재 코드는 control-plane/명령 기반이 갖춰졌지만, subagents truthfulness·문서 표면·shutdown 의미론에서 순서 역전 리스크가 남아 있다.  
따라서 P0/P1 계획은 "state/protocol -> command -> runtime truthfulness -> gate/doc" 순으로 고정해야 한다.
