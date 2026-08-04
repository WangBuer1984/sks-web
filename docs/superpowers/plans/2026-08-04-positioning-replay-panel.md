# 账号定位回放面板 (D2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Positioning 页 aside 的「建库引导对话回放」从诚实占位换成真历史——confirm 时前端把 turns 入库 content JSONB 的 `_interview_turns`，history 端点直读 active content（不打 sks-ai、不改状态机）。

**Architecture:** 方案 H。confirm 契约加 `turns` → `persistConfirm` 注 `_interview_turns` 入 content → `GET /api/profile/interview/history` 只读 active content 取 turns。strip `_` 前缀键单点在 `activeProfile()` 内（创作/档案卡干净，回放能读到 meta）。两仓：sks-server + sks-web，不动 sks-ai。

**Tech Stack:** Spring Boot + RestClient + Jackson + MyBatis（sks-server）；React 18 + Vite + TS + TanStack Query + Tailwind（sks-web）。

## Global Constraints

- **纸感色板 + 令牌**：`#f4f1e9`/`#8a5a2b`/`Noto Serif SC`；Positioning 已令牌过线，aside 照搬，不得用 `text-2xl/sm/xs` 冒充、不得裸 hex。
- **不改访谈状态机**（不加 `questions[]`）；不动 sks-ai。
- **不存 `_thread_id`**（H 下无消费者，YAGNI）。
- **strip 单点在 `activeProfile()`**：`map.keySet().removeIf(k -> k.startsWith("_"))`；`interviewTurns` 走 `findActive` raw 绕过 strip。`OM.readValue(..., Map.class)` 返 `LinkedHashMap`（可变，`removeIf` 安全）。
- **Turn 定义在 `ProfileService`**（`record InterviewTurn(String role, String text)`），Controller 复用——**不让 ProfileService import Controller record**。
- **向后兼容**：confirm `turns=null`（旧前端/旧测试）→ persistConfirm 不注入；旧档案无 `_interview_turns` → history found=false + 占位。
- **Java 唯一公网入口**；sample-opening（D1）读 sks-ai checkpoint 不走 stored content，不受 meta 键影响。
- **测试**：sks-web vitest `environment:'node'`、`include:['src/**/*.test.ts']`、无 jsdom——只测纯函数（照 homeMode.ts 模式）。

---

## File Structure

| 文件 | 责任 | 仓 |
|---|---|---|
| `ProfileController.java` (Modify) | `ConfirmRequest` 加 `turns`；加 `GET /interview/history` 端点 | sks-server |
| `ProfileService.java` (Modify) | `InterviewTurn`/`InterviewHistoryView` record；`confirm`/`persistConfirm` 注 `_interview_turns`；`activeProfile` strip；`interviewTurns(userId)` | sks-server |
| `ProfileServiceTest.java` (Modify) | 现有 2 confirm 测改 3 参 + 加 4 新测 | sks-server |
| `docs/REST_CONTRACT.md` (Modify) | confirm body 加 turns + GET /interview/history 行 | sks-server |
| `src/api/profile.ts` (Modify) | `confirmProfile(sessionId, turns)`；`InterviewTurn`/`InterviewHistoryView`/`interviewHistory()` | sks-web |
| `src/pages/Calibrate.tsx` (Modify) | `confirmMut` 提交带 `turns` | sks-web |
| `src/pages/positioningMode.ts` (Create) | `shouldShowReplay(found, turns)` 纯函数 | sks-web |
| `src/pages/positioning.test.ts` (Create) | `shouldShowReplay` 测 | sks-web |
| `src/pages/Positioning.tsx` (Modify) | aside `useQuery(interviewHistory)` + 气泡/降级 + 原型文案 | sks-web |
| `prototypes/PROTOTYPE_GAP.md` (Modify) | 行 11 过线 + backlog 8 划完成 | sks-web |

---

## Task 1: sks-server confirm 入库 + history 端点 + strip

**Files:**
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/profile/ProfileService.java`
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/profile/ProfileController.java`
- Test: `/Users/rick/work/sks-server/src/test/java/com/sks/profile/ProfileServiceTest.java`
- Modify: `/Users/rick/work/sks-server/docs/REST_CONTRACT.md`

