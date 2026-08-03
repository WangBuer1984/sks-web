# 校准对话页对齐原型 (D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `Calibrate.tsx`(`/calibrate`) 从「裸 text-2xl/sm + 裸 hex + JSON.stringify 草稿」重塑为原型 `10-校准对话.html` 的三步进度/三步卡/四宫格档案 + 试试效果对比块，并跨仓加一个只读 sample-opening 端点喂对比块。

**Architecture:** 不动后端访谈状态机。sks-ai 加 `POST /ai/interview/sample-opening`（读 checkpoint profile → 一个 LLM prompt 产两版 hook）；sks-server 加 `POST /api/profile/sample-opening` passthrough（拼 threadId 转发，found=false→PARAM_INVALID）；sks-web Calibrate.tsx 全量令牌化重塑 + `lib/profileText.ts` 抽纯函数 + `api/profile.ts` 加 `sampleOpening()`。

**Tech Stack:** React 18 + Vite + TS + Tailwind（sks-web）；Spring Boot + RestClient（sks-server）；FastAPI + LangGraph + GLM（sks-ai）。

## Global Constraints

- **纸感色板**：`#f4f1e9` 底 / `#8a5a2b` 主色 / `Noto Serif SC` 衬线标题，落为 `tailwind.config.js` 主题变量；**主体不得用 `text-2xl/sm/xs` 冒充原型半像素档**，不得裸 hex（频次 <3 局部值例外须注明）。
- **无任何运行期/构建期 env**：axios 相对基址 `/api`；Java→Python 走 `AiClient`，基址 `sks.ai.base-url`（默认 `http://sks-ai:8000`）+ `sks.service-token`。
- **draft 是嵌套结构**：`/step` done 时 `profileDraft = {profile:{人设,人群,差异化,变现,红线,支柱配比}, a_cards:[...]}`。前端取值前剥一层 `draft.profile`。
- **thread_id**：`"{userId}:{sessionId}"`，Java 拼、Python `thread_id=f"{user_id}:{session_id}"` 对齐。
- **无 checkpoint**：sks-ai 返 `{found:false}`（200，非 404），Java 翻译为 `PARAM_INVALID`(4005)，前端当失败隐藏对比块。
- **安全**：sample-opening 不过阿里云 safetyCheck（与 interview summarize 一致）。
- **测试**：sks-web vitest = `environment:'node'`、`include:['src/**/*.test.ts']`、**无 jsdom**——只测纯函数，不渲染组件（照 `homeMode.ts`/`homeMode.test.ts` 模式抽纯函数）。

---

## File Structure

| 文件 | 责任 | 仓 |
|---|---|---|
| `app/skills/interview/sample_opening.py` (Create) | 读 checkpoint profile + 一个 prompt 产两版 hook 的纯函数 | sks-ai |
| `app/api/interview.py` (Modify) | 加 `POST /sample-opening` 路由 + pydantic 模型 | sks-ai |
| `tests/test_interview.py` (Modify) | 加 sample-opening 单测 + 端点鉴权测 | sks-ai |
| `docs/API_CONTRACT.md` (Modify) | 路由表 + 契约段补 sample-opening | sks-ai |
| `AiClient.java` (Modify) | 加 `SampleOpeningRequest/Response` record + `sampleOpening(...)` typed 方法 | sks-server |
| `ProfileService.java` (Modify) | 加 `sampleOpening(userId,sessionId,topic)` passthrough | sks-server |
| `ProfileController.java` (Modify) | 加 `POST /sample-opening` 端点 + `SampleOpeningRequest` record | sks-server |
| `ProfileServiceTest.java` (Modify) | 加 sampleOpening 桩测（found=true/false） | sks-server |
| `docs/REST_CONTRACT.md` (Modify) | 定位校准表补 GET /profile + POST /sample-opening | sks-server |
| `src/lib/profileText.ts` (Create) | `asText` + `extractProfileContent` 纯函数（DRY，Positioning 也改用） | sks-web |
| `src/pages/Positioning.tsx` (Modify) | 删本地 `asText`，改 import 自 `lib/profileText` | sks-web |
| `src/api/profile.ts` (Modify) | 加 `SampleOpeningView` + `sampleOpening()` | sks-web |
| `src/pages/Calibrate.tsx` (Modify) | 全量令牌化重塑 + 三步结构 + 四宫格 + 试试效果块 | sks-web |
| `src/pages/calibrate.test.ts` (Create) | `currentStep`/`extractProfileContent`/`shouldShowSampleBlock` 纯函数测 | sks-web |
| `prototypes/PROTOTYPE_GAP.md` (Modify) | 行 10 令牌/功能改过 + 建议序 6 划掉 | sks-web |

---

## Task 1: sks-ai sample-opening 端点

**Files:**
- Create: `/Users/rick/work/sks-ai/app/skills/interview/sample_opening.py`
- Modify: `/Users/rick/work/sks-ai/app/api/interview.py`（加 import + pydantic 模型 + 路由）
- Test: `/Users/rick/work/sks-ai/tests/test_interview.py`（加用例）
- Modify: `/Users/rick/work/sks-ai/docs/API_CONTRACT.md`

**Interfaces:**
- Consumes: `app.skills.interview.graph._graph`（读 checkpoint）、`app.llm.client.glm_client.chat`（LLM 调用，skill 名 `"interview"`，免注册新模型档）。
- Produces: `async def sample_opening(thread_id: str, topic: str | None) -> dict | None`，返回 `{topic, without, with}` 或 `None`（无 checkpoint/profile）。路由 `POST /ai/interview/sample-opening`，请求 `{user_id, thread_id, topic}`，响应 `{found, topic, without, with}`。

- [ ] **Step 1: 写失败测试** — 加到 `tests/test_interview.py` 末尾。

