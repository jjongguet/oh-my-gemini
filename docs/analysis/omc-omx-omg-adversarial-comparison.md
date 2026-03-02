# 적대적 비교: OmC (Claude Code) vs OmX (Codex) vs OmG (Gemini)

날짜: 2026-03-02  
작성 방식: OMX Team (`omx team 7:codex`) + 리더 통합 정리  
범위: 명시적 리스크/주의사항 추적을 포함한 **풀스택 하니스 비교**

---

## 1) 근거(Evidence)와 방법

이 문서는 의도적으로 적대적(critical-first) 관점으로 작성되었으며, 근거가 없는 항목은 “미확인 기능”이 아니라 “갭”으로 처리했다.

### 1.1 비교 대상 리포지토리

- **OmC** (Claude Code): `Yeachan-Heo/oh-my-claudecode`
  - Fresh clone HEAD: `2aaace9` (`/tmp/om-suite-compare/omc`)
  - 런타임 세부 분석을 위해 로컬 설치/캐시 스냅샷도 함께 검토.
- **OmX** (Codex): `Yeachan-Heo/oh-my-codex`
  - Fresh clone HEAD: `812d211` (`/tmp/om-suite-compare/omx`)
  - 로컬 설치 패키지 스냅샷도 함께 검토.
- **OmG** (Gemini): `jjongguet/oh-my-gemini`
  - 현재 작업 리포지토리 HEAD(로컬): `/Users/teamipsiwikidev/jjk/jjong/oh-my-gemini`

### 1.2 팀 실행 근거

- 팀 이름: `analyze-omc-oh-my-claudecode-a`
- 워커 수: 7
- 최종 상태: `phase=complete`, `completed=7`, `failed=0`
- Mailbox + task 결과 아티팩트:
  - `.omx/state/team/analyze-omc-oh-my-claudecode-a/mailbox/leader-fixed.json`
  - `.omx/state/team/analyze-omc-oh-my-claudecode-a/tasks/task-*.json`
  - 워커 보고서: `.omx/state/team/analyze-omc-oh-my-claudecode-a/workers/worker-*/`

### 1.3 주의사항

- OmC/OmX 런타임 내부 동작은 일부 로컬 아티팩트(`src` + 설치/캐시 dist 스냅샷) 기반 추론이 포함됨.
- OmC/OmX 일부 검증은 로컬 스냅샷에서 수행되어, 업스트림 CI 상태와 차이가 있을 수 있음.
- 그래도 본 보고서는 추정보다 **구체적인 파일/경로 근거**를 우선했다.

---

## 2) 핵심 요약 (Critical)

1. **OmX가 런타임/컨트롤플레인 하니스 강도는 가장 높다** (team lifecycle, granular state API, claim/lease semantics, tmux 운영 제어).
2. **OmC는 제품화된 오케스트레이션 표면이 가장 넓다** (플러그인 생태계, 다양한 skill/mode, multi-AI orchestration 패턴). 다만 일부 team-state 계약 정밀도는 OmX보다 덜 세분화됨.
3. **OmG는 아키텍처 경계가 깔끔하고 release-gate 규율이 강하다.** 하지만 **실제 런타임 실행 깊이는 OmC/OmX 대비 아직 낮다** (특히 team lifecycle 제어, control-plane API, 실질 task dispatch semantics).
4. **OmG의 가장 치명적인 갭**: 선언된 architecture/state contract와 실제 라이브 오케스트레이션 깊이 사이의 차이.

---

## 3) OmC ↔ OmX 관계 (어떻게 연결되는가)

