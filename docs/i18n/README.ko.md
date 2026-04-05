[English](README.md) | **Korean** | [Chinese](README.zh.md) | [Japanese](README.ja.md)

<p align="center">
  <img src="docs/assets/omg_logo.png" alt="oh-my-gemini" width="240" />
</p>

# oh-my-gemini

[![npm version](https://img.shields.io/npm/v/oh-my-gemini-sisyphus?color=cb3837)](https://www.npmjs.com/package/oh-my-gemini-sisyphus)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-gemini?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-gemini/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **자매 프로젝트:** Claude Code 또는 Codex를 선호하시나요? [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) 및 [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)를 참고하세요.

**Gemini CLI를 위한 멀티 에이전트 오케스트레이션. 학습 비용은 거의 없습니다.**

_Gemini CLI를 억지로 다루지 마세요. 그냥 OMG를 실행하세요._

[빠른 시작](#빠른-시작) • [팀 모드](#팀-모드-권장) • [기능](#기능) • [CLI 참조](#cli-참조) • [요구 사항](#요구-사항)

---

## 빠른 시작

**1단계: 설치**

```bash
npm install -g oh-my-gemini-sisyphus
```

**2단계: 설정**

```bash
omg setup --scope project
```

`omg setup`은 이제 현재 설치를 기준으로 OMG Gemini 확장도 자동 등록합니다.

**3단계: Gemini 시작**

```bash
omg
```

이것으로 끝입니다.

`omg`는 OMG 확장이 로드된 상태로 Gemini CLI를 실행합니다. 이미 tmux 안에 있다면 그 안에서 실행되고, 아니라면 OMG가 새 tmux 세션을 자동으로 시작합니다.

### 다음으로 실행하면 좋은 명령

```bash
omg doctor
omg verify
omg hud --watch
```

---

## 설치 방법

### npm으로 설치하기 (CLI + Extension)

```bash
npm install -g oh-my-gemini-sisyphus
omg setup --scope project
```

`omg setup`은 로컬 설정 파일을 적용하고 oh-my-gemini를 Gemini CLI 확장으로 자동 등록합니다.

### Gemini Extension으로 설치하기 (확장만)

```bash
gemini extensions install github:jjongguet/oh-my-gemini
```

확장만 직접 설치하는 방식입니다. `omg team run`, `omg doctor`, `omg verify` 같은 전체 CLI 기능까지 쓰려면 npm 패키지도 전역 설치하세요.

---

## 팀 모드 (권장)

OMG는 tmux 우선 설계입니다. `omg team run`은 실제 Gemini 기반 워커 세션을 조율하고, `.omg/state/` 아래에 상태를 저장하며, 장시간 작업을 위한 라이프사이클 명령을 제공합니다.

```bash
# 병렬 구현 또는 리뷰
omg team run --task "review src/team and src/cli for reliability gaps" --workers 4

# 작업 접두 키워드로 백엔드/역할을 명시적으로 라우팅
omg team run --task "/subagents $planner /review /verify ship the release checklist" --workers 3

# 기존 실행 상태 확인 또는 재개
omg team status --team oh-my-gemini --json
omg team resume --team oh-my-gemini --max-fix-loop 1

# 작업이 끝나면 정상 종료
omg team shutdown --team oh-my-gemini --force
```

**기본 백엔드:** `tmux`  
**선택 백엔드:** 명시적인 역할 태그 실행을 위한 `subagents`

---

## 왜 oh-my-gemini인가요?

- **Gemini 네이티브 워크플로우** - Gemini를 보조 제공자로 덧붙이는 대신 Gemini CLI 중심으로 설계되었습니다
- **학습 비용이 거의 없는 진입점** - `omg`가 바로 대화형 세션을 시작하므로 외워야 할 확장 설정이 없습니다
- **팀 중심 오케스트레이션** - 지속되는 라이프사이클 상태와 재개 가능한 실행을 갖춘 협업형 워커 실행
- **검증 게이트 기반 전달** - `omg verify`가 typecheck, smoke, integration, reliability 스위트를 묶어서 실행합니다
- **운영 가시성** - HUD, doctor, 상태 기반 라이프사이클 명령으로 실행을 관찰하고 복구할 수 있습니다
- **스킬 인지 런타임** - `deep-interview`, `review`, `verify`, `handoff` 같은 재사용 가능한 스킬을 CLI와 확장 중심 흐름 모두에서 사용할 수 있습니다
- **OMC / OMX 패밀리의 일부** - OMC(Claude Code), OMX(Codex)의 Gemini 형제 프로젝트로, Gemini 우선 워크플로우에 맞게 조정되었습니다

---

## 기능

### 오케스트레이션 모드

| 기능 | 설명 | 사용 목적 |
| ---- | ---- | -------- |
| **Team** | 지속 상태, 상태 점검, resume/shutdown/cancel 제어를 갖춘 멀티 워커 오케스트레이션이며 기본 런타임은 tmux입니다 | 병렬 구현, 리뷰, 장시간 협업 작업 |
| **Interactive Launch** | `omg` / `omg launch`가 현재 tmux pane 또는 새 tmux 세션에서 OMG 확장을 로드한 Gemini CLI를 시작합니다 | 설정 부담 없이 일상적인 대화형 Gemini 개발 |
| **Verify** | `omg verify`가 `typecheck`, `smoke`, `integration`, `reliability` 검증 단계를 패키지 형태로 실행합니다 | 릴리스 점검, 신뢰도 게이트, CI 친화적인 검증 |
| **HUD** | `omg hud`가 저장된 팀 상태를 기반으로 실시간 상태 오버레이를 렌더링합니다 | JSON 상태 파일을 뒤지지 않고 활성 실행 모니터링 |
| **Skills** | `omg skill`이 `deep-interview`, `review`, `verify`, `cancel`, `handoff` 같은 재사용 가능한 프롬프트를 제공합니다 | 반복 가능한 워크플로우, 가이드된 실행, 운영자 인수인계 |

### 더 큰 개발 생산성

- **Doctor 명령**으로 Node, Gemini CLI, tmux, 확장 자산, `.omg/state` 쓰기 가능 여부를 점검
- **결정론적 상태 저장**을 `.omg/state` 아래에 유지해 재개 가능한 오케스트레이션 지원
- 패키지 루트에서 제공되는 **Gemini 네이티브 확장 패키징**과 `/omg:*` 명령 네임스페이스
- 필요 시 더 깊은 Gemini 통합을 위한 **선택적 MCP/도구 표면**

---

## 매직 키워드

파워 유저를 위한 선택적 단축키입니다. OMG는 일반 CLI 명령만으로도 잘 동작합니다.

| 키워드 / 단축키 | 효과 | 예시 |
| --------------- | ---- | ---- |
| `/tmux` 또는 `$tmux` | tmux 팀 백엔드를 강제 | `omg team run --task "/tmux smoke"` |
| `/subagents` 또는 `/agents` | subagents 백엔드를 강제 | `omg team run --task "/subagents $planner /verify release dry run" --workers 2` |
| `$planner` 또는 `$plan` | subagents 작업 시작 시 planner 역할 지정 | `omg team run --task "$planner draft the implementation plan" --workers 1` |
| `/review` | code-reviewer 역할로 매핑 | `omg team run --task "/subagents /review inspect auth changes" --workers 1` |
| `/verify` | verifier 역할로 매핑 | `omg team run --task "/subagents /verify confirm the gate passes" --workers 1` |
| `/handoff` | 인계 아티팩트를 위한 writer 역할로 매핑 | `omg team run --task "/subagents /handoff summarize the release state" --workers 1` |
| `--madmax` | Gemini 시작 시 대화형 실행 옵션을 `--yolo --sandbox=none`으로 확장 | `omg --madmax` |

---

## CLI 참조

| 명령 | 설명 | 예시 |
| ---- | ---- | ---- |
| `omg` | OMG 확장을 로드한 상태로 Gemini CLI를 대화형으로 실행 | `omg` |
| `omg launch` | 기본 대화형 실행 명령의 명시적 형태 | `omg launch --yolo` |
| `omg team run` | 새 오케스트레이션 팀 실행 시작 | `omg team run --task "smoke" --workers 3` |
| `omg team status` | 저장된 단계, 워커, 작업 상태 점검 | `omg team status --team oh-my-gemini --json` |
| `omg team resume` | 저장된 메타데이터에서 이전 실행 재개 | `omg team resume --team oh-my-gemini --max-fix-loop 1` |
| `omg team shutdown` | 저장된 런타임 핸들을 정상 종료 | `omg team shutdown --team oh-my-gemini --force` |
| `omg team cancel` | 활성 작업을 취소로 표시하고 라이프사이클 진행 중단 | `omg team cancel --team oh-my-gemini --force --json` |
| `omg doctor` | 로컬 전제 조건을 진단하고 안전한 문제를 자동 수정 | `omg doctor --fix --json` |
| `omg verify` | 검증 스위트 또는 티어 기반 검증 계획 실행 | `omg verify --tier thorough` |
| `omg hud` | 실시간 팀 HUD를 렌더링하거나 계속 감시 | `omg hud --watch --interval-ms 1000` |
| `omg skill` | 재사용 가능한 스킬 프롬프트를 나열하거나 출력 | `omg skill list` |

자세한 명령 문서: [`docs/omg/commands.md`](docs/omg/commands.md)

---

## 요구 사항

### 필수

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)**

빠른 확인:

```bash
node -v
gemini --version
tmux -V
```

### tmux 설치 힌트

| 플랫폼 | 설치 |
| ------ | ---- |
| macOS | `brew install tmux` |
| Ubuntu / Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows (WSL2) | `sudo apt install tmux` |

### 선택 사항

- 격리된 smoke 점검, 샌드박스 실험, 일부 기여자 워크플로우를 위한 **Docker 또는 Podman**

일반 설치, 대화형 사용, 표준 팀 오케스트레이션에는 Docker가 **필수는 아닙니다**.

---

## 라이선스

MIT

---

<div align="center">

**자매 프로젝트:** [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) • [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)

**Gemini 네이티브 오케스트레이션. 최소한의 절차.**

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-gemini&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-gemini&type=date&legend=top-left)

## 💖 프로젝트 후원

oh-my-gemini가 Gemini CLI 워크플로우를 개선해 준다면, 프로젝트 후원을 고려해 주세요.

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)

### 왜 후원해야 하나요?

- Gemini 우선 오케스트레이션 개발을 계속 이어갈 수 있습니다
- 팀 런타임, HUD, 검증 워크플로우의 완성도를 높일 수 있습니다
- 오픈소스 문서, 스킬, 운영 도구 유지에 도움이 됩니다
- OMG / OMC / OMX 생태계를 지원합니다

### 다른 도움 방법

- ⭐ 저장소 스타 누르기
- 🐛 버그 제보
- 💡 기능 제안
- 📝 코드 또는 문서 기여
