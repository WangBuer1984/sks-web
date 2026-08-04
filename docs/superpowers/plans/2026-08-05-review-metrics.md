# 发布复盘真指标 + 表格布局 (D4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布复盘登记链接后自动抓真互动五码（播放/点赞/评论/分享/收藏，抖音+视频号双平台）→ 真实 play_count 判 hot/plain/flop → 9 列表格展示；砍手填 `/play`；选题列 JOIN topic.title；令牌化；原型 section 16 加 3 指标列。

**Architecture:** track 登记链接→sk--ai `/ai/analyze/video/metrics?url=` 抓五码（抖音复用 video_meta；视频号新写 detail 解析）→ sks-server markMetrics+classify→表格展示。跨 3 仓 + 原型。短事务模式（不持 DB 连接调 Python）。

**Tech Stack:** FastAPI + tikhub（sks-ai）；Spring Boot + MyBatis + RestClient（sks-server）；React + TanStack Query + Tailwind（sks-web）。

## Global Constraints

- **纸感色板 + 令牌**：Review.tsx 不得 `text-2xl/sm/xs` 冒充、不得裸 hex；`max-w-[980px]`。
- **短事务**：长 HTTP（调 sks-ai 抓取）不持 DB 连接——markTracking [短 tx] → aiClient.fetchVideoMetrics [无 DB] → markMetrics [短 tx]。
- **track 重试分流**：pending→markTracking（TRACK 事件校验）；tracking→不走 TRACK 事件，markTracking 覆盖 url 重抓；其它态→PARAM_INVALID。
- **markTracking 放宽** `WHERE review_state IN ('pending','tracking')`（tracking 重试覆盖 url 不 rows=0）。
- **markMetrics 守卫** `AND review_state='tracking'`（防竞态盖终态）。
- **data_source='tikhub'**（非 manual）。
- **found=false→PARAM_INVALID（可改链）；超时/5xx→AI_FAILED（可重试）**——均留 tracking，url 已存。
- **hot 副作用 best-effort**：applyHotSideEffects 失败 log.warn 不回滚态。
- **V4+V5 先提交，再 V6**（禁 out-of-order；V4/V5 改 benchmark_video，V6 改 script，不冲突但版本号必须递增）。
- **ScriptSummary 前端去重**：canonicalize 在 `api/script.ts`，`api/review.ts` re-export。
- **track 响应 BREAKING**：原 Void → `{reviewState, playCount, likeCount, commentCount, shareCount, collectCount}`（TrackResponse）。
- **选题列** = topic.title（listByUser LEFT JOIN topic，带 `t.user_id=s.user_id` 防跨用户串题）；`Script.topicTitle` `@TableField(exist=false)` 承接。
- **双平台**：抖音复用 `video_meta`；视频号新写 detail→VideoMeta 解析（核对 TikHub detail 响应结构）。
- **测试**：vitest node 纯函数；sks-ai pytest monkeypatch；sks-server @MockBean AiClient Testcontainers。

---

## File Structure

| 文件 | 责任 | 仓 |
|---|---|---|
| `app/api/analyze.py` (Modify) | 加 `GET /analyze/video/metrics` 路由 + VideoMetricsResponse 模型 | sks-ai |
| `app/datasource/tikhub.py` (Modify) | 加 `video_metrics(url)`（双平台分发：抖音 video_meta + 视频号 detail 解析） | sks-ai |
| `tests/test_video_metrics.py` (Create) | 端点 + video_metrics 测 | sks-ai |
| `docs/API_CONTRACT.md` (Modify) | 补 `/ai/analyze/video/metrics` | sks-ai |
| `V4/V5__*.sql` (commit) | 用户 WIP 先提交 | sks-server |
| `V6__script_video_metrics.sql` (Create) | script 加 4 指标列 | sks-server |
| `Script.java` (Modify) | +4 指标 + topicTitle | sks-server |
| `ScriptMapper.java` (Modify) | listByUser JOIN topic + 5 列；markTracking 放宽；markMetrics 新增 | sks-server |
| `ScriptController.java` (Modify) | ScriptSummary 加字段；list 返 | sks-server |
| `ReviewController.java` (Modify) | track 返 TrackResponse；删 /play | sks-server |
| `ReviewService.java` (Modify) | track 重写；删 play；markMetrics 调用 | sks-server |
| `AiClient.java` (Modify) | fetchVideoMetrics + VideoMetricsResponse record | sks-server |
| `ReviewServiceTest.java` (Modify) | track 新测；删 play 测 | sks-server |
| `docs/REST_CONTRACT.md` (Modify) | track data→TrackResponse；删 /play；ScriptSummary 补字段 | sks-server |
| `src/api/script.ts` (Modify) | ScriptSummary +5 指标 + topicTitle（canonical） | sks-web |
| `src/api/review.ts` (Modify) | 删 ScriptSummary 重复，re-export from script；trackScript 返 TrackResponse | sks-web |
| `src/pages/reviewMode.ts` (Create) | formatMetric / isHistoryEmpty 纯函数 | sks-web |
| `src/pages/reviewMode.test.ts` (Create) | 纯函数测 | sks-web |
| `src/api/review.test.ts` (Create) | trackScript body 测 | sks-web |
| `src/pages/Review.tsx` (Modify) | 9 列表格 + tracking 改链重试 + 去手填 + 令牌化 | sks-web |
| `prototypes/随口说原型-07191700.html` (Modify) | section 16 表头/行加 3 指标列 | sks-web |
| `prototypes/PROTOTYPE_GAP.md` (Modify) | 行 16 过线 + backlog 5 | sks-web |

---

## Task 1: sks-ai `/ai/analyze/video/metrics`（双平台）

**Files:**
- Modify: `/Users/rick/work/sks-ai/app/datasource/tikhub.py`
- Modify: `/Users/rick/work/sks-ai/app/api/analyze.py`
- Create: `/Users/rick/work/sks-ai/tests/test_video_metrics.py`
- Modify: `/Users/rick/work/sks-ai/docs/API_CONTRACT.md`