| 차원 | OmC | OmX | 관계 인사이트 |
|---|---|---|---|
| 제품 포지션 | Claude-first orchestration 플랫폼 | Codex-first orchestration 플랫폼 | 둘 다 “기본 CLI 위의 agent harness” 철학 공유 |
| 오케스트레이션 코어 | Team 중심 + 레거시 facade + tmux 기반 multi-CLI lane | tmux 기반 Team 중심 + 명시적 lifecycle 명령 | 구조적으로 OmX가 운영형 runtime controller에 더 가까움 |
| Skill 중심 워크플로우 | 있음 (fresh clone 기준 37 skills) | 있음 (fresh clone 기준 34 skills) | 둘 다 skill UX를 1급 제어면으로 사용 |
| Prompt/Agent 카탈로그 | Agent/skill 중심 | Prompt(`/prompts:*`) + skill 이중 카탈로그 | Prompt 카탈로그 UX는 OmX가 더 강함 |
| 상태/런타임 엄격성 | 높지만 일부 실패 경로에서 혼합적 의미론 | 매우 높음(엄격한 contract + mutation API) | deterministic team-state mutation은 OmX가 더 엄격 |
| 배포 전략 | 플러그인 마켓플레이스 + npm binary | npm binary + setup 기반 Codex 증강 | OmC는 생태계 우선, OmX는 CLI runtime 운영성 우선 |

**정리:** OmC와 OmX는 오케스트레이션 DNA를 공유하지만, OmX는 더 “runtime operations/control-plane” 지향이고, OmC는 더 “ecosystem/product-surface” 지향이다.

---

## 4) OmG와 OmC/OmX의 연관성

| 관점 | OmG의 현재 상태 (vs OmC/OmX) |
|---|---|
| 전략 적합성 | 방향은 맞음 (Gemini-native orchestration harness) |
| 패키징 모델 | extension-first 접근이 강함 (Gemini extension + CLI dual surface) |
| 아키텍처 설계 | 경계 문서(`docs/architecture/*`) + `RuntimeBackend` 추상화가 깔끔 |
| 런타임 성숙도 | 라이브 team control-plane 깊이는 OmX/OmC보다 뒤처짐 |
| 테스트/릴리즈 규율 | 강함 (명시적 gate 모델 + contract script + release workflow) |
| 운영 UX 폭 | OmC/OmX 대비 command/skill 표면이 좁음 |

---

## 5) 상세 기능 매트릭스 (누락 없는 표)

## 5.1 제품 표면 / 설치 / 배포

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| npm 패키지명 | `oh-my-claude-sisyphus` | `oh-my-codex` | `oh-my-gemini` | OmC는 브랜드명/패키지명 불일치로 인지부하 증가 |
| CLI 바이너리 | `oh-my-claudecode`, `omc`, `omc-cli` | `omx` | `omg`, `oh-my-gemini` | OmG의 dual-bin alias는 UX 장점 |
| 주 배포 채널 | Claude plugin marketplace + npm | npm global package | npm global + Gemini extension assets | OmG는 여전히 명시적 extension-link 단계 필요 |
| Plugin/Extension manifest | `.claude-plugin/plugin.json`(+ marketplace metadata) | N/A (Codex setup 모델) | `extensions/oh-my-gemini/gemini-extension.json` | Gemini host-native extension 모델에는 OmG가 가장 근접 |
| Setup scope 모델 | setup 흐름은 있으나 OmX 수준 user/project 분리가 전면에 보이진 않음 | `user|project` scope 모델 | `project|user` 플래그 persisted | OmG `--scope` 계약은 존재, 실제 동작 parity는 지속 감사 필요 |
| Update 경로 | 명시적 (`update`, `update-reconcile`) | 런타임/launch 시 update 체크 | `omg update` 전용 명령 없음 | OmG lifecycle 갭 |
| Uninstall 경로 | install/remove/list 관련 명령 존재 | `uninstall` 명시 제공 | 명시적 uninstall 명령 없음 | OmG cleanup UX 갭 |
| 리포 내 release workflow | 있음 (`release.yml`) | fresh clone 기준 없음 | 있음 (`release.yml`) | OmX release 자동화 parity 갭 |

