---
name: asa-create-searchtab-campaign
description: 通过 opencli 浏览器自动化在 Apple Ads UI 创建 Search Tab Campaign（Standard Invoice 模式，无总预算上限）。API v5 强制要求总预算字段，必须走 UI 创建。
trigger: asa-create-searchtab-campaign, 创建searchtab, 创建search tab campaign, searchtab campaign, search tab广告
---

# ASA Create SearchTab Campaign

## 为什么必须用 UI 而不是 API

Apple Ads API v5 对 `APPSTORE_SEARCH_TAB` campaign 强制返回 `TOTAL_BUDGET_IS_REQUIRED`，即使账户是 Standard Invoice（LOC）模式也无法绕过。UI 端支持不填总预算直接创建，因此必须走 opencli 浏览器自动化。

---

## 账户固定信息（JuJuBit）

| 字段 | 值 |
|------|----|
| App | JuJuBit |
| Org ID | 21145943 |
| Advertiser | JuJuBit |
| Order number | 6754280964 |
| Buyer name | Sam Bridges |
| Buyer email | sambridgeswalking@gmail.com |
| Billing contact email | yangyi@vastai3d.com |

---

## 入参（调用本 skill 时用户需提供）

| 参数 | 说明 | 示例 |
|------|------|------|
| campaign_name | Campaign 名称 | JuJuBit_US_SearchTab |
| daily_budget | 日预算（USD） | 20 |
| adgroup_name | Ad Group 名称 | JuJuBit_US_SearchTab_25-54-Male |
| cpt_bid | Max CPT Bid | 0.25 |
| gender | 性别定向（All / Male / Female） | Male |
| age_from | 年龄下限（18-65） | 25 |
| age_to | 年龄上限（18-65+） | 54 |
| ad_name | Ad 名称 | JuJuBit_SearchTab_Ad |
| start_enabled | 创建后是否立即开启（默认 false，即 PAUSED） | false |

---

## 执行流程

### Step 0：打开 Apple Ads 并进入创建页面

```bash
opencli operate open "https://app-ads.apple.com/cm/app/21145943/report"
opencli operate wait time 4
```

确认页面加载后点 Create Campaign：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-button')) {
    const btn = el.shadowRoot?.querySelector('button');
    if(btn && el.textContent?.trim() === 'Create Campaign') { btn.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 4
```

---

### Step 1：选 App + Placement + Country → Continue

**选 JuJuBit app**（type 触发 autocomplete）：

```bash
# 找到 app search input 的 index，通常是 [11]
opencli operate state  # 确认 index
opencli operate type 11 "JuJuBit"
opencli operate wait time 2
```

点击下拉中的 JuJuBit：

```bash
opencli operate eval "(()=>{
  for(const li of document.querySelectorAll('li')) {
    if(li.textContent?.includes('JuJuBit') && li.textContent?.includes('Holymolly')) {
      li.click(); return 'ok';
    }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

**选 Search Tab**（radio 在 shadow DOM 内）：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('*')) {
    if(el.shadowRoot) {
      const r = el.shadowRoot.getElementById('APPSTORE_SEARCH_TAB');
      if(r) { r.click(); return 'ok'; }
    }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

**选 United States**：

```bash
# 找到 country input index（通常 [21]）
opencli operate state  # 确认 index
opencli operate type 21 "United States"
opencli operate wait time 1
opencli operate eval "(()=>{
  for(const li of document.querySelectorAll('li')) {
    if(li.textContent?.trim() === 'United States') { li.click(); return 'ok'; }
  }
  return 'not found';
})()"
```

**点 Continue**：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-button')) {
    const btn = el.shadowRoot?.querySelector('button');
    if(btn && el.textContent?.trim() === 'Continue') { btn.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 3
```

---

### Step 2：填 Campaign 基础信息

截图确认页面，找各字段 index（`opencli operate state`）。通常 index 分配如下：

| 字段 | 通常 index |
|------|-----------|
| Campaign Name | [12] |
| Daily Budget | [17] |
| Advertiser or Product | [18] |
| Order number | [19] |
| Primary contact name | [20]（已预填 Sam Bridges）|
| Primary contact email | [21]（已预填）|
| Billing contact email | [22] |

```bash
opencli operate type 12 "<campaign_name>"
opencli operate type 17 "<daily_budget>"
opencli operate type 18 "JuJuBit"
opencli operate type 19 "6754280964"
opencli operate type 22 "yangyi@vastai3d.com"
```

> ⚠️ Standard Invoice 默认已选中，不需要手动点。确认 Invoicing Options 中 "Standard Invoice" 有蓝点即可。

---

### Step 3：填 Ad Group 信息

滚动到 "Create Ad Group" 区域，找字段 index（通常 [118] 和 [122]）：

```bash
opencli operate scroll down
opencli operate state  # 找 apui-wc-input-11、apui-wc-input-12
opencli operate type 118 "<adgroup_name>"
opencli operate type 122 "<cpt_bid>"
```

---

### Step 4：设置 Audience 定向

**选 Choose Specific Audiences**：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('*')) {
    if(el.children.length === 0 && el.textContent?.trim() === 'Choose Specific Audiences') {
      el.click(); return 'ok';
    }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

**展开 Demographics**：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('*')) {
    const sr = el.shadowRoot;
    if(!sr) continue;
    for(const child of sr.querySelectorAll('*')) {
      if(child.textContent?.trim() === 'Demographics') { child.click(); return 'ok'; }
    }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

**设置 Gender**（在 shadow DOM 中找 span[title=Male/Female]）：

```bash
# 如果是 Male：
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-dropdown, apui-wc-menu')) {
    const sr = el.shadowRoot;
    if(!sr) continue;
    const target = sr.querySelector('span[title=Male]');
    if(target) { target.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 1
```

**设置 Age Range（下限）**——点击并选择：

```bash
# 通用方法：找 visible span[title='<age_from>'] 并点击
opencli operate eval "(()=>{
  function searchAll(root, depth) {
    if(depth > 8) return null;
    for(const el of root.querySelectorAll('*')) {
      if(el.tagName === 'SPAN' && el.title === '25' && el.offsetParent !== null) return el;
      if(el.shadowRoot) { const f = searchAll(el.shadowRoot, depth+1); if(f) return f; }
    }
    return null;
  }
  const el = searchAll(document, 0);
  if(el) { el.click(); return 'ok'; }
  return 'not found';
})()"
opencli operate wait time 1
```

**设置 Age Range（上限）**——先开下拉（dropdown-8），再点目标年龄：

```bash
# 开上限 dropdown
opencli operate eval "(()=>{
  function clickInAll(fn, root, depth) {
    if(depth > 6) return false;
    for(const el of root.querySelectorAll('*')) {
      if(fn(el)) return true;
      if(el.shadowRoot && clickInAll(fn, el.shadowRoot, depth+1)) return true;
    }
    return false;
  }
  clickInAll(el => { if(el.id === 'apui-wc-dropdown-8') { el.click(); return true; } return false; }, document, 0);
  return 'opened';
})()"
opencli operate wait time 1