```python
class _FakeGraph:
    """假 LangGraph，可控 aget_state 返回值。monkeypatch 替 sample_opening 模块的 _graph。"""
    def __init__(self, values):
        self._values = values

    async def aget_state(self, config):
        class _SV:
            pass
        sv = _SV()
        sv.values = self._values
        return sv


@pytest.mark.asyncio
async def test_sample_opening_returns_two_hooks(monkeypatch):
    """有 profile 的 checkpoint → 一次 chat 产 {topic, without, with}。"""
    from app.skills.interview import sample_opening as so

    captured = {}

    async def _chat(skill, messages, json_schema=None, **kwargs):
        captured["skill"] = skill
        captured["schema"] = json_schema
        return {"without": "今天教大家看懂报价单", "with": "别人报3万我报1万6，我在做慈善吗"}

    monkeypatch.setattr("app.skills.interview.sample_opening.chat", _chat)
    inner = {"人设": "说真话的工厂人", "人群": "30-45 业主", "差异化": "工厂直营",
             "变现": "到店", "红线": "不贬同行", "支柱配比": "4:2:2:2"}
    monkeypatch.setattr(
        "app.skills.interview.sample_opening._graph",
        _FakeGraph({"profile": {"profile": inner, "a_cards": []}}),
    )

    r = await so.sample_opening("1:sess", None)
    assert r is not None
    assert r["topic"] == "报价为什么差一倍"  # 默认 topic
    assert r["without"] and r["with"]
    assert captured["skill"] == "interview"
    assert captured["schema"] is so.SAMPLE_OPENING_SCHEMA


@pytest.mark.asyncio
async def test_sample_opening_no_checkpoint_returns_none(monkeypatch):
    """无 checkpoint → None（路由层返 found=false）。"""
    from app.skills.interview import sample_opening as so

    async def _chat(*a, **k):  # 不应被调
        raise AssertionError("不应调 LLM")

    monkeypatch.setattr("app.skills.interview.sample_opening.chat", _chat)
    monkeypatch.setattr("app.skills.interview.sample_opening._graph", _FakeGraph(None))

    r = await so.sample_opening("nobody:none", "某选题")
    assert r is None


def test_sample_opening_endpoint_requires_token(monkeypatch):
    """无 token → 422（照 step 端点鉴权测）。"""
    from fastapi.testclient import TestClient
    from app.main import app
    from tests.test_interview import _noop_checkpointer
    monkeypatch.setattr("app.main._init_checkpointer", _noop_checkpointer)
    async def _fake(*a, **k):
        return {"found": True, "topic": "x", "without": "a", "with": "b"}
    monkeypatch.setattr("app.api.interview.sample_opening", _fake)
    with TestClient(app) as c:
        r = c.post("/ai/interview/sample-opening",
                   json={"user_id": 1, "thread_id": "1:s", "topic": None})
    assert r.status_code == 422
```

> 注：`_noop_checkpointer` 已在 `test_interview.py:38-44` 定义，直接 import 复用。`token` fixture 在 `conftest.py`，accepts_token 测可选加（照 `test_ai_interview_step_accepts_token`），非阻塞。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-ai && python -m pytest tests/test_interview.py::test_sample_opening_returns_two_hooks tests/test_interview.py::test_sample_opening_no_checkpoint_returns_none tests/test_interview.py::test_sample_opening_endpoint_requires_token -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.skills.interview.sample_opening'`。

- [ ] **Step 3: 写 `app/skills/interview/sample_opening.py`**

```python
"""样例开头（试试效果对比块）——读 checkpoint profile，一个 prompt 产「无档案/有档案」两版开场钩子。

不过阿里云 safetyCheck（与 interview summarize 一致）。一次 chat() 调用绑单 schema，
故两版 hook 放进一个 schema 的 `without`/`with` 两字段一次产出（照 SUMMARIZE_SCHEMA 双字段模式）。
"""
import json
from typing import Any

from app.llm.client import glm_client
from app.skills.interview.graph import _graph

chat = glm_client.chat  # 测试 monkeypatch 目标：app.skills.interview.sample_opening.chat

DEFAULT_TOPIC = "报价为什么差一倍"

SAMPLE_OPENING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "without": {"type": "string", "description": "无档案版开场钩子（通用口吻，一句话）"},
        "with": {"type": "string", "description": "有档案版开场钩子（严格按定位档案口吻，一句话）"},
    },
    "required": ["without", "with"],
}


def _build_messages(profile: dict[str, Any], topic: str) -> list[dict[str, str]]:
    system = (
        "你是一名口播视频开场钩子撰写师。给定一个选题，写两版开场钩子（各一句话、15字以内）："
        "without 版「无档案版」——不带入任何个人定位，写一句谁都能用的通用开头；"
        "with 版「有档案版」——严格按给定的定位档案口吻写一句开头，凸显该人设的差异化。"
        "两版都只输出钩子本身，不要解释、不要引号。"
    )
    user = (
        f"选题：{topic}\n"
        f"定位档案：{json.dumps(profile, ensure_ascii=False)}\n"
        "请按 schema 返回 without（无档案版）与 with（有档案版）。"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


async def sample_opening(thread_id: str, topic: str | None) -> dict[str, Any] | None:
    """读 checkpoint profile → 一个 prompt 产两版 hook。无 checkpoint/profile → None。"""
    config = {"configurable": {"thread_id": thread_id}}
    sv = await _graph.aget_state(config)
    if not sv or not sv.values:
        return None
    raw = sv.values.get("profile")  # {profile:{人设,...}, a_cards:[...]} 整块
    if not isinstance(raw, dict):
        return None
    inner = raw.get("profile")  # {人设,人群,差异化,变现,红线,支柱配比}
    if not isinstance(inner, dict) or not inner:
        return None
    t = topic or DEFAULT_TOPIC
    messages = _build_messages(inner, t)
    result = await chat("interview", messages, json_schema=SAMPLE_OPENING_SCHEMA)
    if not isinstance(result, dict):
        result = {}
    return {
        "topic": t,
        "without": str(result.get("without", "") or ""),
        "with": str(result.get("with", "") or ""),
    }
```

- [ ] **Step 4: 改 `app/api/interview.py` 加路由** — 在文件顶部 import 区加：

```python
from app.skills.interview.sample_opening import sample_opening as run_sample_opening
```

在 `GET /result` 路由之后加：

