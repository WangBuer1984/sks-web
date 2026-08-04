# D2 · 账号定位回放面板 — 设计 spec

> **范围**：交付物 D2（D1 已合入 main）。把 `Positioning.tsx` aside 的「建库引导对话回放」从诚实占位换成真历史；history 数据走 confirm 时入库，不依赖 sks-ai checkpoint。
> **尺子**：`prototypes/extracted/sections/11-账号定位.html` 为视觉基准（只读不改）；令牌过线 B。
> **仓**：sks-web（前端回放面板 + confirm 带 turns）+ sks-server（入库 + 只读历史端点）。**不动 sks-ai**。
> **基准日期**：2026-08-04。

## 1. 目标与背景

`Positioning.tsx` aside（calibrated 分支）现为诚实占位「后端未开放历史对话读取端点」（见 `PROTOTYPE_GAP.md` 行 11「右侧建库对话回放缺」）。D2 把它换成真回放。

**关键阻塞（已解）**：访谈终态 checkpoint 里只有 `feedback`（一句）、`answers[]`（各轮答）、`current_question`（末轮，每轮覆盖）、`persona`（对象）——**没有 `questions[]`/`turns[]`**，且 sks-ai 业务代码零调用 `aget_state_history`。不改状态机的前提下无法从 checkpoint 拼出完整 Q&A。故 D2 不走 sks-ai 历史端点，改为 **confirm 时前端把 turns 一并入库**（方案 H，与已拍「存进 content JSONB」思路一致）。

## 2. 非目标

- **不**改访谈状态机（不加 `questions[]` 累加字段——那是方案 G，否决）。D1「不动状态机」不变。
- **不**动 sks-ai（无新端点、无 aget_state_history 遍历、无 AiClient.interviewHistory）。
- **不**存 `_thread_id`（H 下无消费者；history 直读 content 的 `_interview_turns`）。
- **不**改 D1 的 sample-opening（它读 checkpoint，不走 stored content，不受 meta 键影响）。
- **不**做历史版本列表（回放只展示当前 active 档案的那次访谈，对齐原型）。
- **不**改原型 HTML。

## 3. 架构总览

| 层 | 文件 | 改动 |
|---|---|---|
| sks-web | `src/pages/Calibrate.tsx` | `confirmMut` 提交时带 `turns` 状态 |
| sks-web | `src/api/profile.ts` | `confirmProfile(sessionId, turns)`；加 `InterviewTurn`/`InterviewHistoryView`/`interviewHistory()` |
| sks-web | `src/pages/Positioning.tsx` | aside 改 `useQuery(interviewHistory)`，渲染气泡或降级；文案对齐原型 |
| sks-server | `ProfileController.java` | `ConfirmRequest` 加 `turns`；加 `GET /api/profile/interview/history` |
| sks-server | `ProfileService.java` | `persistConfirm` 注 `_interview_turns`；加 `interviewTurns(userId)`；`activeProfileView` + `ScriptService` 剥 `_` 键 |
| sks-server | `PositioningProfileMapper.java` | 不改（findActive 已读 content） |
| sks-server | `docs/REST_CONTRACT.md` | 补 `GET /api/profile/interview/history` + confirm body 加 turns |

**数据流（confirm 入库）**：Calibrate done → `confirmMut` 调 `confirmProfile(sessionId, turns)` → `POST /api/profile/confirm {sessionId, turns}` → `ProfileService.confirm` → `persistConfirm` 把 `_interview_turns`（turns 数组）注入 content JSONB 落库。

**数据流（回放读）**：Positioning aside → `GET /api/profile/interview/history`（无参，userId 鉴权）→ `ProfileService.interviewTurns(userId)` → `findActive` 读 raw content → 取 `_interview_turns` 数组 → 返 `{found, turns}`。**不打 sks-ai**。

## 4. confirm 契约变更

