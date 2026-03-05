# Feature-wise Readiness Check

`verify:features`는 오픈베타 핵심 기능을 **기능 축별**로 빠르게 검증하는 명령입니다.

## 목적

- Team Orchestration
- Hook System
- Agent Skill/Role
- Setup/Doctor 계약
- Core command 계약

각 축을 개별 또는 전체로 실행해, 회귀 범위를 줄이고 운영자가 빠르게 상태를 확인할 수 있습니다.

## 명령

```bash
npm run verify:features
```

### 옵션

```bash
npm run verify:features -- --dry-run
npm run verify:features -- --feature team
npm run verify:features -- --feature hook
npm run verify:features -- --feature skill
npm run verify:features -- --feature setup
npm run verify:features -- --feature core
npm run verify:features -- --feature all
```

- `--dry-run`: 실행 없이 점검 항목/명령만 출력
- `--feature <...>`: 특정 기능 축만 실행
  - `team`: Feature 1 (Team Orchestration)
  - `hook`: Feature 2 (Hook System)
  - `skill`: Feature 3 (Agent Skill/Role)
  - `setup`: Feature 4 (Setup/Doctor)
  - `core`: Feature 5 (Core Commands)
  - `all`: 전체 실행 (기본값)

## 리포트

- 경로: `.omx/reports/feature-readiness-<timestamp>-<pid>.md`
- 포함 항목:
  - 실행 시각
  - 선택된 feature
  - total checks 수
  - 체크별 PASS/FAIL (또는 DRY_RUN)
  - 명령 tail 로그
  - summary(pass/fail)
