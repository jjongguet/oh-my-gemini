## Initial Task Assignment
Task ID: 6
Worker: worker-6
Subject: Gemini CLI extension 스펙 & subagents 제약 분석

Gemini CLI 공식 문서를 조회하라. 대상 URL: https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/index.md, https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md, https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md, https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/sandbox.md, https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md. 분석 항목: (1) gemini-extension.json 스키마(필수/선택 필드), (2) extension 내 커맨드 정의 방식(TOML/JSON), (3) GEMINI.md 컨텍스트 파일 역할, (4) subagents 활성화 조건(experimental.enableAgents)과 제약사항, (5) sandbox 설정 옵션들(-s, GEMINI_SANDBOX, sandbox.Dockerfile), (6) settings.json 지원 항목. 결과를 상세 마크다운으로 작성하여 done.json summary에 포함시켜라.

When complete, write done signal to .omc/state/team/omg-prd-research/workers/worker-6/done.json:
{"taskId":"6","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.