```python
class SampleOpeningRequest(BaseModel):
    user_id: int
    thread_id: str
    topic: str | None = None

class SampleOpeningResponse(BaseModel):
    found: bool = True
    topic: str | None = None
    without: str | None = None
    with_: str | None = Field(default=None, alias="with")

    model_config = {"populate_by_name": True}

@router.post("/sample-opening", response_model=SampleOpeningResponse, response_model_exclude_unset=True)
async def post_sample_opening(req: SampleOpeningRequest) -> SampleOpeningResponse:
    """只读：取 checkpoint profile，产「无档案/有档案」两版开场钩子，不推进状态机。"""
    data = await run_sample_opening(thread_id=req.thread_id, topic=req.topic)
    if data is None:
        return SampleOpeningResponse(found=False)
    return SampleOpeningResponse(found=True, **data)
```

> 注：`with` 是 Python 关键字，pydantic 字段名用 `with_` + `alias="with"` + `populate_by_name=True`，序列化输出 `"with"`。`from pydantic import BaseModel, Field` 须确保 `Field` 已 import（顶部 import 行加 `Field`）。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-ai && python -m pytest tests/test_interview.py -k sample_opening -v`
Expected: 3 PASS。

- [ ] **Step 6: 补 `docs/API_CONTRACT.md`** — 路由表（约 L56-57）加一行：

```
| POST | `/ai/interview/sample-opening` | 需 | 试试效果：产无档案/有档案两版开场钩子 | `AiClient.sampleOpening` |
```

契约段（`### GET /ai/interview/result` 之后）加：

```jsonc
### POST /ai/interview/sample-opening

// 入参 SampleOpeningRequest
{ "user_id": 1, "thread_id": "1:sess", "topic": null }
// topic 省略时默认「报价为什么差一倍」。Java 侧须自行拼 thread_id = "userId:sessionId"。

// 出参 SampleOpeningResponse（exclude_unset）
{ "found": true, "topic": "报价为什么差一倍", "without": "…", "with": "…" }
// 无 checkpoint / 无 profile：{ "found": false }
```

- [ ] **Step 7: 提交**

```bash
cd /Users/rick/work/sks-ai
git add app/skills/interview/sample_opening.py app/api/interview.py tests/test_interview.py docs/API_CONTRACT.md
git commit -m "feat(interview): sample-opening 端点（试试效果对比块）

读 checkpoint profile，一个 prompt 产无档案/有档案两版开场钩子；
无 checkpoint 返 found=false（与 /result 同口径），不过阿里云 safetyCheck。"
```

---

## Task 2: sks-server sample-opening passthrough