# 点可见的目标年龄（如 54）
opencli operate eval "(()=>{
  function searchAll(root, depth) {
    if(depth > 8) return null;
    for(const el of root.querySelectorAll('*')) {
      if(el.tagName === 'SPAN' && el.title === '54' && el.offsetParent !== null) return el;
      if(el.shadowRoot) { const f = searchAll(el.shadowRoot, depth+1); if(f) return f; }
    }
    return null;
  }
  const el = searchAll(document, 0);
  if(el) { el.click(); return 'ok'; }
  return 'not found';
})()"
opencli operate wait time 1
```

> ⚠️ 上限 dropdown 的 ID 是 `apui-wc-dropdown-8`，下限是 `apui-wc-dropdown-7`，但 ID 编号可能随页面状态浮动。实际操作时用 `opencli operate state` 确认。

---

### Step 5：创建 Ad

滚到 Ad 区域，点 Create Ad：

```bash
opencli operate scroll down
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-button')) {
    const btn = el.shadowRoot?.querySelector('button');
    if(btn && el.textContent?.trim() === 'Create Ad') { btn.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

填 Ad name（通常 placeholder 是 "Name your ad"）：

```bash
opencli operate eval "(()=>{
  const input = document.querySelector('input[placeholder=\"Name your ad\"]');
  if(input) {
    input.focus();
    input.value = '<ad_name>';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
    return 'ok';
  }
  return 'not found';
})()"
# 再用 state 找到该 input index，点一下确保 blur 触发 validation
opencli operate state  # 找 apui-wc-input-13 之类的
opencli operate click <ad_name_input_index>
opencli operate keys "End"
```

Default Product Page 默认已选中（蓝框），直接点 Save：

```bash
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-button')) {
    const btn = el.shadowRoot?.querySelector('button');
    if(btn && el.textContent?.trim() === 'Save') { btn.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 2
```

---

### Step 6：提交创建

滚到底部，点 Create Campaign：

```bash
opencli operate scroll down
opencli operate eval "(()=>{
  for(const el of document.querySelectorAll('apui-wc-button')) {
    const btn = el.shadowRoot?.querySelector('button');
    if(btn && el.textContent?.trim() === 'Create Campaign') { btn.click(); return 'ok'; }
  }
  return 'not found';
})()"
opencli operate wait time 5
```

---

### Step 7：创建后处理

页面跳回 Campaigns 列表后，用 MCP 查询新 Campaign ID 并根据 `start_enabled` 决定状态：

```
# 查询
mcp__apple-ads__list_campaigns conditions=[{field:name, operator:EQUALS, values:[<campaign_name>]}]

# 如果 start_enabled = false（默认）：
mcp__apple-ads__update_campaign campaignId=<id> status=PAUSED

# 如果 start_enabled = true：
# 不操作，保持 ENABLED
```

---

## 常见问题排查

| 问题 | 原因 | 解法 |
|------|------|------|
| element index 找不到 | 页面滚动后 index 重新编号 | 用 JS eval + shadow DOM 遍历代替 index click |
| Gender span[title=Male] 找不到 | dropdown 未开启 | 先 click dropdown input，再找 visible span |
| Age 上限 dropdown 不知道 index | dropdown-8 ID 浮动 | `opencli operate state` 搜 `apui-wc-dropdown-8` 确认 |
| Ad name 提交报错 "Enter ad name" | React 未感知 value 变化 | 额外 click 该 input 触发 blur |
| 创建后 Campaign 是 RUNNING | 默认 ENABLED | 立即调用 `update_campaign status=PAUSED` |

---

## 截图检查点

每个关键步骤后执行 `opencli operate screenshot /tmp/asa_step_N.png` 并读取验证，关键节点：

- Step 1 完成：App=JuJuBit, Placement=Search Tab, Country=United States
- Step 2 完成：Campaign Name 正确，Daily Budget 正确，Standard Invoice 选中，LOC 字段已填
- Step 4 完成：Gender=Male（或目标），Age Range=25-54（或目标）
- Step 5 完成：Ad Name 正确，TAP DESTINATION=Default Product Page
- Step 7 完成：Campaign 出现在列表，状态符合预期