**Interfaces:**
- Consumes: `PositioningProfileMapper.findActive`、`OM`（ObjectMapper 字段）、`AiClient.interviewResult`（confirm 现有）。
- Produces: `ProfileService.InterviewTurn`/`InterviewHistoryView` record；`ProfileService.confirm(userId, sessionId, turns)`；`ProfileService.interviewTurns(userId)`；`GET /api/profile/interview/history`；`ConfirmRequest.turns`。

- [ ] **Step 1: 写失败测试** — 改 `ProfileServiceTest.java`：现有 2 个 confirm 测改 3 参（`confirm(uid,"s1",null)` / `confirm(uid,"s2",null)`），加 4 新测。

```java
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;

// 现有 confirmPersistsProfileAndACards：confirm(uid, "sess-1") → confirm(uid, "sess-1", null)
// 现有 reCalibrationKeepsOldVersionInactive：confirm(uid,"s1")/("s2") → 加 ,null

@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void confirmPersistsInterviewTurns() {
    when(aiClient.interviewResult(anyString())).thenReturn(summarizeResultWith2Cards());
    List<ProfileService.InterviewTurn> turns = List.of(
            new ProfileService.InterviewTurn("ai", "猜你人设是…对吗？"),
            new ProfileService.InterviewTurn("user", "基本对"));
    profileService.confirm(uid, "sess-1", turns);
    ProfileService.InterviewHistoryView v = profileService.interviewTurns(uid);
    assertTrue(v.found());
    assertEquals(2, v.turns().size());
    assertEquals("ai", v.turns().get(0).role());
    assertEquals("基本对", v.turns().get(1).text());
}

@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void confirmWithoutTurnsBackwardCompat() {
    when(aiClient.interviewResult(anyString())).thenReturn(summarizeResultWith2Cards());
    profileService.confirm(uid, "sess-1", null); // 旧契约
    ProfileService.InterviewHistoryView v = profileService.interviewTurns(uid);
    assertFalse(v.found()); // 旧档案无 _interview_turns
    assertTrue(v.turns().isEmpty());
}

@Test
void activeProfileStripsUnderscoreKeys() {
    when(aiClient.interviewResult(anyString())).thenReturn(summarizeResultWith2Cards());
    List<ProfileService.InterviewTurn> turns = List.of(
            new ProfileService.InterviewTurn("ai", "q"));
    profileService.confirm(uid, "sess-1", turns);
    var content = profileService.activeProfileView(uid).content();
    assertTrue(content.containsKey("人设"));            // profile 键保留
    assertFalse(content.containsKey("_interview_turns")); // meta 键剥掉
}

@Test
void interviewTurnsUncalibratedReturnsNotFound() {
    ProfileService.InterviewHistoryView v = profileService.interviewTurns(uid);
    assertFalse(v.found());
    assertTrue(v.turns().isEmpty());
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest=ProfileServiceTest -q`
Expected: 编译失败 — `confirm(long,String)` 不再有 2 参重载、`InterviewTurn`/`InterviewHistoryView`/`interviewTurns` 不存在。

- [ ] **Step 3: 改 `ProfileService.java`**

加两个 record（类内，紧邻 `ActiveProfileView` record）：

```java
public record InterviewTurn(String role, String text) {}

/** GET /api/profile/interview/history 响应。未校准/旧档案/解析失败 → found=false。 */
public record InterviewHistoryView(boolean found, List<InterviewTurn> turns) {}
```

改 `confirm` + `persistConfirm`（注入 `_interview_turns`）：

```java
public void confirm(long userId, String sessionId, List<InterviewTurn> turns) {
    String threadId = userId + ":" + sessionId;
    InterviewResultResponse result = aiClient.interviewResult(threadId);
    if (!result.found() || result.profile() == null) {
        throw new BizException(ErrorCode.PARAM_INVALID, "访谈尚未完成，无法确认生效");
    }
    List<AiClient.CardGenCard> aCards = result.aCards() == null ? List.of() : result.aCards();
    persistConfirm(userId, result.profile(), aCards, turns);
}

private void persistConfirm(long userId, JsonNode profileJson,
                            List<AiClient.CardGenCard> aCards, List<InterviewTurn> turns) {
    transactionTemplate.executeWithoutResult(
            status -> {
                try {
                    ObjectNode root = (ObjectNode) OM.readTree(profileJson.toString());
                    if (turns != null) {
                        root.set("_interview_turns", OM.valueToTree(turns));
                    }
                    profileMapper.deactivateActive(userId);
                    int version = profileMapper.maxVersion(userId) + 1;
                    PositioningProfile p = new PositioningProfile();
                    p.setUserId(userId);
                    p.setContent(root.toString());
                    p.setVersion(version);
                    p.setActive(true);
                    profileMapper.insert(p);
                    for (AiClient.CardGenCard c : aCards) {
                        kbCardService.create(userId, "A", c.cardType(), c.title(), c.content().toString());
                    }
                } catch (Exception e) {
                    throw new BizException(ErrorCode.AI_FAILED, "档案落库失败");
                }
            });
}
```