**Files:**
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/aiclient/AiClient.java`（加 record + typed 方法）
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/profile/ProfileService.java`（加 passthrough）
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/profile/ProfileController.java`（加端点 + record）
- Test: `/Users/rick/work/sks-server/src/test/java/com/sks/profile/ProfileServiceTest.java`
- Modify: `/Users/rick/work/sks-server/docs/REST_CONTRACT.md`

**Interfaces:**
- Consumes: `AiClient.post(...)` 基座（注入 X-Service-Token/X-Request-Id/重试/非2xx→AI_FAILED）。
- Produces: `AiClient.SampleOpeningResponse`（public record：`found, topic, without, with`，直接当 API view，passthrough 无需独立 view record）。`ProfileService.sampleOpening(long, String, String)` 返 `AiClient.SampleOpeningResponse`，`found=false` → `PARAM_INVALID(4005)`。

- [ ] **Step 1: 写失败测试** — 加到 `ProfileServiceTest.java`（类内）。

```java
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void sampleOpeningFoundReturnsHooks() {
        when(aiClient.sampleOpening(anyLong(), anyString(), anyString()))
                .thenReturn(
                        new AiClient.SampleOpeningResponse(
                                true, "报价为什么差一倍", "无档案版开头", "有档案版开头"));
        AiClient.SampleOpeningResponse resp =
                profileService.sampleOpening(uid, "sess-1", null);
        assertTrue(resp.found());
        assertEquals("报价为什么差一倍", resp.topic());
        assertEquals("有档案版开头", resp.withHook());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void sampleOpeningNotFoundThrowsParamInvalid() {
        when(aiClient.sampleOpening(anyLong(), anyString(), anyString()))
                .thenReturn(new AiClient.SampleOpeningResponse(false, null, null, null));
        assertThrows(
                BizException.class,
                () -> profileService.sampleOpening(uid, "sess-1", null));
    }
```

> 注：record 字段名 `withHook()`（Java 不能用 `with()` 作 accessor，见 Step 3）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest='ProfileServiceTest#sampleOpeningFoundReturnsHooks+sampleOpeningNotFoundThrowsParamInvalid' -q`
Expected: 编译失败 — `AiClient.SampleOpeningResponse` 与 `profileService.sampleOpening` 不存在。

- [ ] **Step 3: 写 `AiClient.java` 的 record + typed 方法** — 加到 `AiClient` 类内（紧邻 `interviewResult(...)` 之后）：

```java
    public record SampleOpeningRequest(
            @JsonProperty("user_id") long userId,
            @JsonProperty("thread_id") String threadId,
            @JsonProperty("topic") String topic) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SampleOpeningResponse(
            boolean found,
            String topic,
            @JsonProperty("without") String without,
            @JsonProperty("with") String withHook) {}

    public SampleOpeningResponse sampleOpening(long userId, String threadId, String topic) {
        return post(
                "/ai/interview/sample-opening",
                new SampleOpeningRequest(userId, threadId, topic),
                SampleOpeningResponse.class);
    }
```

> 注：`with` 是 Java 关键字不能作字段名，用 `withHook` + `@JsonProperty("with")` 对齐 Python 出参键；序列化/反序列化都走 `"with"`。`topic` 为 null 时 Jackson 序列化为 `null`（Python `topic: str | None` 兼容）。

- [ ] **Step 4: 写 `ProfileService.sampleOpening`** — 加到 `ProfileService` 类内（紧邻 `confirm(...)` 之后）：

```java
    /** passthrough：拼 threadId → 调 sks-ai sample-opening。found=false → PARAM_INVALID。不落库。 */
    public AiClient.SampleOpeningResponse sampleOpening(long userId, String sessionId, String topic) {
        String threadId = userId + ":" + sessionId;
        AiClient.SampleOpeningResponse resp = aiClient.sampleOpening(userId, threadId, topic);
        if (!resp.found()) {
            throw new BizException(ErrorCode.PARAM_INVALID, "访谈尚未完成，无法生成样稿");
        }
        return resp;
    }
```

- [ ] **Step 5: 写 `ProfileController` 端点** — 加到 `ProfileController` 类内（紧邻 `confirm(...)` 之后）+ record：

```java
    @PostMapping("/sample-opening")
    public ApiResponse<AiClient.SampleOpeningResponse> sampleOpening(
            @AuthenticationPrincipal Long userId, @RequestBody SampleOpeningRequest req) {
        if (req.sessionId() == null || req.sessionId().isBlank()) {
            throw new BizException(ErrorCode.PARAM_INVALID, "sessionId 不能为空");
        }
        return ApiResponse.ok(profileService.sampleOpening(userId, req.sessionId(), req.topic()));
    }

    public record SampleOpeningRequest(String sessionId, String topic) {}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest=ProfileServiceTest -q`
Expected: 全 PASS（含新增 2 例）。

- [ ] **Step 7: 补 `docs/REST_CONTRACT.md`** — 「### 定位校准」段（约 :162-166）的表，在 interview 行前加 GET /profile、在 confirm 行后加 sample-opening：

```
| GET | `/api/profile` | — | `ActiveProfileView` |
| POST | `/api/profile/interview` | `{sessionId, reply, materials}` | `InterviewStepView` |
| POST | `/api/profile/voice` | `multipart`，字段名 **`audio`** | `String`（转写文本） |
| POST | `/api/profile/confirm` | `{sessionId}` | `null` |
| POST | `/api/profile/sample-opening` | `{sessionId, topic}` | `SampleOpeningResponse` |
```

表下 bullet 区加：

```
- `ActiveProfileView`：`{calibrated, version, calibratedAt, content}`。无 active 行返 `calibrated=false`（非 404）。
- `sample-opening`：调用前需先走完访谈（checkpoint 有 profile）；未完成返 4005。`topic` 省略时默认「报价为什么差一倍」。返回 `{found, topic, without, with}` 两版开场钩子。
```

- [ ] **Step 8: 提交**

```bash
cd /Users/rick/work/sks-server
git add src/main/java/com/sks/aiclient/AiClient.java src/main/java/com/sks/profile/ProfileService.java src/main/java/com/sks/profile/ProfileController.java src/test/java/com/sks/profile/ProfileServiceTest.java docs/REST_CONTRACT.md
git commit -m "feat(profile): sample-opening 端点 passthrough

POST /api/profile/sample-opening → sks-ai /ai/interview/sample-opening；
found=false 翻译为 PARAM_INVALID(4005)；补漏列的 GET /api/profile 契约。"
```

---

## Task 3: sks-web 纯函数库 + Calibrate 令牌化重塑（核心结构）

**Files:**
- Create: `/Users/rick/work/sks-web/src/lib/profileText.ts`
- Modify: `/Users/rick/work/sks-web/src/pages/Positioning.tsx`（删本地 `asText`，改 import）
- Modify: `/Users/rick/work/sks-web/src/pages/Calibrate.tsx`（全量重写，**不含 试试效果块接线**——结构留位但 sampleData 恒 null 故不渲染）
- Test: `/Users/rick/work/sks-web/src/pages/calibrate.test.ts`

**Interfaces:**
- Produces: `lib/profileText.ts` 导出 `asText(v: unknown): string`、`extractProfileContent(draft: unknown): Record<string, unknown>`。`Calibrate.tsx` 本地导出 `currentStep(phase)`、`CARDS`、`SAMPLE_MATERIAL`、`shouldShowSampleBlock(s)`（Task 4 用）。

**plan 对 spec §8 的修订（前置说明）**：sks-web vitest = `environment:'node'`、`include:['src/**/*.test.ts']`、无 jsdom/无 @testing-library。故不渲染组件，改为抽纯函数单测（照 `homeMode.test.ts` 模式）：`currentStep` / `extractProfileContent` / `asText` / `shouldShowSampleBlock`。sampleOpening 的 api 函数与 done-phase useEffect 胶水不单测（由后端契约 + 手测覆盖）。

- [ ] **Step 1: 写失败测试** — `src/pages/calibrate.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { asText, extractProfileContent } from '../lib/profileText';
import { currentStep, shouldShowSampleBlock } from './calibrateMode';
import type { SampleOpeningView } from '../api/profile';

describe('currentStep', () => {
  it('materials → 1', () => expect(currentStep('materials')).toBe(1));
  it('await_feedback → 2', () => expect(currentStep('await_feedback')).toBe(2));
  it('ask → 2', () => expect(currentStep('ask')).toBe(2));
  it('summarize → 2', () => expect(currentStep('summarize')).toBe(2));
  it('done → 3', () => expect(currentStep('done')).toBe(3));
});

describe('extractProfileContent', () => {
  it('嵌套 draft → 剥一层 profile', () => {
    const draft = { profile: { 人设: '工厂人', 人群: '业主' }, a_cards: [] };
    expect(extractProfileContent(draft)).toEqual({ 人设: '工厂人', 人群: '业主' });
  });
  it('扁平 draft（兼容降级）', () => {
    expect(extractProfileContent({ 人设: 'x' })).toEqual({ 人设: 'x' });
  });
  it('null → {}', () => expect(extractProfileContent(null)).toEqual({}));
  it('profile 为空对象 → 降级到原 draft', () => {
    // draft.profile 是 {}  falsy → 回退 draft 本身
    expect(extractProfileContent({ profile: {}, 人设: 'y' })).toEqual({ profile: {}, 人设: 'y' });
  });
});

describe('asText', () => {
  it('字符串原样', () => expect(asText('hi')).toBe('hi'));
  it('数组用 · 连接', () => expect(asText(['a', 'b'])).toBe('a · b'));
  it('对象键值串', () => expect(asText({ k: 'v' })).toBe('k：v'));
  it('null → 空', () => expect(asText(null)).toBe(''));
});

describe('shouldShowSampleBlock', () => {
  const ok = (o: Partial<SampleOpeningView>): SampleOpeningView =>
    ({ found: false, topic: '', without: null, with: null, ...o } as SampleOpeningView);
  it('found 且两 hook 非空 → true', () =>
    expect(shouldShowSampleBlock(ok({ found: true, without: 'a', with: 'b' }))).toBe(true));
  it('found=false → false', () =>
    expect(shouldShowSampleBlock(ok({ found: false, without: 'a', with: 'b' }))).toBe(false));
  it('缺 with → false', () =>
    expect(shouldShowSampleBlock(ok({ found: true, without: 'a', with: null }))).toBe(false));
  it('null → false', () => expect(shouldShowSampleBlock(null)).toBe(false));
});
```

> 注：测试 import `currentStep`/`shouldShowSampleBlock` 自 `./calibrateMode`（纯函数模块，从 Calibrate.tsx 抽出，照 homeMode.ts 模式），`asText`/`extractProfileContent` 自 `../lib/profileText`。`SampleOpeningView` 类型自 `../api/profile`（Task 4 才加；本任务先建 `calibrateMode.ts`，`shouldShowSampleBlock` 的入参类型用本地 `SampleState` 接口避免循环依赖——见 Step 3）。

修正：为避免依赖 Task 4 的 `SampleOpeningView`，`calibrateMode.ts` 自定义本地接口：

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/calibrate.test.ts`
Expected: FAIL — 找不到 `../lib/profileText` 与 `./calibrateMode` 模块。

- [ ] **Step 3: 写 `src/lib/profileText.ts`**

```ts
/** 把档案里任意形状的值渲染成一行文本——LLM 可能给字符串、数组或对象。
 * 从 Positioning.tsx 抽出共享，DRY。 */
export function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}：${asText(val)}`)
      .join('；');
  }
  return String(v);
}

/** 剥一层 profile：/step done 时 draft = {profile:{...}, a_cards:[]}，
 *  取 draft.profile（内层档案对象）。扁平或 null 时降级返回 draft 本身 / {}。 */
export function extractProfileContent(draft: unknown): Record<string, unknown> {
  if (draft == null || typeof draft !== 'object') return {};
  const d = draft as Record<string, unknown>;
  const inner = d['profile'];
  if (inner && typeof inner === 'object' && Object.keys(inner as object).length > 0) {
    return inner as Record<string, unknown>;
  }
  return d;
}
```