**Interfaces:**
- Consumes: `video_meta(url)`（抖音，L669）、`_fetch_channels_video_detail(client, share_url)`（L592）、`_parse_channels_video`（L625）、`_platform_of(url)`（L773）、`VideoMeta`（L116）。
- Produces: `video_metrics(url) -> VideoMeta | None`（双平台分发）；`GET /ai/analyze/video/metrics?url=` → `{found, play_count, like_count, comment_count, share_count, collect_count}`。

- [ ] **Step 1: 写失败测试** — `tests/test_video_metrics.py`

```python
import pytest
from app.datasource.tikhub import VideoMeta


@pytest.mark.asyncio
async def test_video_metrics_douyin(monkeypatch):
    from app.datasource import tikhub

    async def _fake_meta(url, *, client=None):
        return VideoMeta(title="t", play_count=100, fav_count=0, download_url="",
                         platform="douyin", like_count=10, comment_count=2,
                         share_count=3, collect_count=4)

    monkeypatch.setattr(tikhub, "video_meta", _fake_meta)
    m = await tikhub.video_metrics("https://v.douyin.com/abc")
    assert m is not None
    assert (m.play_count, m.like_count, m.comment_count, m.share_count, m.collect_count) == (100, 10, 2, 3, 4)


@pytest.mark.asyncio
async def test_video_metrics_wechat_channels(monkeypatch):
    from app.datasource import tikhub

    async def _fake_channels(url, *, client=None):
        return VideoMeta(title="c", play_count=200, fav_count=5, download_url="",
                         platform="wechat_channels", like_count=20, comment_count=4,
                         share_count=6, collect_count=5)

    monkeypatch.setattr(tikhub, "channels_video_metrics", _fake_channels)
    m = await tikhub.video_metrics("https://weixin.qq.com/sph/xxx")
    assert m is not None
    assert m.platform == "wechat_channels"
    assert m.play_count == 200


@pytest.mark.asyncio
async def test_video_metrics_unknown_returns_none(monkeypatch):
    from app.datasource import tikhub
    m = await tikhub.video_metrics("https://example.com/unknown")
    assert m is None


def test_video_metrics_endpoint_passes_through(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.datasource import tikhub
    from app.api import analyze
    monkeypatch.setattr(analyze.settings, "SERVICE_TOKEN", "test-secret")

    async def _vm(url):
        return VideoMeta(title="t", play_count=7, fav_count=0, download_url="",
                         platform="douyin", like_count=1, comment_count=0,
                         share_count=0, collect_count=0)
    monkeypatch.setattr(analyze, "video_metrics", _vm)
    with TestClient(app) as c:
        r = c.get("/ai/analyze/video/metrics",
                  params={"url": "https://v.douyin.com/x"},
                  headers={"X-Service-Token": "test-secret"})
    assert r.status_code == 200
    j = r.json()
    assert j["found"] is True
    assert j["play_count"] == 7


def test_video_metrics_endpoint_not_found(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api import analyze
    monkeypatch.setattr(analyze.settings, "SERVICE_TOKEN", "test-secret")
    async def _vm(url): return None
    monkeypatch.setattr(analyze, "video_metrics", _vm)
    with TestClient(app) as c:
        r = c.get("/ai/analyze/video/metrics",
                  params={"url": "https://bad"},
                  headers={"X-Service-Token": "test-secret"})
    assert r.status_code == 200
    assert r.json()["found"] is False
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-ai && uv run python -m pytest tests/test_video_metrics.py -v`
Expected: FAIL — `video_metrics` / `channels_video_metrics` 不存在。

- [ ] **Step 3: 写 `video_metrics` + 视频号解析** — 加到 `app/datasource/tikhub.py`：

```python
async def channels_video_metrics(url: str, *, client: httpx.AsyncClient | None = None) -> VideoMeta | None:
    """视频号单视频互动指标（按分享链）。复用 _fetch_channels_video_detail，解析 detail 响应。

    detail 响应结构需与 TikHub `/api/v1/wechat_channels/v2/fetch_video_detail` 实际返回核对：
    预期 data.read_count(=play) / like_count / fav_count(=collect) / comment_count / forward_count(=share)。
    若实际字段名不同，按 _parse_channels_video 的取数点调整。
    """
    if not _is_configured():
        raise DataSourceError("TIKHUB_API_KEY not configured")
    own = client is None
    if own:
        client = httpx.AsyncClient()
    try:
        data = await _fetch_channels_video_detail(client, url)
        item = data.get("data") or data
        if not isinstance(item, dict) or not item:
            return None
        # 复用 _parse_channels_video 的取数逻辑（read→play, fav→collect, forward→share）
        meta = _parse_channels_video(item)
        return meta
    finally:
        if own:
            await client.aclose()


async def video_metrics(url: str, *, client: httpx.AsyncClient | None = None) -> VideoMeta | None:
    """单视频互动五码（双平台分发）。抖音走 video_meta；视频号走 channels_video_metrics；未知→None。"""
    plat = _platform_of(url)
    if plat == "douyin":
        return await video_meta(url, client=client)
    if plat == "wechat_channels":
        return await channels_video_metrics(url, client=client)
    return None
```

> **核对风险**：`_parse_channels_video` 当前针对 `fetch_user_videos` 列表条；detail 响应 `data` 字段结构可能略不同。实现期须核对 detail 实际响应（若 TIKHUB_API_KEY 可用，跑一个真实视频号 url 看 `data` 键；否则照 _parse_channels_video 的字段名 read_count/like_count/fav_count/comment_count/forward_count 取，缺则 0）。若 detail 结构把指标嵌在 `data.video_data` 等子层，调整取数路径。

- [ ] **Step 4: 加端点** — `app/api/analyze.py`：

import 区加：
```python
from app.datasource.tikhub import video_metrics as _video_metrics
...
video_metrics = _video_metrics
```