`activeProfile()` 加 strip（在 `return Optional.of(...)` 前插一行 `map.keySet().removeIf(k -> k.startsWith("_"))`）：

```java
@SuppressWarnings("unchecked")
public Optional<Map<String, Object>> activeProfile(long userId) {
    PositioningProfile p = profileMapper.findActive(userId);
    if (p == null || p.getContent() == null) {
        return Optional.empty();
    }
    try {
        Map<String, Object> map = (Map<String, Object>) OM.readValue(p.getContent(), Map.class);
        map.keySet().removeIf(k -> k.startsWith("_")); // 剥 meta 键（_interview_turns 等），创作/档案卡干净
        return Optional.of(map);
    } catch (Exception e) {
        log.warn("active profile content parse failed for user {}: {}", userId, e.getMessage());
        return Optional.empty();
    }
}
```

加 `interviewTurns(userId)`（走 findActive raw，不经 activeProfile strip）：

```java
public InterviewHistoryView interviewTurns(long userId) {
    PositioningProfile p = profileMapper.findActive(userId);
    if (p == null || p.getContent() == null) {
        return new InterviewHistoryView(false, List.of());
    }
    try {
        JsonNode root = OM.readTree(p.getContent());
        JsonNode turns = root.get("_interview_turns");
        if (turns == null || !turns.isArray() || turns.isEmpty()) {
            return new InterviewHistoryView(false, List.of());
        }
        List<InterviewTurn> list = OM.readValue(
                turns.toString(), new TypeReference<List<InterviewTurn>>() {});
        return new InterviewHistoryView(true, list);
    } catch (Exception e) {
        log.warn("interview turns parse failed for user {}: {}", userId, e.getMessage());
        return new InterviewHistoryView(false, List.of());
    }
}
```

import 补：`com.fasterxml.jackson.core.type.TypeReference`、`com.fasterxml.jackson.databind.node.ObjectNode`、`com.fasterxml.jackson.databind.JsonNode`（若未在）、`java.util.List`。

- [ ] **Step 4: 改 `ProfileController.java`**

改 `confirm` 端点签名 + `ConfirmRequest` 加 turns；加 `GET /interview/history`：

```java
@PostMapping("/confirm")
public ApiResponse<Void> confirm(
        @AuthenticationPrincipal Long userId, @RequestBody ConfirmRequest req) {
    if (req.sessionId() == null || req.sessionId().isBlank()) {
        throw new BizException(ErrorCode.PARAM_INVALID, "sessionId 不能为空");
    }
    profileService.confirm(userId, req.sessionId(), req.turns());
    return ApiResponse.ok(null);
}

@GetMapping("/interview/history")
public ApiResponse<ProfileService.InterviewHistoryView> interviewHistory(
        @AuthenticationPrincipal Long userId) {
    return ApiResponse.ok(profileService.interviewTurns(userId));
}

public record ConfirmRequest(String sessionId, List<ProfileService.InterviewTurn> turns) {}
```

import `java.util.List`。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest=ProfileServiceTest`
Expected: 全 PASS（现有 2 改 + 新 4 = 6 例）。

- [ ] **Step 6: 补 `docs/REST_CONTRACT.md`** — 「### 定位校准」段表：

`POST /api/profile/confirm` 请求列改 `{sessionId, turns}`；表后加行：

```
| GET | `/api/profile/interview/history` | — | `InterviewHistoryView` |
```

表下 bullet 区加/改：

```
- `confirm` 请求加 `turns:[{role,text}]`（可空，旧前端不带时 null）；`turns` 入库为 content 的 `_interview_turns`，不入 profile 语义键。
- `InterviewHistoryView`：`{found, turns:[{role,text}]}`。未校准 / 旧档案无 `_interview_turns` / 解析失败返 `found=false`，前端降级占位。回放数据 confirm 时入库，不打 AI 服务。
```

- [ ] **Step 7: 提交**

```bash
cd /Users/rick/work/sks-server
git add src/main/java/com/sks/profile/ProfileService.java src/main/java/com/sks/profile/ProfileController.java src/test/java/com/sks/profile/ProfileServiceTest.java docs/REST_CONTRACT.md
git commit -m "feat(profile): confirm 带 turns 入库 + interview/history 只读端点

