---
schema_version: 1
task_id: T001
from: connor
status: done
completed_at: 2026-07-01T07:32:07Z
---

## 结论摘要
已阅读 Apple 官方 Apple Ads Campaign Management API 5 文档并对照本项目，补齐 3 个 Custom Product Page 支持端点的 MCP tool 暴露，已创建 issue #1 和 PR #2。

## 详细发现
- 官方文档覆盖范围包括 Apps、Campaigns、Budget Orders、Ad Groups、Targeting/Negative Keywords、Search Geolocations、Ads、Ad Rejection Reasons、Creatives、Custom Product Pages、Reports、Impression Share Reports。
- 本项目已覆盖主要 CRUD、reporting、organization ACL、OAuth、keywords/negative keywords、org-level ad group/ad find、countries/device sizes resources 等能力。
- 发现的可补齐差口：以下官方端点虽然已有 resource 或间接参数路径，但没有独立 tool，MCP client 的 tool discovery 不够直接：
  - `GET /apps/{adamId}/product-pages/{productPageId}/locale-details`
  - `GET /countries-or-regions`
  - `GET /creativeappmappings/devices`
- 已实现新增工具：
  - `get_product_page_locales`
  - `get_supported_countries_regions`
  - `get_app_preview_device_sizes`
- 同步修正 README：工具总数从 54 更新为 59；Creatives 从 5 更新为 8；Optimization 从 2 更新为 4，并补入已注册的 `get_recommendations` / `dismiss_recommendation`。

## 建议操作
- Review 并合并 PR #2：https://github.com/YishanCoding/apple-ads-mcp/pull/2
- 后续如果要继续扩展，可把 API coverage matrix 固化为 docs 或测试，避免 README 与实际注册工具再次漂移。

## 验证依据
- GitHub issue: https://github.com/YishanCoding/apple-ads-mcp/issues/1
- GitHub PR: https://github.com/YishanCoding/apple-ads-mcp/pull/2
- `node --check dist/tools/creatives.js` 通过。
- `git diff --check` 通过。
- Node 脚本统计当前 `dist/tools/*.js` 注册工具数为 59。
- `npm run build` 未完成：当前 checkout 未安装 `tsc`，且仓库没有 `src/` / `tsconfig`，本次按现有仓库形态直接修改 shipped `dist` 文件。