加 pydantic 模型 + 路由（照 `get_hot_board` 的 try/except DataSourceError→502 模式）：
```python
class VideoMetricsResponse(BaseModel):
    found: bool = False
    play_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    collect_count: int = 0

@router.get("/analyze/video/metrics", response_model=VideoMetricsResponse)
async def get_video_metrics(url: str) -> VideoMetricsResponse:
    try:
        m = await video_metrics(url)
    except DataSourceError as e:
        log.warning("video_metrics failed: %s", e)
        raise HTTPException(status_code=502, detail={"error": "VIDEO_METRICS_FAILED", "message": str(e)[:200]})
    if m is None:
        return VideoMetricsResponse(found=False)
    return VideoMetricsResponse(
        found=True,
        play_count=m.play_count, like_count=m.like_count, comment_count=m.comment_count,
        share_count=m.share_count, collect_count=m.collect_count,
    )
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-ai && uv run python -m pytest tests/test_video_metrics.py -v && uv run python -m pytest tests/test_video_analyze.py -q`
Expected: 新测 PASS；现有 analyze 测不回归。

- [ ] **Step 6: 补 `docs/API_CONTRACT.md`** — 端点总表加行 + 详情段：

总表加：`| GET | /ai/analyze/video/metrics | 需 | 单视频互动五码（抖音+视频号） | AiClient.fetchVideoMetrics |`

详情段（照 precheck 格式）：
```jsonc
### GET /ai/analyze/video/metrics

Query `url`（视频分享链）。
{ "found": true, "play_count": 1234, "like_count": 56, "comment_count": 7, "share_count": 8, "collect_count": 9 }
// 非视频/不可达/未知平台：{ "found": false, "play_count": 0, ... }
上游 DataSourceError → 502 {"detail":{"error":"VIDEO_METRICS_FAILED","message":"..."}}。
```

- [ ] **Step 7: 提交**

```bash
cd /Users/rick/work/sks-ai
git add app/datasource/tikhub.py app/api/analyze.py tests/test_video_metrics.py docs/API_CONTRACT.md
git commit -m "feat(analyze): /ai/analyze/video/metrics 双平台五码

抖音复用 video_meta；视频号新写 channels_video_metrics（detail 解析）；
unknown 平台 found=false。track 抓真指标用。"
```

> 注意：sks-ai 工作树可能有用户未提交 ASR WIP（graph.py/test_interview.py 等）。只 add 上述 4 文件，不 `git add -A`。

---

## Task 2: sks-server schema + track 重写 + 砍 /play

**Files:**
- Commit: `src/main/resources/db/migration/V4__*.sql` + `V5__*.sql`（用户 WIP，as-is）
- Create: `src/main/resources/db/migration/V6__script_video_metrics.sql`
- Modify: `Script.java`, `ScriptMapper.java`, `ScriptController.java`, `ReviewController.java`, `ReviewService.java`, `AiClient.java`
- Test: `ReviewServiceTest.java`
- Modify: `docs/REST_CONTRACT.md`

**Interfaces:**
- Consumes: `AiClient.get` 基座；`ReviewStateMachine.next/classify`；`ReviewEvent.PLAY_COUNT`；`ReviewContext`；`applyHotSideEffects`。
- Produces: `AiClient.VideoMetricsResponse` + `fetchVideoMetrics(url)`；`ReviewService.track` 返 `TrackResponse`；`ScriptMapper.markMetrics`；`ScriptSummary`（+topicTitle+5指标）；listByUser JOIN topic。

- [ ] **Step 1: 写失败测试** — 改 `ReviewServiceTest.java`：删 play 相关测（playCountAboveThreshold... 等），加 track 新测。

```java
@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void trackFetchesMetricsAndClassifiesHot() {
    when(aiClient.fetchVideoMetrics("https://v.douyin.com/abc"))
            .thenReturn(new AiClient.VideoMetricsResponse(true, 9000, 100, 10, 5, 8));
    when(aiClient.cardGen(anyLong(), any(), eq("C")))
            .thenReturn(new AiClient.CardGenResult(false, List.of(), List.of(), List.of()));
    insertFinalizedScript("flop", 2000); // baseline avg=2000, hot 阈值 6000
    long sid = insertTrackingScript();   // 已 pending→tracking（见 helper）
    ReviewService.TrackResponse r = reviewService.track(uid, sid, "https://v.douyin.com/abc");
    assertEquals("hot", r.reviewState());
    assertEquals(9000, r.playCount());
    assertEquals("tikhub", jdbcTemplate.queryForObject("SELECT data_source FROM script WHERE id=?", String.class, sid));
    assertEquals(100, jdbcTemplate.queryForObject("SELECT like_count FROM script WHERE id=?", Integer.class, sid));
}

@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void trackNotFoundThrowsParamInvalid() {
    long sid = insertTrackingScript();
    when(aiClient.fetchVideoMetrics(any())).thenReturn(new AiClient.VideoMetricsResponse(false, 0, 0, 0, 0, 0));
    assertThrows(BizException.class, () -> reviewService.track(uid, sid, "https://bad"));
    // state 留 tracking，url 已存
    assertEquals("tracking", jdbcTemplate.queryForObject("SELECT review_state FROM script WHERE id=?", String.class, sid));
}

@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void trackRetryFromTrackingRefetches() {
    when(aiClient.fetchVideoMetrics("https://v.douyin.com/abc"))
            .thenReturn(new AiClient.VideoMetricsResponse(true, 9000, 1, 0, 0, 0));
    when(aiClient.cardGen(anyLong(), any(), eq("C")))
            .thenReturn(new AiClient.CardGenResult(false, List.of(), List.of(), List.of()));
    insertFinalizedScript("flop", 2000);
    long sid = insertTrackingScript();
    reviewService.track(uid, sid, "https://v.douyin.com/abc"); // hot
    // 再 track 同 url（已是 hot，非法态）
    assertThrows(BizException.class, () -> reviewService.track(uid, sid, "https://v.douyin.com/abc"));
}
```