confirm 契约加 turns→_interview_turns 入 content JSONB；
GET /api/profile/interview/history 直读 active content 取 turns（不打 sks-ai）；
activeProfile() 内 strip _ 前缀键防 meta 泄进创作/档案卡。"
```

> 注意：sks-server 工作树有用户未提交 WIP（AiClient asr hunk / analyze / topic / credit / V4 V5 迁移）。`git add` 只 add 上述 4 个文件；**不要 `git add -A`**。若 AiClient.java 有 WIP，本任务不碰它（D2 不改 AiClient）。

---

## Task 2: sks-web api + Calibrate confirm 带 turns + Positioning aside

**Files:**
- Modify: `/Users/rick/work/sks-web/src/api/profile.ts`
- Modify: `/Users/rick/work/sks-web/src/pages/Calibrate.tsx`
- Create: `/Users/rick/work/sks-web/src/pages/positioningMode.ts`
- Create: `/Users/rick/work/sks-web/src/pages/positioning.test.ts`
- Modify: `/Users/rick/work/sks-web/src/pages/Positioning.tsx`

**Interfaces:**
- Consumes: `GET /api/profile/interview/history`（Task 1）、`POST /api/profile/confirm {sessionId, turns}`。
- Produces: `interviewHistory()`、`InterviewTurn`/`InterviewHistoryView`、`confirmProfile(sessionId, turns)`、`shouldShowReplay(found, turns)`。

- [ ] **Step 1: 写失败测试** — `src/pages/positioning.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { shouldShowReplay } from './positioningMode';
import type { InterviewTurn } from '../api/profile';

const t = (role: 'ai' | 'user', text: string): InterviewTurn => ({ role, text });

