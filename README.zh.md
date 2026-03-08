[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md)

<p align="center">
  <img src="docs/assets/omg_logo.png" alt="oh-my-gemini" width="240" />
</p>

# oh-my-gemini

[![npm version](https://img.shields.io/npm/v/oh-my-gemini-sisyphus?color=cb3837)](https://www.npmjs.com/package/oh-my-gemini-sisyphus)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-gemini?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-gemini/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **姊妹项目：** 更喜欢 Claude Code 或 Codex？请查看 [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) 和 [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)。

**面向 Gemini CLI 的多代理编排。几乎零学习成本。**

_别再和 Gemini CLI 较劲了。直接运行 OMG。_

[快速开始](#快速开始) • [团队模式](#团队模式推荐) • [功能](#功能) • [CLI 参考](#cli-参考) • [环境要求](#环境要求)

---

## 快速开始

**步骤 1：安装**

```bash
npm install -g oh-my-gemini-sisyphus
```

**步骤 2：初始化**

```bash
omg setup --scope project
```

**步骤 3：启动 Gemini**

```bash
omg
```

就这么简单。

`omg` 会在加载 OMG 扩展的情况下启动 Gemini CLI。如果你已经在 tmux 中，它会直接在当前环境里运行；否则 OMG 会自动为你创建一个新的 tmux 会话。

### 接下来建议执行的命令

```bash
omg doctor
omg verify
omg hud --watch
```

---

## 团队模式（推荐）

OMG 以 tmux 为优先：`omg team run` 会协调真正由 Gemini 驱动的 worker 会话，将状态持久化到 `.omg/state/`，并为长时间运行的任务提供生命周期命令。

```bash
# 并行实现或代码审查
omg team run --task "review src/team and src/cli for reliability gaps" --workers 4

# 通过任务前缀关键字显式路由后端/角色
omg team run --task "/subagents $planner /review /verify ship the release checklist" --workers 3

# 查看或恢复已有运行
omg team status --team oh-my-gemini --json
omg team resume --team oh-my-gemini --max-fix-loop 1

# 完成后优雅关闭
omg team shutdown --team oh-my-gemini --force
```

**默认后端：** `tmux`  
**可选后端：** `subagents`，用于显式带角色标签的运行

---

## 为什么选择 oh-my-gemini？

- **Gemini 原生工作流** - 围绕 Gemini CLI 构建，而不是把 Gemini 作为次要提供方拼接进去
- **零学习成本入口** - `omg` 直接启动交互式会话，无需记忆扩展安装细节
- **团队优先的编排** - 协调多个 worker 执行，并具备持久化生命周期状态和可恢复运行能力
- **验证门控交付** - `omg verify` 将 typecheck、smoke、integration、reliability 测试统一打包执行
- **可观测的运维体验** - HUD、doctor 和有状态的生命周期命令让运行更容易观测与恢复
- **具备技能感知的运行时** - `deep-interview`、`review`、`verify`、`handoff` 等可复用技能同时适用于 CLI 与扩展优先流程
- **OMC / OMX 家族的一员** - 作为 OMC（Claude Code）和 OMX（Codex）的 Gemini 兄弟项目，为 Gemini 优先工作流做了专门适配

---

## 功能

### 编排模式

| 功能 | 说明 | 适用场景 |
| ---- | ---- | -------- |
| **Team** | 多 worker 编排，具备持久化状态、健康检查、resume/shutdown/cancel 控制，并以 tmux 作为默认运行时 | 并行实现、代码审查、长时间协作任务 |
| **Interactive Launch** | `omg` / `omg launch` 会在当前 tmux pane 或新的 tmux 会话中启动已加载 OMG 扩展的 Gemini CLI | 日常交互式 Gemini 开发，无需反复配置 |
| **Verify** | `omg verify` 运行打包好的验证层级，覆盖 `typecheck`、`smoke`、`integration`、`reliability` | 发布检查、信心门槛、适合 CI 的验证流程 |
| **HUD** | `omg hud` 基于持久化团队状态渲染实时状态叠层 | 无需翻查 JSON 状态文件即可监控活动运行 |
| **Skills** | `omg skill` 提供 `deep-interview`、`review`、`verify`、`cancel`、`handoff` 等可复用提示 | 可重复工作流、引导式执行、操作员交接 |

### 更多开发者杠杆

- **Doctor 命令** 用于检查 Node、Gemini CLI、tmux、扩展资源以及 `.omg/state` 的可写性
- 在 `.omg/state` 下进行**确定性状态持久化**，支持可恢复的编排流程
- 通过 `extensions/oh-my-gemini/` 提供**扩展优先打包**
- 在需要更深层 Gemini 集成时，可使用**可选的 MCP / 工具接口**

---

## 魔法关键字

给高级用户准备的可选快捷方式。OMG 也完全支持普通 CLI 命令。

| 关键字 / 快捷方式 | 效果 | 示例 |
| ----------------- | ---- | ---- |
| `/tmux` 或 `$tmux` | 强制使用 tmux 团队后端 | `omg team run --task "/tmux smoke"` |
| `/subagents` 或 `/agents` | 强制使用 subagents 后端 | `omg team run --task "/subagents $planner /verify release dry run" --workers 2` |
| `$planner` 或 `$plan` | 在 subagents 任务开始时分配 planner 角色 | `omg team run --task "$planner draft the implementation plan" --workers 1` |
| `/review` | 映射到 code-reviewer 角色 | `omg team run --task "/subagents /review inspect auth changes" --workers 1` |
| `/verify` | 映射到 verifier 角色 | `omg team run --task "/subagents /verify confirm the gate passes" --workers 1` |
| `/handoff` | 映射到 writer 角色，用于交接产物 | `omg team run --task "/subagents /handoff summarize the release state" --workers 1` |
| `--madmax` | 启动 Gemini 时将交互式参数扩展为 `--yolo --sandbox=none` | `omg --madmax` |

---

## CLI 参考

| 命令 | 作用 | 示例 |
| ---- | ---- | ---- |
| `omg` | 以交互模式启动已加载 OMG 扩展的 Gemini CLI | `omg` |
| `omg launch` | 默认交互式启动命令的显式写法 | `omg launch --yolo` |
| `omg team run` | 启动一个新的团队编排运行 | `omg team run --task "smoke" --workers 3` |
| `omg team status` | 查看已持久化的阶段、worker 和任务健康状态 | `omg team status --team oh-my-gemini --json` |
| `omg team resume` | 根据持久化元数据恢复先前运行 | `omg team resume --team oh-my-gemini --max-fix-loop 1` |
| `omg team shutdown` | 优雅停止持久化的运行时句柄 | `omg team shutdown --team oh-my-gemini --force` |
| `omg team cancel` | 将活动任务标记为已取消并停止生命周期推进 | `omg team cancel --team oh-my-gemini --force --json` |
| `omg doctor` | 诊断本地前置条件，并可选择自动修复安全问题 | `omg doctor --fix --json` |
| `omg verify` | 运行验证套件或按层级执行验证计划 | `omg verify --tier thorough` |
| `omg hud` | 渲染实时团队 HUD，或持续监看 | `omg hud --watch --interval-ms 1000` |
| `omg skill` | 列出或打印可复用技能提示 | `omg skill list` |

详细命令文档：[`docs/omg/commands.md`](docs/omg/commands.md)

---

## 环境要求

### 必需

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)**

快速检查：

```bash
node -v
gemini --version
tmux -V
```

### tmux 安装提示

| 平台 | 安装命令 |
| ---- | -------- |
| macOS | `brew install tmux` |
| Ubuntu / Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows (WSL2) | `sudo apt install tmux` |

### 可选

- **Docker 或 Podman**，用于隔离的 smoke 检查、沙箱实验和部分贡献者工作流

OMG 在常规安装、交互式使用或标准团队编排中**不依赖** Docker。

---

## 许可证

MIT

---

<div align="center">

**姊妹项目：** [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) • [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)

**Gemini 原生编排。尽量减少仪式感。**

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-gemini&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-gemini&type=date&legend=top-left)

## 💖 支持这个项目

如果 oh-my-gemini 改善了你的 Gemini CLI 工作流，可以考虑赞助这个项目：

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)

### 为什么要赞助？

- 让 Gemini 优先编排的开发持续推进
- 资助团队运行时、HUD 和验证工作流的打磨
- 帮助维护开源文档、技能和操作工具
- 支持 OMG / OMC / OMX 生态

### 其他支持方式

- ⭐ 给仓库点 Star
- 🐛 报告 bug
- 💡 提出功能建议
- 📝 贡献代码或文档
