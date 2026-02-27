## Initial Task Assignment
Task ID: 7
Worker: worker-7
Subject: oh-my-gemini 완전한 PRD 작성

두 레포(oh-my-codex: https://github.com/Yeachan-Heo/oh-my-codex, oh-my-claudecode: https://github.com/Yeachan-Heo/oh-my-claudecode)와 Gemini CLI 문서(https://github.com/google-gemini/gemini-cli/tree/main/docs)를 직접 조회하여 oh-my-gemini의 완전한 PRD를 작성하라. 현재 프로젝트 내역은 무시하고 순수하게 두 레포와 Gemini CLI 특성에 기반하여 작성하라.

기본 방향: oh-my-codex의 tmux 런타임 패턴 + oh-my-claudecode의 extension-first UX 표면 + Gemini 고유 기능(extension 배포, sandbox, subagents opt-in).

PRD 포함 항목:
1. 제품 비전 & 목표
2. 사용자 페르소나 & 사용 시나리오
3. 기능 목록 (MVP vs Phase 2 vs Phase 3)
4. CLI 커맨드 정의 (omg setup/doctor/team/verify 등)
5. Extension 커맨드 정의 (Gemini extension 진입점)
6. 스킬 시스템 설계 (SKILL.md 기반)
7. tmux 워커 런타임 설계 (워커 생명주기, done.json, watchdog)
8. 팀 phase 상태 머신 설계 (plan→exec→verify→fix)
9. 상태 파일 구조 & 경로 규약
10. 설치 시스템 설계 (setup scope, marker merge, idempotency)
11. Sandbox 통합 설계
12. 디렉토리 & 파일 구조 blueprint
13. 수락 기준 (Gate별 체크리스트)

결과를 전체 마크다운 문서로 done.json summary에 포함시켜라. 최대한 구체적이고 구현 가능한 수준으로 작성하라.

When complete, write done signal to .omc/state/team/omg-prd-research/workers/worker-7/done.json:
{"taskId":"7","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.