- `ConfirmRequest`：`record ConfirmRequest(String sessionId, List<Turn> turns)`，`record Turn(String role, String text)`。`turns` 可空（旧前端/旧测试不带时 null，persistConfirm 跳过注入——向后兼容旧调用方）。
- 前端 `confirmProfile(sessionId, turns)`：`userClient.post('/profile/confirm', { sessionId, turns })`。
- Calibrate 的 `turns` 状态在 done 阶段已含完整对话（guess_feedback 的 AI 问 + 用户 feedback + 各 ask 轮 AI 问 + 用户答）。`confirmMut.mutate()` 时把 `turns` 传入。

> 注意：`turns` 是 UI 层累积的展示用对话（AI `question` 文本 + 用户 reply），不是 state 原始字段。复用 Calibrate 现有 `Turn[]` state（`{role:'ai'|'user', text}`）。

## 5. persistConfirm 注入 + strip 边界

### 5.1 注入 `_interview_turns`

`confirm(userId, sessionId, turns)` 把 `turns` 传进 `persistConfirm(userId, profileJson, aCards, turns)`。persistConfirm 用 ObjectMapper 把 `profileJson`（sks-ai 返的 inner `{人设,人群,...}`）解成 `ObjectNode`，再 `set("_interview_turns", mapper.valueToTree(turns))`，最后 `toString()` 落 content。

- `turns == null`（旧调用方）→ 不注入，content 保持原样（向后兼容）。
- `turns` 非 null → 注入；`_interview_turns` = `[{role, text}, ...]`。

### 5.2 strip `_` 前缀键（防 meta 泄漏）

`_interview_turns` 是 meta，不得泄进「创作 prompt」或「前端档案卡」。**单点剥离：在 `activeProfile(userId)` 内部**——解析 JSONB 成 Map 后 `keySet().removeIf(k -> k.startsWith("_"))` 再返回。这样 `activeProfile()` 的两个消费方都自动拿干净 profile：

1. **`activeProfileView()`**（走 activeProfile）→ 前端 GET /profile content 无 `_` 键。
2. **`ScriptService.generate`**（走 activeProfile 注入 script_gen）→ 创作 prompt 无 `_interview_turns` 污染。

解析出的 Map 是每次 JSON parse 的新实例，原地 remove 不破坏缓存对象。

**`interviewTurns(userId)` 不走 `activeProfile()`**——直接 `findActive` 读 raw content（含 `_` 键），取 `_interview_turns`（它本就是该端点的数据）。D1 `sampleOpening` 读 sks-ai checkpoint 不走 stored content，不受影响。

## 6. 历史端点

### 6.1 sks-server `GET /api/profile/interview/history`

- `ProfileController`：`@GetMapping("/interview/history")`，`@AuthenticationPrincipal Long userId`，无参。返 `ApiResponse<InterviewHistoryView>`。
- `ProfileService.interviewTurns(userId)`：
  ```java
  PositioningProfile p = profileMapper.findActive(userId);
  if (p == null || p.getContent() == null) return new InterviewHistoryView(false, List.of());
  JsonNode c = objectMapper.readTree(p.getContent());
  JsonNode turns = c.get("_interview_turns");
  if (turns == null || !turns.isArray() || turns.isEmpty()) return new InterviewHistoryView(false, List.of());
  List<Turn> list = objectMapper.readValue(turns.toString(), new TypeReference<List<Turn>>(){});
  return new InterviewHistoryView(true, list);
  ```
- `record InterviewHistoryView(boolean found, List<Turn> turns)`。`record Turn(String role, String text)` 定义在 `ProfileController`（与 `ConfirmRequest`/`InterviewRequest` 同处），`ProfileService` import 复用——confirm 与 history 共用同一 Turn 类型。
- 未校准 / 旧档案无 `_interview_turns` → `found=false, turns=[]`（前端降级占位）。
- content JSON 解析失败 → 同 found=false（不抛 500，降级）。

### 6.2 sks-web `interviewHistory()`