> 现有 `trackPendingToTrackingPersists` 改：track 现在要 fetch（桩 fetchVideoMetrics found=true + low play→plain）；`insertTrackingScript` helper 若已 track，调整。删所有 `reviewService.play(...)` 测。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest=ReviewServiceTest -q`
Expected: 编译失败 — `fetchVideoMetrics`/`VideoMetricsResponse`/`TrackResponse`/`markMetrics` 不存在；play 删后引用悬空。

- [ ] **Step 3: V4/V5 先提交 + V6 迁移**

```bash
cd /Users/rick/work/sks-server
git add src/main/resources/db/migration/V4__benchmark_video_metrics.sql src/main/resources/db/migration/V5__benchmark_video_duration.sql
git commit -m "chore(db): 提交 V4/V5 benchmark_video 指标列（WIP 落库，D4 V6 前置）"
```

Create `V6__script_video_metrics.sql`：
```sql
ALTER TABLE script
  ADD COLUMN IF NOT EXISTS like_count    INT,
  ADD COLUMN IF NOT EXISTS comment_count INT,
  ADD COLUMN IF NOT EXISTS share_count   INT,
  ADD COLUMN IF NOT EXISTS collect_count INT;
```

- [ ] **Step 4: Script.java 加字段**

```java
private Integer likeCount;
private Integer commentCount;
private Integer shareCount;
private Integer collectCount;

@TableField(exist = false)   // com.baomidou.mybatisplus.annotation.TableField
private String topicTitle;   // listByUser JOIN topic 承接，非实列
```

- [ ] **Step 5: ScriptMapper.java**

改 `listByUser`（JOIN topic + 5 指标列）：
```java
@Select("SELECT s.id, s.user_id, s.topic_id, s.platform, s.review_state, s.created_at, s.updated_at, "
        + "s.play_count, s.like_count, s.comment_count, s.share_count, s.collect_count, "
        + "t.title AS topic_title "
        + "FROM script s "
        + "LEFT JOIN topic t ON t.id = s.topic_id AND t.user_id = s.user_id "
        + "WHERE s.user_id = #{userId} AND (#{state}::text IS NULL OR s.review_state = #{state}) "
        + "ORDER BY s.updated_at DESC, s.id DESC")
List<Script> listByUser(@Param("userId") long userId, @Param("state") String state);
```

改 `markTracking`（放宽 pending|tracking）：
```java
@Update("UPDATE script SET review_state = 'tracking', publish_url = #{url}, updated_at = now() "
        + "WHERE id = #{id} AND user_id = #{userId} AND review_state IN ('pending','tracking')")
int markTracking(@Param("id") long id, @Param("userId") long userId, @Param("url") String url);
```

加 `markMetrics`（守卫 tracking + 5 指标 + data_source='tikhub'）：
```java
@Update("UPDATE script SET review_state = #{state}, play_count = #{playCount}, "
        + "like_count = #{likeCount}, comment_count = #{commentCount}, "
        + "share_count = #{shareCount}, collect_count = #{collectCount}, "
        + "data_source = 'tikhub', updated_at = now() "
        + "WHERE id = #{id} AND user_id = #{userId} AND review_state = 'tracking'")
int markMetrics(@Param("id") long id, @Param("userId") long userId, @Param("state") String state,
        @Param("playCount") int playCount, @Param("likeCount") int likeCount,
        @Param("commentCount") int commentCount, @Param("shareCount") int shareCount,
        @Param("collectCount") int collectCount);
```

删 `markReviewState`（仅 play 用，已删；grep 确认无其它调用方）。

- [ ] **Step 6: AiClient.java**

加 record + typed 方法（照 `interviewResult` GET 模式）：
```java
@JsonIgnoreProperties(ignoreUnknown = true)
public record VideoMetricsResponse(
        boolean found,
        @JsonProperty("play_count") Integer playCount,
        @JsonProperty("like_count") Integer likeCount,
        @JsonProperty("comment_count") Integer commentCount,
        @JsonProperty("share_count") Integer shareCount,
        @JsonProperty("collect_count") Integer collectCount) {}

public VideoMetricsResponse fetchVideoMetrics(String url) {
    return get("/ai/analyze/video/metrics?url={url}", VideoMetricsResponse.class, url);
}
```

- [ ] **Step 7: ScriptController.java ScriptSummary 加字段**

```java
public record ScriptSummary(
        Long id, Long topicId, String platform, String reviewState,
        OffsetDateTime createdAt, OffsetDateTime updatedAt,
        String topicTitle,
        Integer playCount, Integer likeCount, Integer commentCount,
        Integer shareCount, Integer collectCount) {
    public static ScriptSummary of(Script s) {
        return new ScriptSummary(s.getId(), s.getTopicId(), s.getPlatform(), s.getReviewState(),
                s.getCreatedAt(), s.getUpdatedAt(), s.getTopicTitle(),
                s.getPlayCount(), s.getLikeCount(), s.getCommentCount(),
                s.getShareCount(), s.getCollectCount());
    }
}
```

- [ ] **Step 8: ReviewService.java track 重写 + 删 play + TrackResponse**

加 record（ReviewService 内）：
```java
public record TrackResponse(String reviewState, int playCount, int likeCount,
                            int commentCount, int shareCount, int collectCount) {}