- [ ] **Step 4: 写 `src/pages/calibrateMode.ts`**（纯函数，从 Calibrate 抽）

```ts
/** Calibrate 页纯逻辑（照 workbench/homeMode.ts 模式抽离，便于 node 环境单测）。 */

export type Phase = 'materials' | 'await_feedback' | 'ask' | 'summarize' | 'done';

/** sample-opening 响应形状（与 api/profile.ts 的 SampleOpeningView 对齐，本地副本避免循环依赖）。 */
export interface SampleState {
  found: boolean;
  topic: string;
  without: string | null;
  with: string | null;
}

/** phase → 三步进度条 currentStep（1/2/3）。 */
export function currentStep(phase: Phase): 1 | 2 | 3 {
  if (phase === 'materials') return 1;
  if (phase === 'done') return 3;
  return 2;
}

/** 试试效果对比块是否渲染：found 且两 hook 非空。 */
export function shouldShowSampleBlock(s: SampleState | null): boolean {
  return !!(s && s.found && s.without && s.with);
}
```

> 修正 calibrate.test.ts 的 import：`shouldShowSampleBlock`/`currentStep` 自 `./calibrateMode`，类型 `SampleState` 而非 `SampleOpeningView`。测试里 `ok()` 返回 `Partial<SampleState>`。把测试 Step 1 里的 `SampleOpeningView` 全部换成 `SampleState`、`from '../api/profile'` 删掉。

- [ ] **Step 5: 改 `Positioning.tsx` 用共享 `asText`** — 删本地 `asText` 函数（L24-35），顶部 import 改为：

```ts
import { asText } from '../lib/profileText';
```

（其余不变，`content` 已是内层档案对象，直接 `asText(content[c.key])`。）

- [ ] **Step 6: 重写 `src/pages/Calibrate.tsx`**（全量，令牌化 + 三步结构 + 四宫格；试试效果块留结构位但 `sampleData` 恒 null 故不渲染——Task 4 接线）

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  asrVoice,
  confirmProfile,
  interviewStep,
  type InterviewStepView,
} from '../api/profile';
import { asText, extractProfileContent } from '../lib/profileText';
import { currentStep, type Phase, type SampleState, shouldShowSampleBlock } from './calibrateMode';

const SAMPLE_MATERIAL = `我叫王姐，在佛山做了12年全屋定制工厂。自家厂房自家工人，不外包。
专治装修怕被坑的业主——报价单每一项给你拆清楚，哪家贵在哪、哪家便宜在哪，
敢把真实价格摆出来。不诋毁同行，但不说假话。`;

interface Turn {
  role: 'ai' | 'user';
  text: string;
}

/** Step3 四宫格 → 档案键。原型「表达红线」对应档案 `红线`。 */
const CARDS: { title: string; key: string }[] = [
  { title: '人设', key: '人设' },
  { title: '目标人群', key: '人群' },
  { title: '差异化', key: '差异化' },
  { title: '表达红线', key: '红线' },
];