## 5.2 CLI 명령 폭과 UX

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| Top-level 명령 폭 | 매우 넓음 (24 command declaration) | 넓음 (launch/setup/uninstall/doctor/team/ralph/hud/status/cancel/reasoning...) | 좁음 (setup/doctor/extension/team run/verify) | OmG는 의도적으로 미니멀하지만 운영 관점에서는 아직 얇음 |
| Team lifecycle 명령 | commands/skills/runtime 경로로 team 의미론 제공 | `team status/resume/shutdown` 명시 | `team run`만 있음 | OmG 운영성 갭 (P0/P1) |
| Doctor UX | 풍부함(conflicts 포함) | 풍부함(`doctor` + `--team`) | JSON/fix/strict 제어 양호 | OmG doctor는 좋지만 team-runtime 진단 깊이는 OmX보다 얕음 |
| HUD 명령 | 있음 | 있음 | 없음 | 장시간 라이브 세션 가시성 갭 |
| cancel/status 모드 제어 | 있음 | 있음 | 전용 명령 부재 | OmG mode-control UX 갭 |
| Prompt 카탈로그 (`/prompts:*`) | 주 모델 아님 | 강함 (29 prompt files) | 없음 | OmG role-routing UX 경쟁력 낮음 |
| Skills 수 | 37 | 34 | extension skill 1개(`plan`) | OmG에서 가장 큰 가시적 UX 갭 |

## 5.3 오케스트레이션 런타임 / 백엔드 모델

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| Team canonical orchestration | Yes | Yes | Yes (`team run`) | OmG도 의미론은 있으나 깊이가 다름 |
| Runtime backend 추상화 | runtime module/bridge 기반 | runtime + team module 기반 | typed `RuntimeBackend` contract + registry | OmG는 추상화는 가장 깔끔, 구현 깊이는 가장 얕음 |
| 기본 backend | tmux 중심 team 실행 패턴 | tmux | tmux | 기본 방향은 동일 |
| 보조 backend | `omc-teams`, `ccg` 등 multi-CLI orchestration lane | env 매핑 기반 mixed worker CLI | `subagents` backend(실험적) | OmG subagents는 현재 deterministic-completion 성향(완전 parity 아님) |
| 실제 worker bootstrap lifecycle | 존재 | 강하게 존재 | 기본 bootstrap command 경로가 얇음 | OmG는 worker task lifecycle wiring 보강 필요 |
| Team control-plane API 깊이 | MCP team server/start-status-wait-cleanup 스타일 | granular `team_*` mutation API | OmG 동급 MCP control plane 미확인 | OmG API-level orchestration 갭 |
| Data-plane 강건성(tmux trigger) | hardening 경로 존재 | queue/retry hardening 존재 | 기본 tmux session/pane orchestration 수준 | OmG transport reliability 갭 |
| Worktree-aware team execution | broader OmC 아키텍처에 존재 | OmX runtime에 존재 | OmX parity 미달 | OmG 고급 격리 전략 갭 |

## 5.4 상태 내구성 / mutation 무결성 / 장애 복구

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| Durable state root | Yes (`.omc/state` + global/session layers) | Yes (`.omx/state`) | Yes (`.omg/state`) | 3개 모두 durable-state 의도는 분명 |
| Atomic write 규율 | fsync 옵션 포함한 강한 유틸 (`src/lib/atomic-write.ts`) | temp+rename (핵심 team state 경로에 명시 fsync는 제한적) | temp+rename helper | OmG durable-write 보장은 추가 강화 여지 큼 |
| Cross-process locking | 존재(task lock 전략 + caveat/fallback) | 강함(lock + claim/lease/transition) | in-process queue 중심, cross-process rigor 약함 | OmG concurrency safety 갭 |
| Claim token + lease semantics | 부분적/단순 lock 모델 | 강한 claim/transition/release API | 런타임 플로우에서 OmX 동급 아님 | OmG parity 갭 |
| Mailbox lifecycle(notified/delivered dedupe) | inbox/outbox 처리 존재 | notified/delivered semantics 풍부 | schema는 있으나 runtime 통합 깊이 낮음 | OmG runtime wiring 갭 |
| Failure recovery 폭 | 높음(watchdog + bridge) | 매우 높음(status/resume/shutdown + diagnostics) | orchestrator-level verify/fix loop는 양호 | OmG는 worker 단위 복구 연산 보강 필요 |
| Orchestrator phase 모델 | Team stage 모델 | Team stage 모델 | `plan->exec->verify->fix->completed/failed` | OmG phase 모델은 좋은 기반 |