```

重写 `track`（删旧 track 96-106）：
```java
public TrackResponse track(long userId, long scriptId, String url) {
    if (url == null || url.isBlank()) {
        throw new BizException(ErrorCode.PARAM_INVALID, "发布链接不能为空");
    }
    Script s = load(userId, scriptId);
    String st = s.getReviewState();
    // pending → TRACK 事件校验 + markTracking；tracking → 不走 TRACK，markTracking 覆盖 url 重抓
    if (ReviewStateMachine.PENDING.equals(st)) {
        transition(st, ReviewEvent.TRACK, null); // 校验合法
    } else if (!ReviewStateMachine.TRACKING.equals(st)) {
        throw new BizException(ErrorCode.PARAM_INVALID, "当前状态不可登记链接");
    }
    if (scriptMapper.markTracking(scriptId, userId, url) == 0) {
        throw new BizException(ErrorCode.PARAM_INVALID, "稿件状态已变更，请刷新");
    }
    AiClient.VideoMetricsResponse m = aiClient.fetchVideoMetrics(url); // 无 DB 连接
    if (!m.found()) {
        throw new BizException(ErrorCode.PARAM_INVALID, "链接无法识别为视频，请检查发布链接");
    }
    double avg = scriptMapper.avgPlayCount30d(userId);
    ReviewContext ctx = new ReviewContext(m.playCount(), avg, hotThreshold, flopThreshold);
    String next = transition(ReviewStateMachine.TRACKING, ReviewEvent.PLAY_COUNT, ctx);
    if (scriptMapper.markMetrics(scriptId, userId, next,
            m.playCount(), m.likeCount(), m.commentCount(), m.shareCount(), m.collectCount()) == 0) {
        throw new BizException(ErrorCode.PARAM_INVALID, "稿件状态已变更，请刷新");
    }
    if (ReviewStateMachine.HOT.equals(next)) {
        applyHotSideEffects(userId, s); // best-effort
    }
    return new TrackResponse(next, m.playCount(), m.likeCount(), m.commentCount(), m.shareCount(), m.collectCount());
}
```

删 `play`（117-134）+ `markReviewState` 引用。`transition` 私有包装保留（track 用）。

- [ ] **Step 9: ReviewController.java track 返 TrackResponse + 删 /play**

```java
@PostMapping("/track")
public ApiResponse<ReviewService.TrackResponse> track(
        @AuthenticationPrincipal Long userId, @PathVariable long scriptId, @RequestBody TrackRequest req) {
    return ApiResponse.ok(reviewService.track(userId, scriptId, req.url()));
}
```
删 `@PostMapping("/play")` + `PlayRequest` + `PlayResponse`。保留 `TrackRequest(String url)` / `FeedbackRequest`。

- [ ] **Step 10: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-server && ./mvnw test -Dtest=ReviewServiceTest`
Expected: 全 PASS（新 track 测 + 现有 adopt/attribute/feedback 测；play 测已删）。

- [ ] **Step 11: 补 `docs/REST_CONTRACT.md`**

复盘段表：`/track` data 改 `TrackResponse`（BREAKING 标注）；删 `/play` 行。ScriptSummary 段（行 200）补 `topicTitle, playCount, likeCount, commentCount, shareCount, collectCount`。加 bullet：`track 登记链接后自动抓真指标（抖音+视频号）判态，data_source='tikhub'；found=false→4005，抓取失败→5001 可重试`。

- [ ] **Step 12: 提交**

```bash
cd /Users/rick/work/sks-server
git add src/main/resources/db/migration/V6__script_video_metrics.sql src/main/java/com/sks/script/Script.java src/main/java/com/sks/script/ScriptMapper.java src/main/java/com/sks/script/ScriptController.java src/main/java/com/sks/review/ReviewController.java src/main/java/com/sks/review/ReviewService.java src/main/java/com/sks/aiclient/AiClient.java src/test/java/com/sks/review/ReviewServiceTest.java docs/REST_CONTRACT.md
git commit -m "feat(review): track 自动抓真指标判态 + 砍 /play + script 4 指标列

track 登记→fetchVideoMetrics→markMetrics+classify（hot/plain/flop）+hot 副作用；
data_source='tikhub'；markTracking 放宽 pending|tracking；markMetrics 守卫 tracking；
listByUser JOIN topic→topicTitle；ScriptSummary +5 指标；/play 删。track 响应 BREAKING TrackResponse。"
```

> 注意：sks-server 工作树有用户 WIP（AiClient asr + analyze/topic/credit）。V4/V5 已在 Step 3 提交。只 add 上述 9 文件，不 `git add -A`。

---

## Task 3: sks-web ScriptSummary 去重 + Review.tsx 表格重塑

**Files:**
- Modify: `src/api/script.ts`（ScriptSummary canonical +5 指标 +topicTitle）
- Modify: `src/api/review.ts`（删重复 ScriptSummary，re-export；trackScript 返 TrackResponse）
- Create: `src/pages/reviewMode.ts` + `src/pages/reviewMode.test.ts`
- Create: `src/api/review.test.ts`
- Modify: `src/pages/Review.tsx`

**Interfaces:**
- Consumes: `GET /scripts`（ScriptSummary +topicTitle+5指标）、`POST /review/{id}/track`（TrackResponse）。
- Produces: `formatMetric(n)` / `isHistoryEmpty(scripts)` 纯函数；Review.tsx 9 列表格。

- [ ] **Step 1: 写失败测试** — `src/pages/reviewMode.test.ts` + `src/api/review.test.ts`

`reviewMode.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatMetric, isHistoryEmpty } from './reviewMode';

describe('formatMetric', () => {
  it('null → —', () => expect(formatMetric(null)).toBe('—'));
  it('undefined → —', () => expect(formatMetric(undefined)).toBe('—'));
  it('0 → 0', () => expect(formatMetric(0)).toBe('0'));
  it('1234 → 本地化', () => expect(formatMetric(1234)).toBe('1,234'));
});

describe('isHistoryEmpty', () => {
  it('空数组 → true', () => expect(isHistoryEmpty([])).toBe(true));
  it('非空 → false', () => expect(isHistoryEmpty([{ id: 1 } as any])).toBe(false));
});
```

`review.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackScript } from './review';
import { userClient } from './client';

vi.mock('./client', () => ({ userClient: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

describe('trackScript', () => {
  beforeEach(() => vi.clearAllMocks());
  it('posts {url} to /review/{id}/track', async () => {
    vi.mocked(userClient.post).mockResolvedValue({ reviewState: 'hot', playCount: 9, likeCount: 1, commentCount: 0, shareCount: 0, collectCount: 0 } as any);
    await trackScript(5, 'https://v.douyin.com/x');
    expect(userClient.post).toHaveBeenCalledWith('/review/5/track', { url: 'https://v.douyin.com/x' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/pages/reviewMode.test.ts src/api/review.test.ts`
Expected: FAIL — `formatMetric`/`isHistoryEmpty` 不存在；trackScript 返类型不符。