describe('shouldShowReplay', () => {
  it('found 且 turns 非空 → true', () =>
    expect(shouldShowReplay(true, [t('ai', 'q'), t('user', 'a')])).toBe(true));
  it('found=false → false', () =>
    expect(shouldShowReplay(false, [t('ai', 'q')])).toBe(false));
  it('turns 空 → false', () =>
    expect(shouldShowReplay(true, [])).toBe(false));
  it('turns null → false', () =>
    expect(shouldShowReplay(true, null)).toBe(false));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/positioning.test.ts`
Expected: FAIL — `./positioningMode` 与 `../api/profile` 的 `InterviewTurn` 不存在。

- [ ] **Step 3: 写 `src/pages/positioningMode.ts`**

```ts
import type { InterviewHistoryView } from '../api/profile';

/** Positioning aside 回放面板是否渲染气泡（否则降级占位）。 */
export function shouldShowReplay(
  found: boolean,
  turns: InterviewHistoryView['turns'],
): boolean {
  return !!(found && turns && turns.length > 0);
}
```

- [ ] **Step 4: 写 `src/api/profile.ts`** — 加类型 + 函数（文件末尾）：

```ts
/** /api/profile/interview/history 响应（对齐 Java ProfileService.InterviewHistoryView）。 */
export interface InterviewTurn {
  role: 'ai' | 'user';
  text: string;
}
export interface InterviewHistoryView {
  found: boolean;
  turns: InterviewTurn[];
}

/** 回放面板：读当前 active 档案 confirm 时入库的访谈问答。未校准/旧档案 → found=false。 */
export function interviewHistory(): Promise<InterviewHistoryView> {
  return userClient.get<InterviewHistoryView, InterviewHistoryView>('/profile/interview/history');
}
```

改 `confirmProfile`（现签名 `confirmProfile(sessionId: string)`）加 turns：

```ts
/** 校准生效：写 active 档案 + A 层卡。turns 入库为 content 的 _interview_turns 供回放。 */
export function confirmProfile(
  sessionId: string,
  turns?: { role: 'ai' | 'user'; text: string }[],
): Promise<void> {
  return userClient.post<void, void>('/profile/confirm', { sessionId, turns: turns ?? null });
}
```

- [ ] **Step 5: 改 `src/pages/Calibrate.tsx`** — `confirmMut` 提交带 turns：

```ts
import { confirmProfile, ... } from '../api/profile';
...
const confirmMut = useMutation({
  mutationFn: () => confirmProfile(sessionId, turns),
  onSuccess: () => { setError(null); navigate('/workbench'); },
  onError: (e: unknown) => setError(getBizMessage(e, '生效失败')),
});
```

> `turns` state 已存在（`useState<Turn[]>([])`，done 阶段含完整对话）。`Turn` 本地接口 `{role:'ai'|'user', text}` 与 `confirmProfile` 的 turns 入参同形，直接传。

- [ ] **Step 6: 改 `src/pages/Positioning.tsx`** — aside（calibrated 分支 `<aside>`）：

顶部 import：

```ts
import { useQuery } from '@tanstack/react-query';
import { interviewHistory } from '../api/profile';
import { shouldShowReplay } from './positioningMode';
```

把现有 aside 的占位段（「重新校准」说明 + 「校准过程中的问答目前不做回放…」p）替换为：

```tsx
<aside className="flex flex-col rounded-block border border-paper-line bg-paper-card p-5">
  <h2 className="mb-1 font-sans text-copy font-bold">建库引导对话</h2>
  <p className="mb-3.5 text-[11.5px] text-paper-muted">
    你注册时 15 分钟聊出来的档案，随时可以重聊校准
  </p>
  {(() => {
    const { data, isLoading } = useQuery({
      queryKey: ['profile', 'interview-history'],
      queryFn: interviewHistory,
    });
    if (shouldShowReplay(data?.found ?? false, data?.turns ?? null)) {
      return (
        <div className="mb-3.5 flex flex-1 flex-col gap-2.5 text-caption">
          {data!.turns.map((t, i) => (
            <div
              key={i}
              className={`max-w-[92%] rounded-[10px_10px_10px_2px] px-3 py-2.5 leading-relaxed ${
                t.role === 'ai'
                  ? 'self-start bg-paper-tint text-paper-ink'
                  : 'self-end rounded-[10px_10px_2px_10px] bg-paper-ink text-paper-shadeDeep'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="flex-1 text-caption leading-normal text-paper-mutedLight">
        {isLoading ? '加载中…' : '校准对话暂不可回放'}
      </p>
    );
  })()}
  <Link
    to="/calibrate"
    className="mt-3.5 rounded-card border border-paper-primary py-2.5 text-center text-copy text-paper-primary hover:bg-paper-tint"
  >
    重新校准定位
  </Link>
</aside>
```

> IIFE 用 useQuery 是为就近取数；若 Positioning 已有 `useQuery(['profile'])` 顶层，避免重复请求可提到组件顶层。实现期可视整洁度决定是否提到顶层（功能等价即可）。AI 气泡 `self-start`、用户气泡 `self-end`——父 `flex flex-col`，直接子项 `self-*` 有效。token 全走 paper.*。

- [ ] **Step 7: 跑测试 + 构建**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/positioning.test.ts && npm test && npm run build`
Expected: positioning.test.ts 4/4 PASS；全测 PASS；build 无 TS 报错。

- [ ] **Step 8: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/api/profile.ts src/pages/Calibrate.tsx src/pages/positioningMode.ts src/pages/positioning.test.ts src/pages/Positioning.tsx
git commit -m "feat(positioning): 回放面板接 interview/history + confirm 带 turns

aside 渲染建库引导对话气泡（AI paper-tint / user 煤底），未校准/旧档案降级占位；
文案对齐原型；confirmProfile 带 turns 入库；抽 positioningMode.shouldShowReplay 纯函数测。"
```

> 注意：sks-web 工作树有用户未提交 WIP（PROTOTYPE_GAP / analyze / topic / Review / Topics / pages-analyze）。`git add` 只 add 上述 5 个文件；**不要 `git add -A`**。

---

## Task 3: PROTOTYPE_GAP.md 行 11 更新 + 验收

**Files:**
- Modify: `/Users/rick/work/sks-web/prototypes/PROTOTYPE_GAP.md`

- [ ] **Step 1: 改矩阵行 11** — 令牌过、功能偏→过，证据改写、建议序 `8`→`—`。

原行：
```
| 11 | 账号定位 | `isPos` | `Positioning.tsx` `/positioning` | 过 | 过 | 偏 | 令牌过。功能：空态三步+档案/支柱有；右侧「建库对话回放」缺（代码注明无历史对话 API） | 8 |
```

改为：
```
| 11 | 账号定位 | `isPos` | `Positioning.tsx` `/positioning` | 过 | 过 | 过 | 令牌过。功能：空态三步+档案/支柱有；右侧「建库引导对话回放」接 /api/profile/interview/history（confirm 时 turns 入库 _interview_turns，不打 AI；未校准/旧档案降级占位） | — |
```

- [ ] **Step 2: 改 backlog 序 8** — 划完成：

```
8. ~~**账号定位** — 对话回放（依赖后端历史 API；无 API 则 gap 保持「偏」）~~ ✅ 完成（回放走 confirm 入库的 _interview_turns，不经 AI；aside 文案+气泡对齐原型）
```

- [ ] **Step 3: 提交 + 验收**

```bash
cd /Users/rick/work/sks-web
git add prototypes/PROTOTYPE_GAP.md
git commit -m "docs: PROTOTYPE_GAP 行 11 账号定位过线"
```

验收口径复核：骨架路由可达 ✓；令牌过（Positioning 已过，aside 照搬）✓；功能过（回放面板接真历史 + 降级占位）✓；`npm test && npm run build` 绿。

> 注意：PROTOTYPE_GAP.md 工作树可能有用户 WIP（D1 时见过 rows 12/14/backlog 3 改）。surgical-staged 只 add 行 11/backlog 8 这两行改动（`git apply --cached` HEAD-baselined patch），**不动 WIP**。`git show --stat HEAD` 须只 1 文件、`git show HEAD` 须只行 11 + backlog 8 两处改动。

---

## Self-Review

**1. Spec coverage:**
- §3 confirm→_interview_turns→history 直读 content → Task 1 (persistConfirm + interviewTurns) ✓
- §4 ConfirmRequest 加 turns → Task 1 Step 4 ✓
- §5.1 注入 _interview_turns → Task 1 Step 3 persistConfirm ✓
- §5.2 strip 单点 activeProfile() → Task 1 Step 3 activeProfile + 测 activeProfileStripsUnderscoreKeys ✓
- §6 history 端点（interviewTurns + GET /interview/history）→ Task 1 ✓
- §7 Positioning aside（useQuery + 气泡 + 降级 + 原型文案）→ Task 2 Step 6 ✓
- §8 错误处理（turns 缺失兼容、found=false 降级）→ Task 1 confirmWithoutTurnsBackwardCompat + Task 2 shouldShowReplay ✓
- §9 测试矩阵 → Task 1 (6 例) + Task 2 (4 例) ✓
- §10 契约 → Task 1 Step 6 REST_CONTRACT ✓
- §11 验收 + PROTOTYPE_GAP 行 11 → Task 3 ✓

**2. Placeholder scan:** 无 TBD/TODO/「适当处理」。所有代码步骤含真实代码。✓

**3. Type consistency:**
- `InterviewTurn`/`InterviewHistoryView` 定义在 `ProfileService`（record），Controller import 复用，前端 `api/profile.ts` 同形 interface——跨语言 `{role, text}` / `{found, turns}` 一致。✓
- `confirm(userId, sessionId, turns)` 签名贯穿 Controller→Service→persistConfirm；前端 `confirmProfile(sessionId, turns)` body `{sessionId, turns}` 对齐 `ConfirmRequest(sessionId, turns)`。✓
- `shouldShowReplay(found, turns)` 在 positioningMode.ts，测试 + Positioning 同 import。✓
- 用户 checklist 落实：strip 单点 §5.2（Task 1 写在 activeProfile 内，非两处）✓；Turn 放 Service 不让 Service import Controller record（Task 1 Step 3 record 在 ProfileService，Controller 引用 `ProfileService.InterviewTurn`）✓；removeIf 确认可变 Map（Jackson LinkedHashMap，Task 1 注明）✓；done 刷新→turns 空→不注入→回放占位（confirmWithoutTurnsBackwardCompat 测覆盖）✓。