```ts
export interface InterviewTurn { role: 'ai' | 'user'; text: string }
export interface InterviewHistoryView { found: boolean; turns: InterviewTurn[] }
export function interviewHistory(): Promise<InterviewHistoryView> {
  return userClient.get<InterviewHistoryView, InterviewHistoryView>('/profile/interview/history');
}
```

## 7. Positioning aside 重塑

calibrated 分支 aside（现网 `src/pages/Positioning.tsx` 右侧 `<aside>`）：

- 标题改「建库引导对话」（原型），副文案改「你注册时 15 分钟聊出来的档案，随时可以重聊校准」（原型；替换现网「重新校准」说明段）。
- `useQuery({ queryKey:['profile','interview-history'], queryFn: interviewHistory })`。
- `data.found && data.turns.length` → 渲染气泡列表（`flex flex-col gap-2.5`）：
  - AI 气泡：`bg-paper-tint rounded-[10px_10px_10px_2px] max-w-[92%] px-3 py-2.5 text-caption leading-relaxed`（左对齐）。
  - 用户气泡：`bg-paper-ink text-paper-shadeDeep rounded-[10px_10px_2px_10px] max-w-[92%] self-end px-3 py-2.5 text-caption`（右对齐，`self-end` 此处父为 `flex flex-col` 直接子项——有效）。
- 否则（`!found` / `turns` 空 / 加载 / 错误）→ 降级占位文案「校准对话暂不可回放」（保留现有「重新校准定位」按钮 + 重新校准入口）。
- 令牌沿用 Positioning 既有（`text-title`/`text-copy`/`paper-*`，已过线）。

## 8. 错误处理

- confirm 时 `turns` 缺失（旧前端）→ persistConfirm 不注入，不报错（向后兼容）。
- 历史端点：未校准 / 旧档案 / 解析失败 → `found=false, turns=[]`（200，非 404），前端降级占位，不阻塞页面。
- `interviewHistory` query 失败 → aside 降级占位（`error` 态走与 `!found` 同分支）。

## 9. 测试

- sks-web（vitest，node 纯函数）：Positioning 无纯函数可抽（渲染逻辑）；加 `confirmProfile` 调用形状测（mock userClient，断言 POST body 含 turns）放 `calibrate.test.ts` 或新 `profile.test.ts`。回放面板渲染不单测（vitest 无 jsdom，同 D1 前置修订）。
- sks-server（`ProfileServiceTest`，`@MockBean`）：
  - `confirmPersistsInterviewTurns`：confirm 带 turns → 落库后 `interviewTurns(uid)` 返 found=true + turns 对齐。
  - `confirmWithoutTurnsBackwardCompat`：confirm 不带 turns（旧契约）→ 仍落 profile（不注入）+ `interviewTurns` 返 found=false（旧档案无 turns）。
  - `stripMeta`：confirm 带 `_interview_turns` 入库后，`activeProfileView()` content 不含 `_` 键（strip 在 activeProfile 内生效）——`interviewTurns` 仍能读 `_interview_turns`（走 findActive raw，不经 activeProfile）。
  - `interviewTurnsUncalibrated`：未校准 → found=false。
- 不动 sks-ai 测试。

## 10. 契约文档

- `REST_CONTRACT.md`「### 定位校准」表：`POST /api/profile/confirm` 请求列改 `{sessionId, turns}`（turns 可空）；加 `| GET | /api/profile/interview/history | — | InterviewHistoryView |`。表下 bullet 补 `InterviewHistoryView：{found, turns:[{role,text}]}`；未校准/旧档案返 found=false。
- 不改 sks-ai `API_CONTRACT.md`（D2 不动 sks-ai）。

## 11. 验收（对齐 PROTOTYPE_GAP 行 11）

- 令牌：过（Positioning 已过，aside 照搬既有 token）。
- 功能：过——回放面板接真历史（confirm 入库的 `_interview_turns`），气泡按序渲染；未校准/旧档案/解析失败降级占位。
- 过线后更新 PROTOTYPE_GAP 行 11 令牌过/功能偏→过 + backlog 8 划完成。