export default function Calibrate() {
  const navigate = useNavigate();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<Phase>('materials');
  const [materials, setMaterials] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string>('');
  const [asrPending, setAsrPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sampleData, setSampleData] = useState<SampleState | null>(null); // Task 4 接线前恒 null
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stepMut = useMutation({
    mutationFn: (vars: { reply?: string; materials?: string }) =>
      interviewStep(sessionId, vars.reply, vars.materials),
    onSuccess: (resp: InterviewStepView) => {
      setError(null);
      setBanner(resp.banner ?? '');
      if (resp.blocked) {
        setError('内容被安全拦截，请调整后重试');
        return;
      }
      if (resp.question) {
        setTurns((t) => [...t, { role: 'ai', text: resp.question as string }]);
      }
      if (resp.done) {
        setDraft(resp.profileDraft);
        setPhase('done');
      } else if (resp.stage === 'await_feedback') {
        setPhase('await_feedback');
      } else if (resp.stage === 'ask') {
        setPhase('ask');
      } else if (resp.stage === 'summarize') {
        setPhase('summarize');
      }
    },
    onError: (e: unknown) => setError(getBizMessage(e, '访谈推进失败')),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmProfile(sessionId),
    onSuccess: () => {
      setError(null);
      navigate('/workbench');
    },
    onError: (e: unknown) => setError(getBizMessage(e, '生效失败')),
  });

  const submitMaterials = () => {
    if (!materials.trim()) {
      // 允许空素材「直接聊」分支调到这里时 materials 已被清空校验跳过——见「没有素材，直接聊」按钮直接 mutate
      setError('请先粘贴素材（主页说明 / 过往文案 / 朋友圈长文）');
      return;
    }
    setTurns([]);
    setPhase('ask');
    stepMut.mutate({ materials: materials.trim() });
  };

  const skipMaterials = () => {
    setTurns([]);
    setPhase('ask');
    stepMut.mutate({ materials: null });
  };

  const submitReply = (reply?: string) => {
    const text = (reply ?? input).trim();
    if (!text) {
      setError('请输入回答');
      return;
    }
    setTurns((t) => [...t, { role: 'user', text }]);
    setInput('');
    setPhase('ask');
    stepMut.mutate({ reply: text });
  };

  // 语音：按住录音 → 松开 ASR → 回显可改（逻辑不变）
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          setRecording(false);
          return;
        }
        setAsrPending(true);
        try {
          const text = await asrVoice(blob);
          if (!text.trim()) {
            setError('没听清，请再说一次或改用文字输入');
          } else {
            setInput(text);
          }
        } catch (e) {
          setError('语音识别失败，请改用文字输入（不阻断访谈）');
        } finally {
          setAsrPending(false);
          setRecording(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError('无法访问麦克风，请改用文字输入');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
  };

  useEffect(() => {
    return () => stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = stepMut.isPending || confirmMut.isPending;
  const showQA = phase === 'await_feedback' || phase === 'ask' || phase === 'summarize';
  const step = currentStep(phase);
  const content = extractProfileContent(draft);

  return (
    <main className="mx-auto min-h-full max-w-3xl px-5 py-8">
      <header className="mb-[18px] flex items-center justify-between">
        <h1 className="font-serif text-title font-black text-paper-ink">校准定位</h1>
        <Link
          to="/workbench"
          className="text-copy text-paper-muted transition hover:text-paper-primary"
        >
          保存并退出
        </Link>
      </header>

      {/* 三步进度条 */}
      <div className="mb-[22px] flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-[5px] flex-1 rounded-[3px] ${
              i < step ? 'bg-paper-primary' : 'bg-paper-shade'
            }`}
          />
        ))}
      </div>

      {banner && (
        <p className="mb-4 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2 text-meta font-semibold text-paper-primary">
          {banner}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
        >
          {error}
        </div>
      )}

      {/* 第 1 步：贴素材 */}
      {phase === 'materials' && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[30px_32px]">
          <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">
            第 1 步 · 共 3 步 · 约 3 分钟
          </div>
          <h2 className="mb-1.5 text-[18px] font-bold text-paper-ink">先给我一点「你」的素材</h2>
          <p className="mb-[18px] text-body leading-relaxed text-paper-inkSoft">
            主页链接、过往视频文案、朋友圈长文，任意一样即可——AI 先猜一版你的人设，比让你填空快得多。没有素材也可以跳过，直接聊。
          </p>
          <textarea
            rows={4}
            placeholder="粘贴主页链接或一段你写过的文案…"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            className="mb-3 w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMaterials(SAMPLE_MATERIAL)}
              className="rounded-badge border border-dashed border-paper-goldSoft px-3.5 py-1.5 text-caption text-paper-primary transition hover:bg-paper-tint"
            >
              用示例：王姐的抖音主页
            </button>
            <div className="ml-auto flex gap-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={skipMaterials}
                className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                没有素材，直接聊
              </button>
              <button
                type="button"
                disabled={pending || !materials.trim()}
                onClick={submitMaterials}
                className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {stepMut.isPending ? 'AI 思考中…' : '开始校准'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 第 2 步：确认人设 + 问答 */}
      {showQA && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[26px_28px]">
          <div className="mb-3.5 text-meta font-bold tracking-wide text-paper-primary">
            第 2 步 · 确认并补充 · 约 8 分钟
          </div>

          {turns.length > 0 && (
            <div className="mb-[18px] flex flex-col gap-3">
              {turns.map((t, i) => (
                <div key={i}>
                  <div
                    className={`max-w-[94%] rounded-[10px_10px_10px_2px] px-4 py-3.5 text-body leading-relaxed ${
                      t.role === 'ai'
                        ? 'bg-paper-tint text-paper-ink'
                        : 'self-end bg-paper-ink text-paper-shadeDeep'
                    }`}
                  >
                    {t.text}
                  </div>
                  {/* await_feedback 阶段：最新 AI 气泡下挂确认/否认胶囊 */}
                  {t.role === 'ai' && phase === 'await_feedback' && i === turns.length - 1 && (
                    <div className="mt-2.5 flex gap-2 self-end">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => submitReply('基本对')}
                        className="rounded-badge border border-paper-primary bg-paper-tint px-4 py-2 text-copy text-paper-primary transition hover:bg-paper-tintDeep disabled:opacity-45"
                      >
                        基本对
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('calib-answer')?.focus()}
                        className="rounded-badge border border-paper-lineStrong px-4 py-2 text-copy text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
                      >
                        不太对，我来说
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {stepMut.isPending && (
            <p className="mb-3 text-copy text-paper-muted">AI 思考中…（约 30-60s）</p>
          )}

          <textarea
            id="calib-answer"
            rows={3}
            placeholder={asrPending ? '识别中…' : '打字或语音都行，大白话即可…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={asrPending}
            className="mb-3 w-full rounded-[10px_10px_3px_12px] border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary disabled:bg-paper-base"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || asrPending || !input.trim()}
              onClick={() => submitReply()}
              className="rounded-panel bg-paper-primary px-4 py-2 text-body font-bold text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              提交回答
            </button>
            <button
              type="button"
              disabled={pending || asrPending}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`rounded-panel border px-4 py-2 text-body font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                recording
                  ? 'border-paper-danger bg-paper-danger text-white'
                  : 'border-paper-lineStrong bg-paper-card text-paper-primary hover:bg-paper-tint'
              }`}
            >
              {recording ? '录音中…松开识别' : asrPending ? '识别中…' : '按住录音'}
            </button>
          </div>
          <p className="mt-2 text-caption text-paper-muted">
            语音回答先转出文字回显，可编辑后再提交；识别失败可改用文字输入，不阻断访谈。
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-paper-tintDeep pt-4">
            <p className="text-meta text-paper-mutedLight">
              正式版会连续问 5–8 个问题（人群、案例、口头禅…），原型演示只走一问
            </p>
            <button
              type="button"
              disabled={pending || asrPending || !input.trim()}
              onClick={() => submitReply()}
              className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              生成定位档案 →
            </button>
          </div>
        </section>
      )}

      {/* 第 3 步：档案确认 */}
      {phase === 'done' && draft && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[26px_28px]">
          <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">
            第 3 步 · 你的定位档案
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2.5 text-body">
            {CARDS.map((c) => {
              const text = asText(content[c.key]);
              return (
                <div
                  key={c.key}
                  className="rounded-card border border-paper-tintDeep bg-paper-sunken px-3.5 py-3"
                >
                  <div className="mb-1 text-hint font-bold text-paper-primary">{c.title}</div>
                  <div className="leading-normal">
                    {text || <span className="text-paper-mutedLight">档案里没有这一项</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 试试效果对比块（Task 4 接线前 sampleData 恒 null → 不渲染） */}
          {shouldShowSampleBlock(sampleData) && (
            <div className="mb-[18px] rounded-card border-l-[3px] border-paper-primary bg-paper-tint px-4 py-3 text-caption leading-relaxed">
              试试效果：同一个选题「{sampleData!.topic}」——
              <br />
              <span className="text-paper-muted">无档案版开头：「{sampleData!.without}」</span>
              <br />
              <span className="font-bold text-paper-primary">
                有档案版开头：「{sampleData!.with}」
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPhase('ask')}
              className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
            >
              再补充几句
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirmMut.mutate()}
              className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {confirmMut.isPending ? '生效中…' : '确认档案，开始创作'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
```

> 注意：用户气泡用 `bg-paper-ink text-paper-shadeDeep`（对齐原型 section11 回放里用户气泡 `#23231f` 煤底）。`submitReply('基本对')` 快捷回复走同一 mutation。

- [ ] **Step 7: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/calibrate.test.ts`
Expected: 全 PASS（currentStep 5 例 + extractProfileContent 4 例 + asText 4 例 + shouldShowSampleBlock 4 例）。

- [ ] **Step 8: 跑全量前端测 + 构建**

Run: `cd /Users/rick/work/sks-web && npm test && npm run build`
Expected: 全测 PASS；build 无 TS / Tailwind 报错。

- [ ] **Step 9: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/lib/profileText.ts src/pages/calibrateMode.ts src/pages/calibrate.test.ts src/pages/Calibrate.tsx src/pages/Positioning.tsx
git commit -m "refactor(calibrate): 令牌化 + 三步进度/三步卡/四宫格重塑

照原型 10-校准对话.html 重塑 Calibrate.tsx：三步进度条、三步卡片、
Step2 人设确认气泡+基本对/不太对胶囊、Step3 四宫格档案（剥 draft.profile 嵌套层）；
抽 lib/profileText.ts（asText/extractProfileContent）DRY，Positioning 改用；
试试效果块结构留位、Task 4 接线前不渲染。"
```

---

## Task 4: sks-web sampleOpening 接线 + 试试效果块

**Files:**
- Modify: `/Users/rick/work/sks-web/src/api/profile.ts`
- Modify: `/Users/rick/work/sks-web/src/pages/Calibrate.tsx`（加 sampleOpening mutation + done 阶段触发）

**Interfaces:**
- Consumes: sks-server `POST /api/profile/sample-opening`（Task 2），响应 `{found, topic, without, with}`。
- Produces: `api/profile.ts` 导出 `SampleOpeningView` + `sampleOpening(sessionId, topic?)`。Calibrate done 阶段 useEffect 触发 → setSampleData → 块渲染。

- [ ] **Step 1: 写 `api/profile.ts` 的类型 + 函数** — 加到文件末尾：

```ts
/** /api/profile/sample-opening 响应（对齐 Java AiClient.SampleOpeningResponse）。 */
export interface SampleOpeningView {
  found: boolean;
  topic: string;
  without: string | null;
  with: string | null;
}

/**
 * 试试效果对比块：取「无档案/有档案」两版开场钩子。
 * sessionId 由前端生成（与 interviewStep 同一 session）；topic 省略时后端默认「报价为什么差一倍」。
 * found=false（访谈未完成）时前端按失败处理——静默隐藏对比块。
 */
export function sampleOpening(sessionId: string, topic?: string): Promise<SampleOpeningView> {
  return userClient.post<SampleOpeningView, SampleOpeningView>('/profile/sample-opening', {
    sessionId,
    topic: topic ?? null,
  });
}
```

- [ ] **Step 2: 跑测试确认不回归**（接线无新单测——api 函数与 useEffect 胶水由后端契约 + 手测覆盖，见 Task 3 §8 修订说明）

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/calibrate.test.ts`
Expected: 全 PASS（不变）。

- [ ] **Step 3: 改 `Calibrate.tsx` 接线** — 顶部 import 加 `sampleOpening`：

```ts
import {
  asrVoice,
  confirmProfile,
  interviewStep,
  sampleOpening,
  type InterviewStepView,
} from '../api/profile';
```

在 `confirmMut` 之后加 mutation + done 阶段触发 useEffect：

```ts
  const sampleMut = useMutation({
    mutationFn: () => sampleOpening(sessionId),
    onSuccess: (resp) => setSampleData(resp),
    onError: () => setSampleData(null), // 静默失败：隐藏对比块，不阻断 confirm
  });

  // 进入 done 阶段触发样例开头（失败静默）
  useEffect(() => {
    if (phase === 'done') {
      sampleMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
```

> `sampleData` 状态已在 Task 3 Step 6 声明（`useState<SampleState | null>(null)`）。`shouldShowSampleBlock(sampleData)` 渲染分支已就位。`setSampleData(resp)` 中 resp 是 `SampleOpeningView`，与 `SampleState` 结构同形（found/topic/without/with）——TS 结构兼容，直接赋值。

- [ ] **Step 4: 跑构建确认无 TS 报错**

Run: `cd /Users/rick/work/sks-web && npm run build`
Expected: build 通过。

- [ ] **Step 5: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/api/profile.ts src/pages/Calibrate.tsx
git commit -m "feat(calibrate): 试试效果对比块接 sample-opening 端点

done 阶段触发 sampleOpening mutation，渲染无档案/有档案两版开场钩子；
失败静默隐藏对比块，不阻断 confirm。"
```

---

## Task 5: 更新 PROTOTYPE_GAP.md 行 10 + 验收

**Files:**
- Modify: `/Users/rick/work/sks-web/prototypes/PROTOTYPE_GAP.md`

- [ ] **Step 1: 改矩阵行 10** — 把令牌「不过」→「过」、功能「偏」→「过」，证据/缺口列改写，建议序 `6` → `~~完成~~`。

原行（矩阵内）：
```
| 10 | 校准对话 | `isCalib` | `Calibrate.tsx` `/calibrate` | 过 | 不过 | 偏 | 令牌：`text-2xl`/`text-sm` 主导 + 裸 hex。功能：贴素材→问答→确认可走；缺原型三步进度/档案卡呈现（草稿偏 `JSON.stringify`） | 6 |
```

改为：
```
| 10 | 校准对话 | `isCalib` | `Calibrate.tsx` `/calibrate` | 过 | 过 | 过 | 令牌过线（text-title/body/copy/hint + paper.*，无 text-2xl/sm 冒充、无裸 hex）。功能：三步进度条 + 三步卡 + Step2 人设确认气泡/基本对·不太对胶囊 + Step3 四宫格档案（剥 draft.profile 嵌套层）+ 试试效果对比块（接 /api/profile/sample-opening，失败静默隐藏）齐；草稿不再 JSON.stringify | — |
```

- [ ] **Step 2: 改 backlog 序 6** — 「建议施工 backlog」第 6 条划掉：

```
6. ~~**校准对话** — 三步进度与档案卡 UI + 令牌化~~ ✅ 完成（三步进度/三步卡/四宫格 + 试试效果对比块接 sample-opening 端点；令牌过线）
```

- [ ] **Step 3: 提交**

```bash
cd /Users/rick/work/sks-web
git add prototypes/PROTOTYPE_GAP.md
git commit -m "docs: PROTOTYPE_GAP 行 10 校准对话过线

令牌不过→过、功能偏→过；backlog 序 6 划完成。"
```

- [ ] **Step 4: 验收口径复核** — 人工核对：
  - 骨架：`/calibrate` 路由可达 ✓
  - 令牌：grep 确认 `Calibrate.tsx` 无 `text-2xl`/`text-sm`/`text-xs`、无裸 hex（`grep -nE 'text-(2xl|sm|xs)|#[0-9a-fA-F]{3,6}' src/pages/Calibrate.tsx` 应空）
  - 功能：三步进度条 + 三步卡 + 四宫格 + 试试效果块齐
  - `npm test && npm run build` 绿

---

## Self-Review

**1. Spec coverage:**
- §4 三步进度条 phase→step 映射 → Task 3 `currentStep` + 进度条 JSX ✓
- §5.1 令牌迁移表 → Task 3 全量重写 Calibrate.tsx ✓
- §5.2 header「保存并退出」→ Task 3 Step 6 ✓
- §5.3 Step1 + 王姐示例文案 → Task 3 `SAMPLE_MATERIAL` + 用示例胶囊 ✓
- §5.4 Step2 确认气泡/胶囊 + 生成定位档案降级 → Task 3 ✓
- §5.5 四宫格 + 嵌套 draft 剥层 → Task 3 `extractProfileContent` + CARDS ✓
- §6.1 sks-ai 端点（剥 raw["profile"]、found:false、不过 safetyCheck）→ Task 1 ✓
- §6.2/§6.3 sampleOpening(userId,threadId,topic) → Task 2 ✓
- §6.4 sks-web sampleOpening + done 触发 → Task 4 ✓
- §7 错误处理（静默隐藏）→ Task 4 onError + shouldShowSampleBlock ✓
- §8 测试 → Task 1 sks-ai pytest + Task 2 Java + Task 3 vitest（已按测试基建修订为纯函数）✓
- §9 契约文档 → Task 1 API_CONTRACT + Task 2 REST_CONTRACT ✓
- §10 验收 + PROTOTYPE_GAP 行 10 → Task 5 ✓

**2. Placeholder scan:** 无 TBD/TODO/「适当处理」/「类似 Task N」。所有代码步骤含真实代码。✓

**3. Type consistency:**
- `SampleOpeningResponse` Java 字段 `withHook` (@JsonProperty "with") ↔ Python `with` ↔ TS `with`：跨语言键统一为 `"with"`，Java accessor 名 `withHook()`（语言关键字规避），TS 直读 `.with`。✓
- `currentStep`/`shouldShowSampleBlock`/`SampleState` 在 `calibrateMode.ts` 定义，测试与 Calibrate.tsx 同 import。✓
- `extractProfileContent`/`asText` 在 `lib/profileText.ts`，Calibrate 与 Positioning 同 import。✓
- sks-ai `sample_opening` 返回 `{topic, without, with}` ↔ 路由 `SampleOpeningResponse(found, topic, without, with)`（data 解包 `**data` 含三键，found 单独传）✓
