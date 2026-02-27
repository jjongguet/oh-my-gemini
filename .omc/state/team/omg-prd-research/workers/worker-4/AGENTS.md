# Team Worker Protocol

## FIRST ACTION REQUIRED
Before doing anything else, write your ready sentinel file:
```bash
mkdir -p $(dirname .omc/state/team/omg-prd-research/workers/worker-4/.ready) && touch .omc/state/team/omg-prd-research/workers/worker-4/.ready
```

## Identity
- **Team**: omg-prd-research
- **Worker**: worker-4
- **Agent Type**: codex
- **Environment**: OMC_TEAM_WORKER=omg-prd-research/worker-4

## Your Tasks
- **Task 1**: oh-my-codex CLI 커맨드 구조 분석
- **Task 2**: oh-my-codex tmux 런타임 & 워커 생명주기 분석
- **Task 3**: oh-my-codex phase 상태 머신 & 설치 시스템 분석
- **Task 4**: oh-my-claudecode extension & 스킬 시스템 분석
- **Task 5**: oh-my-claudecode 에이전트 카탈로그 & 라우팅 분석
- **Task 6**: Gemini CLI extension 스펙 & subagents 제약 분석
- **Task 7**: oh-my-gemini 완전한 PRD 작성

## Task Claiming Protocol
To claim a task, update the task file atomically:
1. Read task from: .omc/state/team/omg-prd-research/tasks/{taskId}.json
2. Update status to "in_progress", set owner to "worker-4"
3. Write back to task file
4. Do the work
5. Update status to "completed", write result to task file

## Communication Protocol
- **Inbox**: Read .omc/state/team/omg-prd-research/workers/worker-4/inbox.md for new instructions
- **Heartbeat**: Update .omc/state/team/omg-prd-research/workers/worker-4/heartbeat.json every few minutes:
  ```json
  {"workerName":"worker-4","status":"working","updatedAt":"<ISO timestamp>","currentTaskId":"<id or null>"}
  ```

## Task Completion Protocol
When you finish a task (success or failure), write a done signal file:
- Path: .omc/state/team/omg-prd-research/workers/worker-4/done.json
- Content (JSON, one line):
  {"taskId":"<id>","status":"completed","summary":"<1-2 sentence summary>","completedAt":"<ISO timestamp>"}
- For failures, set status to "failed" and include the error in summary.
- Use "completed" or "failed" only for status.

## Shutdown Protocol
When you see a shutdown request (check .omc/state/team/omg-prd-research/shutdown.json):
1. Finish your current task if close to completion
2. Write an ACK file: .omc/state/team/omg-prd-research/workers/worker-4/shutdown-ack.json
3. Exit

