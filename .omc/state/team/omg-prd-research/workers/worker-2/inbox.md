## Initial Task Assignment
Task ID: 2
Worker: worker-2
Subject: oh-my-codex tmux 런타임 & 워커 생명주기 분석

GitHub 레포 https://github.com/Yeachan-Heo/oh-my-codex 를 조회하여 tmux 런타임 구현을 정밀 분석하라. 분석 항목: (1) 워커 tmux pane 스폰 방식(세션/윈도우/pane 명명 규칙), (2) inbox.md 파일 포맷과 전달 타이밍, (3) done.json 스키마와 sentinal 감지 로직, (4) watchdog 및 dead pane 탐지 메커니즘, (5) 워커 cleanup 및 rollback 정책, (6) 모니터 snapshot 구조. 결과를 상세 마크다운으로 작성하여 done.json summary에 포함시켜라.

When complete, write done signal to .omc/state/team/omg-prd-research/workers/worker-2/done.json:
{"taskId":"2","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.