## 5.5 보안 / 신뢰경계 / 샌드박스 posture

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| Dangerous bypass 노출 | 1차 표면에서 `madmax`형 명시 매핑은 상대적으로 약함 | `--madmax` 명시 제공(위험 모드) | `madmax` 플래그는 없지만 legacy env bypass 존재 | OmX는 명시적 위험, OmG는 암묵적 무결성 우회 위험 |
| workingDirectory 신뢰 경계 | trusted-root validation 강함(`validateWorkingDirectory`) | allowlist(`OMX_MCP_WORKDIR_ROOTS`) + path validation | 동급 MCP allowlist 정책 표면 없음 | OmG trust-boundary 정책 갭 |
| ID/path 안전 제약 | 혼합적(다양한 sanitize 경로) | team/worker/task safe regex 계약 엄격 | `teamName`/task ID path 하드닝 보강 필요 | OmG path/namespace hardening은 핵심 이슈 |
| Permission 모델 | advisory layer 명시 | team/mcp 흐름에 운영형 safeguard 강함 | CLI + runtime 체크 의존, 성숙도 낮음 | OmG는 least-privilege 정책 표면 명문화 필요 |
| “False green” 리스크 | 일부 경로에서 실패 문맥이 완료로 보일 여지 | explicit transition API로 상대적으로 낮음 | 실험적 subagents가 completed snapshot 합성 가능 | OmG는 completion truthfulness 강화 필요 |

## 5.6 테스트 하니스 / CI/CD / 릴리즈 게이트

| 기능 | OmC | OmX | OmG | 비판적 해석 |
|---|---|---|---|---|
| 테스트 아키텍처 | 큰 규모의 광범위 스위트 | 중간 규모 스위트 | 작지만 의도적으로 분할된 스위트 | OmG는 breadth는 작고 clarity는 높음 |
| 스위트 분할 | Vitest 중심 광범위 테스트 | Node test + project scripts | smoke/integration/reliability 분할 | OmG 분할은 운영 친화적 |
| CI workflow 수 (fresh clone) | 6 | 2 | 3 | OmG는 OmC보다 가볍고, OmX보다 게이트 구조적 |
| Release pipeline 존재 | Yes | fresh clone 기준 없음 | Yes | OmX 갭 |
| Publish pre-gate | Yes (`prepublishOnly`) | 명시 prepublish gate 없음 | Yes (`prepublishOnly -> gate:publish`) | OmG 강점 |
| 설치 계약(contract) 게이트 | OmG C0처럼 명시적이지 않음 | OmG C0처럼 명시적이지 않음 | 강함 (consumer/global install contract scripts) | OmG 뚜렷한 강점 |
| Optional/non-blocking 신호 | 일부 보조 체크 | 제한적 | CI에서 optional signal job 명시 | 엔지니어링 위생 측면에서 OmG 우수 |
| 패키지 footprint 관리 | 워커 측정 기준 무거운 편 | OmG보다 무거운 편 | lean package footprint | OmG 배포 위생 강점 |

---

## 6) “전체 기능” 인벤토리 스냅샷 (상위 지표)

| 인벤토리 축 | OmC | OmX | OmG |
|---|---:|---:|---:|
| Top-level CLI command declaration (source) | 24 | ~14 | 5 |
| Skills 디렉토리 수 | 37 | 34 | 1 (extension skill) |
| Prompt 카탈로그 파일 수 | 0 (prompt-file 중심 아님) | 29 | 0 |
| Workflows (`.github/workflows`) | 6 | 2 | 3 |
| Pruned test-file count | 269 | 108 | 20 |

해석:
- **OmC**: breadth/ecosystem + 운영 유틸리티 커버리지 최적화
- **OmX**: runtime operations/control-plane 깊이 최적화
- **OmG**: architecture cleanliness + release discipline 최적화, 단 운영/skill 표면은 아직 작음

---

## 7) OmG 우선 보완 과제 (OmC/OmX 비교 기반)

