# Worker 4 — Final 단계 체크리스트 (Runtime/State/Command Surface)

Date: 2026-03-02  
Scope: OmC/OmX parity 프로그램의 P0/P1 실행 체크리스트

## 0) 순서 고정 체크 (착수 전)

- [ ] 구현 순서를 `state/protocol -> command -> runtime truthfulness -> docs/gates`로 합의했다.
- [ ] `subagents`는 evidence parity 전까지 opt-in 유지 원칙을 확인했다.
- [ ] legacy bypass는 임시 호환용이며, 최종 게이트(C7) 전 제거 대상임을 명시했다.

## 1) State / Control-plane 체크리스트 (선행 필수)

- [ ] task lifecycle 변경은 claim/transition/release 경유로만 처리한다.
- [ ] direct task-file overwrite 또는 우회 write 경로를 금지/감시한다.
- [ ] dependency unresolved task는 claim 불가가 유지된다.
- [ ] claim token/lease mismatch/expiry rejection 테스트가 있다.
- [ ] terminal transition 시 claim 정리(clear)가 보장된다.

## 2) Worker Protocol 체크리스트

- [ ] ACK -> claim -> execute -> result -> idle 흐름이 문서/테스트/운영에서 동일하다.
- [ ] 프로토콜 위반 시 결정적 reason code/로그를 남긴다.
- [ ] mailbox notified/delivered idempotency가 보장된다.
- [ ] non-reporting/dead/watchdog 실패 신호가 monitor에 일관 반영된다.

## 3) Command Surface 체크리스트 (`omg team status/resume/shutdown`)

- [ ] help/usage/json output 계약이 테스트로 고정됐다.
- [ ] exit-code 계약(0/1/2)이 회귀 테스트로 보장된다.
- [ ] `resume`은 persisted run input 부재/오류 경로를 명확히 안내한다.
- [ ] `shutdown`의 운영 종료 의미와 작업 성공 완료 의미가 혼동되지 않도록 문서화했다.

## 4) Runtime Truthfulness 체크리스트 (tmux vs subagents)

- [ ] tmux default 경로에서 success checklist(health/task/verify gate)가 충족되어야만 completed 처리된다.
- [ ] subagents completed 판정은 required artifact + verification evidence와 연동된다.
- [ ] cross-backend parity 테스트에서 동일 acceptance 기준을 사용한다.
- [ ] runtime snapshot 필수 필드(`verifyBaselinePassed`, `roleOutputs`, `successChecklist`) 누락 시 실패 처리된다.

## 5) Docs / Help / Gate Lockstep 체크리스트

- [ ] CLI help, README, quickstart, runbook 명령 예시가 동기화되었다.
- [ ] `omx` 의존 runbook은 의도된 호환 문맥인지, 아니면 `omg` 표면으로 전환할지 명확히 표기했다.
- [ ] C3..C7 게이트 정의와 실제 테스트/워크플로우가 일치한다.
- [ ] PR 템플릿 또는 리뷰 체크에 docs drift 검사 항목을 포함했다.

## 6) Rollout / Rollback 체크리스트

- [ ] Ring 0->1->2->3 진입/종료 조건을 문서에 명시했다.
- [ ] 각 Ring 승급 전 rollback drill evidence를 남겼다.
- [ ] bypass 토글 없이 baseline green임을 릴리즈 직전 확인한다.

## 7) Done 선언 전 최종 확인

- [ ] 리스크 R-STATE-01 / R-RUNTIME-01 / R-CMD-01 / R-CMD-02가 완화되었는지 확인했다.
- [ ] 변경사항이 canonical docs(01~03) 원칙과 충돌하지 않는다.
- [ ] 수용기준 문서(별도 owner)와 검증명령 문서(별도 owner)와 교차검토를 완료했다.