- [ ] **Step 3: `src/api/script.ts` ScriptSummary canonical**

```ts
export interface ScriptSummary {
  id: number;
  topicId: number;
  platform: string;
  reviewState: string;
  createdAt: string;
  updatedAt: string;
  topicTitle?: string | null;
  playCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  collectCount?: number | null;
}
```

- [ ] **Step 4: `src/api/review.ts` 去重 + trackScript 返 TrackResponse**

删本文件 `ScriptSummary` interface + `listScripts`（重复）；改为 re-export：
```ts
export type { ScriptSummary } from './script';
export { listScripts } from './script';
```
加 TrackResponse + 改 trackScript 返类型：
```ts
export interface TrackResponse {
  reviewState: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
}
export function trackScript(scriptId: number, url: string): Promise<TrackResponse> {
  return userClient.post<TrackResponse, TrackResponse>(`/review/${scriptId}/track`, { url });
}
```
删 `PlayResponse` + `playScript`（/play 砍）。

- [ ] **Step 5: `src/pages/reviewMode.ts`**

```ts
import type { ScriptSummary } from '../api/script';

export function formatMetric(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('zh-CN');
}

export function isHistoryEmpty(scripts: ScriptSummary[]): boolean {
  return scripts.length === 0;
}
```

- [ ] **Step 6: `src/pages/Review.tsx` 重塑**

全量重写（令牌化 + 9 列表格 + tracking 改链重试 + 去手填 play + 周卡留顶）。关键结构：

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { adoptScript, attributeScript, feedbackScript, getWeeklyReport, listScripts, trackScript,
  type AttributionView, type ScriptSummary, type TrackResponse, type WeeklyReportContent } from '../api/review';
import { formatMetric, isHistoryEmpty } from './reviewMode';

const COLS = 'grid grid-cols-[1fr_72px_64px_52px_52px_52px_52px_52px_140px] gap-2';

