# Issue tracker: GitHub

Issue 和规格存放在当前仓库的 GitHub Issues，使用 `gh` CLI 操作。
仓库由 Git remote 推断。

权限遵循上级 AGENTS.md；本配置不授予 issue 写入权限。

## 操作约定

- 读取：`gh issue view <number> --comments`；需要标签时加 `--json labels`。
- 列出：`gh issue list`，按需指定状态和标签过滤。
- 创建：`gh issue create --title "..." --body "..."`。
- 评论：`gh issue comment <number> --body "..."`。
- 标签：`gh issue edit <number> --add-label "..." --remove-label "..."`。
- 关闭：`gh issue close <number> --comment "..."`。
- 多行正文使用 heredoc。

技能要求“发布到 issue tracker”时，创建 GitHub issue；
要求“获取相关 ticket”时，读取对应 issue 及评论。

## Pull requests as a triage surface

**PRs as a request surface: no.**
