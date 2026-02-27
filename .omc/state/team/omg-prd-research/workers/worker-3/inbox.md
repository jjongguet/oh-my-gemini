## Initial Task Assignment
Task ID: 3
Worker: worker-3
Subject: oh-my-codex phase 상태 머신 & 설치 시스템 분석

GitHub 레포 https://github.com/Yeachan-Heo/oh-my-codex 를 조회하여 상태 머신과 설치 시스템을 정밀 분석하라. 분석 항목: (1) phase enum 값들(plan/prd/exec/verify/fix 등)과 전이 조건, (2) fix-loop 최대 횟수 설정 및 강제 종료 로직, (3) 상태 파일 스키마와 경로 규약(.omx/state/ 등), (4) setup의 marker merge 구현(기존 파일 보존 방식), (5) setup scope 시스템(project/user/global)과 precedence, (6) doctor 진단 항목 목록. 결과를 상세 마크다운으로 작성하여 done.json summary에 포함시켜라.

When complete, write done signal to .omc/state/team/omg-prd-research/workers/worker-3/done.json:
{"taskId":"3","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.