### P0 (parity 신뢰 확보를 위한 필수)

1. **team lifecycle CLI parity** 추가: `omg team status`, `omg team resume`, `omg team shutdown`.
2. 최소 bootstrap을 넘어서는 **실제 worker task dispatch/control-plane semantics** 구현 (assignment, claim/transition/release).
3. team/task 입력에 대한 **identifier/path 하드닝** 강화 (traversal/namespace ambiguity 제거).
4. `OMG_LEGACY_*` 호환 우회 플래그 제거 또는 엄격 게이팅 (unsafe mode 가시성/감사 로그 포함).

### P1 (운영 성숙도 고도화)

5. mailbox/task/worker lifecycle 자동화를 위한 OmG-native control-plane API (MCP 또는 동등 계층) 추가.
6. tmux transport 신뢰성 강화 (retry/ack/delivery semantics를 OmX/OmC 수준으로).
7. skill/role UX 표면 확대 (최소 team/help/cancel/status/hud 동급).
8. 장기 유지보수 관점의 update/uninstall lifecycle 명령 추가.

### P2 (마감 품질/생태계 적합성)

9. package metadata와 extension metadata 간 version-consistency 체크 추가.
10. npm-global + extension-link + health-check 흐름의 discoverability UX 개선.
11. 더 깊은 품질 텔레메트리를 위한 optional coverage signal/gate 추가.

---

## 8) 최종 차원별 순위 (Adversarial scoring)

척도: 1(약함) ~ 5(강함)

| 차원 | OmC | OmX | OmG |
|---|---:|---:|---:|
| Runtime control-plane depth | 4 | **5** | 2 |
| Product/UX breadth | **5** | 4 | 2 |
| Team operational lifecycle ergonomics | 4 | **5** | 2 |
| State mutation rigor | 4 | **5** | 2 |
| Security trust-boundary explicitness | 4 | **5** | 2 |
| Test/CI release discipline | 4 | 3 | **5** |
| Gemini-native extension alignment | 2 | 1 | **5** |
| Architecture clarity / boundary docs | 4 | 4 | **5** |

### 종합 결론

- 목표가 **OmC/OmX와의 runtime orchestration parity**라면, OmG는 OmX 수준의 control-plane 엄격성을 먼저 흡수해야 한다.
- 목표가 **Gemini-native product fit**이라면, OmG는 이미 올바른 packaging/boundary 전략을 갖고 있다.
- 따라서: **OmG의 extension-first 아키텍처는 유지하고, runtime/state lifecycle 깊이는 OmX 수준으로 끌어올리는 것이 최적 경로**다.

---

## 9) 참조 소스 (핵심 위주, 비완전 목록)

- OmC:
  - `/tmp/om-suite-compare/omc/README.md`
  - `/tmp/om-suite-compare/omc/src/cli/index.ts`
  - `/tmp/om-suite-compare/omc/src/lib/atomic-write.ts`
  - `/tmp/om-suite-compare/omc/src/team/task-file-ops.ts`
  - `/tmp/om-suite-compare/omc/src/lib/worktree-paths.ts`
  - `/tmp/om-suite-compare/omc/.github/workflows/{ci.yml,release.yml}`
- OmX:
  - `/tmp/om-suite-compare/omx/README.md`
  - `/tmp/om-suite-compare/omx/src/cli/index.ts`
  - `/tmp/om-suite-compare/omx/src/team/state.ts`
  - `/tmp/om-suite-compare/omx/src/team/contracts.ts`
  - `/tmp/om-suite-compare/omx/src/mcp/state-paths.ts`
  - `/tmp/om-suite-compare/omx/.github/workflows/ci.yml`
- OmG:
  - `README.md`
  - `src/cli/index.ts`
  - `src/cli/commands/team-run.ts`
  - `src/team/runtime/{runtime-backend.ts,tmux-backend.ts,subagents-backend.ts}`
  - `src/team/team-orchestrator.ts`
  - `src/state/team-state-store.ts`
  - `.github/workflows/{ci.yml,release.yml}`
  - `docs/architecture/*`, `docs/testing/gates.md`

