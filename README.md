# Je1zzz 的笔记

网站：https://je1zzz.github.io/github-page-obsidian/

使用 Hugo 和用户选择的 [Hugo Bear Blog](https://themes.gohugo.io/themes/hugo-bearblog/) 主题。Obsidian 负责写作，GitHub Actions 负责部署。

## 写作与发布

源笔记库在同级 `github_page_obsidian`。在笔记属性中设置 `publish: true`，使用 `tags` 分组。双击笔记库里的 `发布网站.cmd` 即可导出公开文章、校验构建并推送。

本仓库仅包含导出的公开文章和这些文章引用的附件。不要直接编辑 `content/` 后期待回写 Obsidian，它是生成的发布副本。

## 本地构建

安装 Hugo 0.167.0 与 Node.js，克隆时带 `--recurse-submodules`。

```powershell
npm ci
node scripts/export-vault.mjs
hugo server
```

## 更换主题

主题作为 Git submodule 位于 `themes/hugo-bearblog`；版本固定，构建可复现。

添加另一个 Hugo 主题后修改 `hugo.toml` 的 `theme`。请同时检查 `layouts/` 中本站的中文导航、列表模板与 `custom_head.html`；这些覆盖文件可能需要适配新主题。公开文章与 Obsidian 插件不受主题切换影响。

## Obsidian 兼容范围

导出器转换常用 `[[笔记链接]]`、`![[图片]]` 和 Markdown 本地图片/附件链接。链接到未公开笔记只保留文字，不导出目标；不自动嵌入其他笔记正文。Obsidian 插件、Dataview 和媒体专用布局不会在 Hugo 中运行。

Hugo 标签支持多标签分组；`技术/人工智能` 在此作为一个标签，不自动产生父级分类。

取消公开并再次发布会移除当前内容，但此前公开版本仍可能在 Git 历史中。