export default function Review() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState('');
  const [trackInputs, setTrackInputs] = useState<Record<number, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<number, string>>({});
  const [attributions, setAttributions] = useState<Record<number, AttributionView>>({});
  const weekStart = useMemo(currentWeekStart, []);

  const { data: scripts, isLoading } = useQuery<ScriptSummary[]>({ queryKey: ['scripts'], queryFn: () => listScripts() });
  const { data: weekly, isLoading: weeklyLoading } = useQuery<WeeklyReportContent | null>({ queryKey: ['weeklyReport', weekStart], queryFn: () => getWeeklyReport(weekStart) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['scripts'] }); qc.invalidateQueries({ queryKey: ['weeklyReport', weekStart] }); };

  const adoptMut = useMutation({ mutationFn: adoptScript, onSuccess: () => { setError(null); setBanner('已采用，待登记发布链接'); refresh(); }, onError: (e) => setError(getBizMessage(e, '采用失败')) });

  const trackMut = useMutation({
    mutationFn: (vars: { id: number; url: string }) => trackScript(vars.id, vars.url),
    onSuccess: (r: TrackResponse, vars) => {
      setError(null); setTrackInputs((p) => ({ ...p, [vars.id]: '' }));
      setBanner(r.reviewState === 'hot' ? '判态完成：爆款——续集选题已写入选题库' : `判态完成：${r.reviewState}`);
      if (r.reviewState === 'hot') qc.invalidateQueries({ queryKey: ['topics'] });
      refresh();
    },
    onError: (e) => setError(getBizMessage(e, '抓取失败，可重试')),
  });

  const attrMut = useMutation({ mutationFn: attributeScript, onSuccess: (r, id) => { setError(null); setAttributions((a) => ({ ...a, [id]: r })); }, onError: (e) => setError(getBizMessage(e, '归因失败')) });
  const feedbackMut = useMutation({ mutationFn: (vars: { id: number; reason: string }) => feedbackScript(vars.id, vars.reason), onSuccess: () => { setError(null); setBanner('反哺已提交'); setFeedbackInputs((p) => ({ ...p, [0]: '' })); qc.invalidateQueries({ queryKey: ['topics'] }); refresh(); }, onError: (e) => setError(getBizMessage(e, '反哺失败')) });

  return (
    <main className="mx-auto min-h-full max-w-[980px] px-5 py-8">
      <header className="mb-5">
        <h1 className="font-serif text-title font-black text-paper-ink">发布复盘</h1>
        <p className="mt-1 text-lead text-paper-muted">登记发布链接 → 自动抓互动数据 → 判态 → 归因 / 周卡 · 复盘免费</p>
      </header>

      {banner && <p className="mb-4 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2 text-meta font-semibold text-paper-primary">{banner}</p>}
      {error && <div role="alert" className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger">{error}</div>}

      {/* 周归因卡（留顶，令牌化）—— 沿用现有 ListBlock 结构，令牌化 */}
      <section className="mb-6 rounded-block border border-paper-line bg-paper-card p-6">
        {/* ... weekly summary/wins/gaps/nextFocus，令牌化同 D3 范式 ... */}
      </section>

      {/* 稿件表格 */}
      {isLoading ? <p className="py-10 text-center text-body text-paper-muted">加载中…</p>
       : isHistoryEmpty(scripts ?? []) ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black text-paper-ink">还没有稿件</p>
          <p className="mb-5 text-body leading-loose text-paper-inkSoft">生成并采用第一条文案后，它会出现在这里<br/>发布后登记视频地址，数据回来自动判态</p>
          <Link to="/topics" className="rounded-panel bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover">去选题库挑一个选题</Link>
        </div>
      ) : (
        <section className="rounded-block border border-paper-line bg-paper-card overflow-hidden">
          {/* 表头 */}
          <div className={`${COLS} bg-paper-sunken border-b border-paper-line px-5 py-3 text-meta font-bold text-paper-muted`}>
            <div>选题</div><div>平台</div><div>状态</div><div>播放</div><div>点赞</div><div>评论</div><div>分享</div><div>收藏</div><div>复盘动作</div>
          </div>
          {(scripts ?? []).map((s) => (
            <div key={s.id} className={`${COLS} border-b border-paper-tintDeep px-5 py-3.5 text-copy items-center`}>
              <div className="min-w-0">
                <div className="truncate text-copy font-bold text-paper-ink">{s.topicTitle || '选题已删除'}</div>
                <div className="text-hint text-paper-mutedLight">{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-meta text-paper-inkSoft">{s.platform}</div>
              <div><StateBadge state={s.reviewState} /></div>
              <div className="text-meta text-paper-inkSoft">{formatMetric(s.playCount)}</div>
              <div className="text-meta text-paper-inkSoft">{formatMetric(s.likeCount)}</div>
              <div className="text-meta text-paper-inkSoft">{formatMetric(s.commentCount)}</div>
              <div className="text-meta text-paper-inkSoft">{formatMetric(s.shareCount)}</div>
              <div className="text-meta text-paper-inkSoft">{formatMetric(s.collectCount)}</div>
              <div className="text-meta">
                {/* 行内动作 per state */}
                {s.reviewState === 'draft' && <button onClick={() => adoptMut.mutate(s.id)} disabled={adoptMut.isPending} className="rounded-chip bg-paper-primary px-3 py-1 text-white hover:bg-paper-primaryHover disabled:opacity-45">采用</button>}
                {s.reviewState === 'pending' && (
                  <div className="flex items-center gap-1">
                    <input type="url" placeholder="发布链接" value={trackInputs[s.id] ?? ''} onChange={(e) => setTrackInputs((p) => ({ ...p, [s.id]: e.target.value }))} className="w-24 rounded-chip border border-paper-lineStrong bg-paper-sunken px-2 py-1 text-meta outline-none focus:border-paper-primary" />
                    <button onClick={() => trackMut.mutate({ id: s.id, url: trackInputs[s.id] ?? '' })} disabled={trackMut.isPending || !(trackInputs[s.id] ?? '').trim()} className="rounded-chip bg-paper-primary px-2.5 py-1 text-white hover:bg-paper-primaryHover disabled:opacity-45">{trackMut.isPending ? '抓取中…' : '登记'}</button>
                  </div>
                )}
                {s.reviewState === 'tracking' && (
                  /* 失败可改链重试：tracking 行也暴露 url input + 重试（再调 track） */
                  <div className="flex items-center gap-1">
                    <input type="url" placeholder="改链接重试" value={trackInputs[s.id] ?? ''} onChange={(e) => setTrackInputs((p) => ({ ...p, [s.id]: e.target.value }))} className="w-24 rounded-chip border border-paper-dangerLine bg-paper-dangerTint px-2 py-1 text-meta outline-none focus:border-paper-primary" />
                    <button onClick={() => trackMut.mutate({ id: s.id, url: trackInputs[s.id] ?? s.publishUrl ?? '' })} disabled={trackMut.isPending} className="rounded-chip border border-paper-danger text-paper-danger px-2.5 py-1 hover:bg-paper-dangerTint disabled:opacity-45">重试</button>
                  </div>
                )}
                {(s.reviewState === 'hot' || s.reviewState === 'plain') && <span className="text-meta text-paper-mutedLight">数据正常</span>}
                {s.reviewState === 'flop' && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button onClick={() => attrMut.mutate(s.id)} disabled={attrMut.isPending} className="rounded-chip border border-paper-lineStrong text-paper-inkSoft px-2.5 py-1 hover:border-paper-primary hover:text-paper-primary disabled:opacity-45">{attrMut.isPending ? '归因中…' : attributions[s.id] ? '刷新' : '看归因'}</button>
                  </div>
                )}
                {(s.reviewState === 'flop' || s.reviewState === 'rejected') && (
                  <div className="flex items-center gap-1">
                    <input type="text" placeholder="反哺" value={feedbackInputs[s.id] ?? ''} onChange={(e) => setFeedbackInputs((p) => ({ ...p, [s.id]: e.target.value }))} className="w-20 rounded-chip border border-paper-lineStrong bg-paper-sunken px-2 py-1 text-meta outline-none focus:border-paper-primary" />
                    <button onClick={() => feedbackMut.mutate({ id: s.id, reason: feedbackInputs[s.id] ?? '' })} disabled={feedbackMut.isPending || !(feedbackInputs[s.id] ?? '').trim()} className="rounded-chip border border-paper-lineStrong text-paper-inkSoft px-2.5 py-1 hover:border-paper-primary hover:text-paper-primary disabled:opacity-45">反哺</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* flop 归因展开行（attributions[s.id]）—— 全宽展示，令牌化 */}
        </section>
      )}
    </main>
  );
}
// StateBadge / ListBlock / currentWeekStart 沿用，令牌化（去裸 hex、text-2xl/sm）。
```

> 关键：`tracking` 行不只「追踪中」——暴露改链 input + 「重试」按钮（再调 trackMut），对应失败分流。删 playCount input + 「填数判态」+ `playMut`。`StateBadge` 令牌化（STATE_BADGE 的裸 hex→paper.*）。`currentWeekStart` 保留。

- [ ] **Step 7: 跑测试 + 构建**

Run: `cd /Users/rick/work/sks-web && npm test && npm run build`
Expected: reviewMode + review 测 PASS；全测 PASS；build 无 TS 报错。

- [ ] **Step 8: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/api/script.ts src/api/review.ts src/pages/reviewMode.ts src/pages/reviewMode.test.ts src/api/review.test.ts src/pages/Review.tsx
git commit -m "refactor(review): 9 列表格 + 真指标 + track 自动判态 + 令牌化

ScriptSummary canonical 到 api/script.ts（+topicTitle+5指标），review.ts re-export；
Review.tsx 9 列表格（选题/平台/状态/播放/点赞/评论/分享/收藏/动作）；
tracking 行改链重试；去手填 play；周卡留顶令牌化；抽 reviewMode 纯函数测。"
```

> 注意：sks-web 工作树有用户 WIP（PROTOTYPE_GAP/analyze/topic/Review/Topics）。只 add 上述 6 文件，不 `git add -A`。

---

## Task 4: 原型 section 16 改 5 指标列 + 重生成

**Files:**
- Modify: `/Users/rick/work/sks-web/prototypes/随口说原型-07191700.html`（section 16 表头/行）
- Regenerate: `prototypes/extracted/sections/16-历史稿件.html` + `prototypes/extracted/TOKENS.md`（脚本跑）

- [ ] **Step 1: 改源原型 section 16**

在 `随口说原型-07191700.html` 找 section 16（历史稿件/发布复盘）的表头 grid + 行 grid 的 `grid-template-columns`，从 `1fr 96px 78px 64px 64px 200px`（选题/平台/状态/播放/点赞/复盘动作）改成 9 列：`1fr 72px 64px 52px 52px 52px 52px 52px 140px`（选题/平台/状态/播放/点赞/评论/分享/收藏/复盘动作）。表头加 `<div>评论</div><div>分享</div><div>收藏</div>`；行模板对应加 3 个 `<div>{{ h.comment }}/{{ h.share }}/{{ h.collect }}</div>`（占位变量名沿用模板风格，如 `{{ h.commentCount }}` 等）。

> 这是源原型（视觉基准），用户已授权改。只动 section 16 表头/行两处 grid-template + 加 3 列 div，不动其它 section。

- [ ] **Step 2: 重生成**

Run: `cd /Users/rick/work/sks-web && node scripts/extract-prototype.mjs && node scripts/prototype-tokens.mjs`
Expected: 再生 `prototypes/extracted/sections/16-历史稿件.html`（9 列）+ `TOKENS.md`（如频次表变化）。

- [ ] **Step 3: 提交**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-07191700.html prototypes/extracted/sections/16-历史稿件.html prototypes/extracted/TOKENS.md prototypes/extracted/SECTIONS.md
git commit -m "proto: section 16 表格加 评论/分享/收藏 3 指标列（5 码）

重跑 extract-prototype + prototype-tokens 再生 16-历史稿件.html + TOKENS.md。"
```

> 注意：prototypes/PROTOTYPE_GAP.md 工作树有用户 WIP（rows 12/14）。不 add 它（Task 5 单独 surgical-stage）。

---

## Task 5: PROTOTYPE_GAP.md 行 16 + 验收

**Files:**
- Modify: `/Users/rick/work/sks-web/prototypes/PROTOTYPE_GAP.md`

- [ ] **Step 1: 改行 16** — 令牌不过→过、功能偏→过，证据改写、建议序 `5`→`—`。

原行 → 改为：
```
| 16 | 历史稿件 | `isHistory` | `Review.tsx` `/review` | 过 | 过 | 过 | 令牌过线（text-title/body/copy/meta/hint + paper.*，max-w-[980px]，无 text-2xl/sm 冒充、无裸 hex）。功能：9 列表格（选题 JOIN topic.title/平台/状态/播放/点赞/评论/分享/收藏/动作）+ track 登记自动抓真五码（抖音+视频号）判态 hot/plain/flop + hot 副作用；砍手填 /play；tracking 失败可改链重试；周卡留顶令牌化 | — |
```

- [ ] **Step 2: 改 backlog 序 5** — 划完成：
```
5. ~~**发布复盘** — 标题与表格布局 + 令牌化~~ ✅ 完成（9 列表格 + 真五码 + track 自动判态 + 选题 JOIN title；砍 /play；令牌化）
```

- [ ] **Step 3: 提交 + 验收**

```bash
cd /Users/rick/work/sks-web
# surgical-stage（WIP rows 12/14 + backlog 3 在同 hunk）—— HEAD-baselined git apply --cached patch
git commit -m "docs: PROTOTYPE_GAP 行 16 发布复盘过线"
```

验收：骨架路由可达 ✓；令牌过（grep Review.tsx 无 text-2xl/sm/xs + 裸 hex）✓；功能过（9 列表格 + 真五码 + track 自动判态 + 改链重试）✓；3 仓 + 原型 tests 绿。

---

## Self-Review

**1. Spec coverage:** §3 架构(track 短事务流程)→T2 ✓；§4 sks-ai 端点(双平台)→T1 ✓；§5.1 V4/V5+V6→T2 Step3 ✓；§5.2 实体/mapper/DTO(JOIN topic, markMetrics)→T2 ✓；§5.3 track 重写(pending/tracking 分流, found=false→PARAM, hot 副作用)→T2 Step8 ✓；§5.4 砍 /play→T2 Step9 ✓；§5.5 AiClient.fetchVideoMetrics→T2 Step6 ✓；§5.6 TrackResponse BREAKING→T2 ✓；§6 sks-web(ScriptSummary 去重, 9 列, tracking 改链重试, 周卡留顶)→T3 ✓；§7 原型+重生成→T4 ✓；§8 失败分流→T2/T3 ✓；§10 GAP→T5 ✓.
**5 实现期必须对准:** markTracking 放宽 IN('pending','tracking')→T2 Step5 ✓；markMetrics 守卫 'tracking'→T2 Step5 ✓；tracking 行改链重试 UI→T3 Step6 ✓；ScriptSummary 路径(canonical api/script.ts)→T3 Step3 ✓；JOIN topic_title→Script.topicTitle @TableField(exist=false)→T2 Step4/5 ✓.
**2 optional:** classify 经 transition(TRACKING, PLAY_COUNT, ctx)→T2 Step8 用 transition 包装 ✓；§4 复用 video_meta/channels 入口名→T1 Step3 video_metrics 分发 ✓.
**2. Placeholder:** 视频号 detail 解析有「核对结构」风险提示（T1 Step3 注），非占位。余无 TBD.
**3. Type consistency:** VideoMetricsResponse(sks-ai snake → Java @JsonProperty camel → TS camel) 5 指标 + found 一致；TrackResponse(reviewState + 5 metrics) 跨 Java→TS 一致；ScriptSummary(topicTitle + 5 metrics) 跨 Java→TS 一致。
