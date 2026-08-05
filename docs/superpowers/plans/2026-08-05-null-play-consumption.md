# null-play / 消费链 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 视频号无可靠播放量时 `play_count=null`（前端「—」），抖音保留真值（含真 0）；判态/归因/周卡统一 `play != null ? play : like`（null-based like-proxy），不改 sks-ai 归因 prompt、不改前端展示逻辑。

**Architecture:** sks-ai 视频号 `_parse_channels_video` 在 `read_count<=0` 时发出 `play_count=None`；sks-server track 存/返真 `Integer playN`（可 null），classify/attribute/weekly 共用 `effectiveMetric(play, like)`；V7 把存量视频号 `play_count=0` 清成 NULL。平台区分编码进 null-vs-值，消费者无需知平台。

**Tech Stack:** FastAPI + tikhub（sks-ai）；Spring Boot + MyBatis + Testcontainers（sks-server）。前端不改。

## Global Constraints

- **null-based（非 >0 启发式）**：`effectiveMetric = play != null ? play : (like == null ? 0 : like)`。抖音真 0 → 用 play=0，**不**误走 like。
- **avgPlayCount30d 不改**：保持 `play_count IS NOT NULL AND play_count > 0`（视频号 null 不进 baseline）。
- **不改 sks-ai 归因 prompt**（`_build_single_messages` / `_build_weekly_messages` 不动）。
- **不改前端**：`formatMetric(null)→「—」` 已对；不塞 like 进播放列。
- **V7 仅清视频号**：`play_count=0 AND publish_url LIKE '%weixin.qq.com%'` → NULL；抖音真 0 不动。
- **WIP 保全**：三仓若有未提交 WIP（analyze 等），只改本计划列出的文件，勿 `git add -A`。
- **测试**：sks-ai pytest；sks-server `ReviewServiceTest`（@MockBean AiClient）。

---

## File Structure

| 文件 | 责任 | 仓 |
|---|---|---|
| `app/datasource/tikhub.py` | `VideoMeta.play_count: int \| None`；channels `read<=0 → None` | sks-ai |
| `app/api/analyze.py` | `VideoMetricsResponse.play_count: int \| None = None` | sks-ai |
| `tests/test_video_metrics.py` | channels read=0→None；read>0 保留；端点透传 None | sks-ai |
| `docs/API_CONTRACT.md` | metrics `play_count` 标 `int \| None` | sks-ai |
| `V7__script_null_videohan_play.sql` | 存量视频号 0→NULL | sks-server |
| `ScriptMapper.java` | `markMetrics.playCount` `int→Integer` | sks-server |
| `ReviewService.java` | `effectiveMetric`；track 存/返 null；attribute/weekly 消费 | sks-server |
| `WeeklyReportJob.java` | Map `play_count` 用 effectiveMetric | sks-server |
| `ReviewServiceTest.java` | 视频号 null / 抖音真 0 / attribute like-proxy | sks-server |
| `docs/REST_CONTRACT.md` | playCount nullable；null-based 一句 | sks-server |

（前端文件：**不改**。`TrackResponse` TS `playCount: number` 运行时仍可收 null；可选后续一行 `| null`，本计划不做。）

---

### Task 1: sks-ai null 信号（VideoMeta + channels parse + metrics 响应）

**Files:**
- Modify: `/Users/rick/work/sks-ai/app/datasource/tikhub.py`
- Modify: `/Users/rick/work/sks-ai/app/api/analyze.py`
- Modify: `/Users/rick/work/sks-ai/tests/test_video_metrics.py`
- Modify: `/Users/rick/work/sks-ai/docs/API_CONTRACT.md`

**Interfaces:**
- Consumes: `_parse_channels_video`、`_safe_int`、`video_metrics`、`VideoMetricsResponse`
- Produces: 视频号 `play_count=None`（read≤0）；抖音不变（真值含 0）；`GET /ai/analyze/video/metrics` JSON `play_count: null | int`

- [ ] **Step 1: 改既有失败断言（将变绿的目标行为）**

在 `tests/test_video_metrics.py` 的 `test_channels_video_metrics_parses_detail_fixture`（或同名 detail fixture 测）把：

```python
assert m.play_count == 0  # read_count=0（API 限制）
```

改为：

```python
assert m.play_count is None  # read_count=0 → 不可用信号（非真 0）
```

并新增：

```python
@pytest.mark.asyncio
async def test_channels_video_metrics_positive_read_kept(monkeypatch):
    """罕见 read_count>0 → 保留真值（不强制 None）。"""
    from app.datasource import tikhub

    detail = {
        "code": 200,
        "data": {
            "nickname": "x",
            "title": [{"shortTitle": "t"}],
            "read_count": 1234,
            "like_count": 10,
            "fav_count": 1,
            "forward_count": 2,
            "comment_count": 3,
            "media": {"url": "http://example.com/v", "decode_key": "k", "duration": 10},
        },
    }

    async def _fake_fetch(client, share_url):
        return detail

    monkeypatch.setattr(tikhub, "_fetch_channels_video_detail", _fake_fetch)
    m = await tikhub.channels_video_metrics("https://weixin.qq.com/sph/x")
    assert m is not None
    assert m.play_count == 1234


def test_video_metrics_endpoint_channels_play_null(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api import analyze
    from app.datasource.tikhub import VideoMeta

    monkeypatch.setattr(analyze.settings, "SERVICE_TOKEN", "test-secret")

    async def _vm(url):
        return VideoMeta(
            title="c",
            play_count=None,
            fav_count=5,
            download_url="http://x",
            platform="wechat_channels",
            like_count=20,
            comment_count=4,
            share_count=6,
            collect_count=5,
        )

    monkeypatch.setattr(analyze, "video_metrics", _vm)
    with TestClient(app) as c:
        r = c.get(
            "/ai/analyze/video/metrics",
            params={"url": "https://weixin.qq.com/sph/x"},
            headers={"X-Service-Token": "test-secret"},
        )
    assert r.status_code == 200
    j = r.json()
    assert j["found"] is True
    assert j["play_count"] is None
    assert j["like_count"] == 20
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd /Users/rick/work/sks-ai && uv run pytest tests/test_video_metrics.py -q --tb=line`

Expected: FAIL —— `play_count == 0` 旧断言或新 `is None` 未满足 / endpoint 仍返 0。

- [ ] **Step 3: 实现**

`tikhub.py` — `VideoMeta.play_count`：

```python
play_count: int | None
```

`_parse_channels_video` 内替换 `play_count=_safe_int(item.get("read_count"))`：

```python
_read = _safe_int(item.get("read_count"))
play_count = _read if _read > 0 else None
```

并传入 `VideoMeta(..., play_count=play_count, ...)`。

**抖音 `_parse_video` / `_enrich_douyin_statistics` 不动**（真 0 保留）。

`analyze.py` — `VideoMetricsResponse`：

```python
class VideoMetricsResponse(BaseModel):
    found: bool = False
    play_count: int | None = None
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    collect_count: int = 0
```

端点组装已透传 `m.play_count`，无需改逻辑。

`docs/API_CONTRACT.md`：`/ai/analyze/video/metrics` 的 `play_count` 改为 `int | null`（视频号不可用为 null；抖音真值含 0）。

若其它构造 `VideoMeta(...)` 的测试因类型抱怨，保持传 int 即可（`int` 仍是合法 `int | None`）。`account_analyze` 等把 `play_count` 塞进 JSON 时 None→`null`，可接受（视频号列表罕见正 read）。

- [ ] **Step 4: 跑测确认通过**

Run: `cd /Users/rick/work/sks-ai && uv run pytest tests/test_video_metrics.py tests/test_tikhub.py -q --tb=line`

Expected: PASS（若 `test_tikhub` 有视频号 `play_count == 10` 的 list 测，那是 `read_count>0` 保留路径，应仍绿）。

- [ ] **Step 5: Commit（仅本任务文件；勿 add WIP）**

```bash
cd /Users/rick/work/sks-ai
git add app/datasource/tikhub.py app/api/analyze.py tests/test_video_metrics.py docs/API_CONTRACT.md
git commit -m "$(cat <<'EOF'
feat(analyze): 视频号 play_count 不可用发 null

channels read_count<=0 → play_count=None；抖音真值（含 0）保留。
metrics 响应 play_count: int | null。供 server null-based like-proxy。

EOF
)"
```

---

### Task 2: sks-server V7 迁移 + markMetrics Integer + effectiveMetric + track/attribute/weekly

**Files:**
- Create: `/Users/rick/work/sks-server/src/main/resources/db/migration/V7__script_null_videohan_play.sql`
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/script/ScriptMapper.java`
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/review/ReviewService.java`
- Modify: `/Users/rick/work/sks-server/src/main/java/com/sks/review/WeeklyReportJob.java`
- Modify: `/Users/rick/work/sks-server/src/test/java/com/sks/review/ReviewServiceTest.java`
- Modify: `/Users/rick/work/sks-server/docs/REST_CONTRACT.md`

**Interfaces:**
- Consumes: Task 1 的 `play_count: null | int`（`AiClient.VideoMetricsResponse.playCount` 已是 `Integer`）
- Produces: `ReviewService.effectiveMetric(Integer play, Integer like) -> int`；`markMetrics(..., Integer playCount, ...)`；`TrackResponse.playCount` 为 `Integer`；attribute/weekly 传 effectiveMetric 数给 sks-ai

- [ ] **Step 1: 写失败测试（改写 + 新增）**

在 `ReviewServiceTest.java`：

**改写** `trackVideohanLikeProxyClassifiesHot`：

```java
/** 视频号 play=null + like=9000 → classify 用 like → hot；DB/响应 play=null。 */
@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void trackVideohanNullPlayLikeProxyClassifiesHot() {
    when(aiClient.fetchVideoMetrics("https://weixin.qq.com/sph/x"))
            .thenReturn(new AiClient.VideoMetricsResponse(true, null, 9000, 10, 5, 8));
    when(aiClient.cardGen(anyLong(), any(), eq("C")))
            .thenReturn(new AiClient.CardGenResult(false, List.of(), List.of(), List.of()));
    insertFinalizedScript("flop", 2000); // baseline avg=2000, hot 阈值 6000
    long sid = insertTrackingScript();
    ReviewService.TrackResponse r = reviewService.track(uid, sid, "https://weixin.qq.com/sph/x");
    assertEquals("hot", r.reviewState());
    assertNull(r.playCount());
    assertEquals(9000, r.likeCount());
    assertNull(
            jdbcTemplate.queryForObject(
                    "SELECT play_count FROM script WHERE id = ?", Integer.class, sid));
}
```

**新增** 抖音真 0 不误走 like：

```java
/** 抖音 play=0 + like=5000 + baseline=2000 → 用 play=0 判态（flop），非 like。 */
@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void trackDouyinTrueZeroPlayDoesNotUseLike() {
    when(aiClient.fetchVideoMetrics("https://v.douyin.com/zero"))
            .thenReturn(new AiClient.VideoMetricsResponse(true, 0, 5000, 0, 0, 0));
    insertFinalizedScript("flop", 2000); // avg=2000 → flop 阈值 1000；play=0 → flop
    long sid = insertTrackingScript();
    ReviewService.TrackResponse r = reviewService.track(uid, sid, "https://v.douyin.com/zero");
    assertEquals("flop", r.reviewState());
    assertEquals(0, r.playCount());
    assertEquals(
            0,
            jdbcTemplate.queryForObject(
                    "SELECT play_count FROM script WHERE id = ?", Integer.class, sid));
}
```

**新增** attribute 视频号用 like：

```java
/** flop + play=null + like=9000 → attributionSingle 收到 metric=9000（like-proxy）。 */
@Test
@Transactional(propagation = Propagation.NOT_SUPPORTED)
void attributeVideohanUsesLikeWhenPlayNull() {
    long sid = insertTrackingScript();
    jdbcTemplate.update(
            "UPDATE script SET review_state='flop', play_count=NULL, like_count=9000, "
                    + "publish_url='https://weixin.qq.com/sph/x', data_source='tikhub' WHERE id=?",
            sid);
    when(aiClient.attributionSingle(any(), eq(9000), anyDouble()))
            .thenReturn(new AiClient.AttributionSingleResult(false, "d", List.of("s")));
    ReviewService.AttributionView view = reviewService.attribute(uid, sid);
    assertEquals("d", view.diagnosis());
    verify(aiClient).attributionSingle(any(), eq(9000), anyDouble());
}
```

（若 `AttributionSingleResult` 构造签名不同，按现有测试同类用例对齐。）

**新增** `effectiveMetric` 纯测（若抽成 package-visible static）：

```java
@Test
void effectiveMetricNullPlayUsesLike() {
    assertEquals(9, ReviewService.effectiveMetric(null, 9));
    assertEquals(0, ReviewService.effectiveMetric(0, 9)); // 真 0 不走 like
    assertEquals(3, ReviewService.effectiveMetric(3, 9));
    assertEquals(0, ReviewService.effectiveMetric(null, null));
}
```

（若 prefer package-private 同包测，把方法放 `ReviewService` `static int effectiveMetric(...)`。）

删除或替换旧名 `trackVideohanLikeProxyClassifiesHot`（避免双测冲突）。

- [ ] **Step 2: 跑测确认失败**

Run: `cd /Users/rick/work/sks-server && ./mvnw -q -Dtest=ReviewServiceTest#trackVideohanNullPlayLikeProxyClassifiesHot,ReviewServiceTest#trackDouyinTrueZeroPlayDoesNotUseLike,ReviewServiceTest#attributeVideohanUsesLikeWhenPlayNull,ReviewServiceTest#effectiveMetricNullPlayUsesLike test`

Expected: FAIL（compile 或断言：仍存 0 / 仍用 >0 启发式）。

- [ ] **Step 3: V7 迁移**

Create `src/main/resources/db/migration/V7__script_null_videohan_play.sql`：

```sql
-- D4 follow-up：存量视频号 play_count=0（不可用被写成 0）→ NULL，与新 null 信号一致。
-- publish_url 含 weixin.qq.com（含 channels.weixin.qq.com / sph 分享链）；抖音真 0 不动。
UPDATE script SET play_count = NULL
WHERE play_count = 0 AND publish_url LIKE '%weixin.qq.com%';
```

- [ ] **Step 4: ScriptMapper.markMetrics 参数改 Integer**

```java
@Update(
        "UPDATE script SET review_state = #{state}, play_count = #{playCount}, "
                + "like_count = #{likeCount}, comment_count = #{commentCount}, "
                + "share_count = #{shareCount}, collect_count = #{collectCount}, "
                + "data_source = 'tikhub', updated_at = now() "
                + "WHERE id = #{id} AND user_id = #{userId} AND review_state = 'tracking'")
int markMetrics(
        @Param("id") long id,
        @Param("userId") long userId,
        @Param("state") String state,
        @Param("playCount") Integer playCount,
        @Param("likeCount") int likeCount,
        @Param("commentCount") int commentCount,
        @Param("shareCount") int shareCount,
        @Param("collectCount") int collectCount);
```

（MyBatis 对 `Integer null` → SQL NULL。）

- [ ] **Step 5: ReviewService — effectiveMetric + track + attribute**

在 `ReviewService` 增加：

```java
/** null-based 主指标：play 有值（含真 0）用 play；play==null（视频号不可用）用 like。 */
static int effectiveMetric(Integer play, Integer like) {
    if (play != null) {
        return play;
    }
    return like == null ? 0 : like;
}
```

`track` 核心替换为：

```java
Integer playN = m.playCount(); // null（视频号）/ 真值（抖音，含 0）
int like = m.likeCount() == null ? 0 : m.likeCount();
int comment = m.commentCount() == null ? 0 : m.commentCount();
int share = m.shareCount() == null ? 0 : m.shareCount();
int collect = m.collectCount() == null ? 0 : m.collectCount();
double avg = scriptMapper.avgPlayCount30d(userId);
int classifyCount = effectiveMetric(playN, like);
ReviewContext ctx = new ReviewContext(classifyCount, avg, hotThreshold, flopThreshold);
String next = transition(ReviewStateMachine.TRACKING, ReviewEvent.PLAY_COUNT, ctx);
if (scriptMapper.markMetrics(scriptId, userId, next, playN, like, comment, share, collect) == 0) {
    throw new BizException(ErrorCode.PARAM_INVALID, "稿件状态已变更，请刷新");
}
if (ReviewStateMachine.HOT.equals(next)) {
    applyHotSideEffects(userId, s);
}
return new TrackResponse(next, playN, like, comment, share, collect);
```

`TrackResponse`：

```java
public record TrackResponse(
        String reviewState,
        Integer playCount,
        int likeCount,
        int commentCount,
        int shareCount,
        int collectCount) {}
```

`attribute`：

```java
double baseline = scriptMapper.avgPlayCount30d(userId);
int metric = effectiveMetric(s.getPlayCount(), s.getLikeCount());
AiClient.AttributionSingleResult r =
        aiClient.attributionSingle(scriptText(s), metric, baseline);
```

- [ ] **Step 6: WeeklyReportJob 用 effectiveMetric**

`WeeklyReportJob.runForUser` 循环内：

```java
item.put(
        "play_count",
        ReviewService.effectiveMetric(s.getPlayCount(), s.getLikeCount()));
```

（传 int 数给 sks-ai，prompt 不改。）

- [ ] **Step 7: REST_CONTRACT.md**

- `ScriptSummary.playCount` / `TrackResponse.playCount`：标可 null（视频号不可用）。
- track / attribute / weekly：一句说明 null-based `play != null ? play : like`；avgPlayCount30d 仍仅正播放量。

- [ ] **Step 8: 跑全 ReviewServiceTest**

Run: `cd /Users/rick/work/sks-server && ./mvnw -q -Dtest=ReviewServiceTest test`

Expected: Tests run: N, Failures: 0, Errors: 0.

（若有 WeeklyReportJob 单测，一并跑：`-Dtest=ReviewServiceTest,WeeklyReportJobTest`；无则跳过。）

- [ ] **Step 9: Commit（仅本任务文件）**

```bash
cd /Users/rick/work/sks-server
git add \
  src/main/resources/db/migration/V7__script_null_videohan_play.sql \
  src/main/java/com/sks/script/ScriptMapper.java \
  src/main/java/com/sks/review/ReviewService.java \
  src/main/java/com/sks/review/WeeklyReportJob.java \
  src/test/java/com/sks/review/ReviewServiceTest.java \
  docs/REST_CONTRACT.md
git commit -m "$(cat <<'EOF'
feat(review): null-play 存库 + null-based like-proxy 消费

视频号 play=null（V7 清存量 0）；classify/attribute/weekly 共用
effectiveMetric(play, like)；抖音真 0 不误走 like。归因 prompt 不改。

EOF
)"
```

---

### Task 3: 计划自检收口（无新代码）

- [ ] **Step 1: Spec 覆盖核对**

| Spec § | Task |
|---|---|
| §3 sks-ai null 信号 | Task 1 |
| §4.1 track + markMetrics Integer + TrackResponse | Task 2 |
| §4.2 attribute | Task 2 |
| §4.3 weekly | Task 2 |
| §4.4 avgPlayCount30d 不改 | Task 2（不碰 SQL） |
| §4.5 V7 | Task 2 |
| §5 前端不改 | — |
| §7 测试矩阵 | Task 1+2 |
| §8 契约 | Task 1 API + Task 2 REST |

- [ ] **Step 2: Commit 本计划（sks-web docs only）**

```bash
cd /Users/rick/work/sks-web
git add docs/superpowers/plans/2026-08-05-null-play-consumption.md
git commit -m "$(cat <<'EOF'
docs: null-play/消费链实现计划

EOF
)"
```

（若用户要求「只写计划不 commit docs」，跳过本 step。）

---

## Plan self-review

1. **Spec coverage:** §3–§8 均有任务；§5 明确不改前端；β prompt 在非目标，未排任务。
2. **Placeholder scan:** 无 TBD；测试与实现代码块完整。
3. **Type consistency:** `Integer playN` / `effectiveMetric(Integer, Integer)→int` / `markMetrics` `Integer playCount` / `TrackResponse.playCount Integer` 贯穿 Task 2；sks-ai `int | None` 对应 Jackson `null`。
4. **Nits from spec review absorbed:** like null→0；`effectiveMetric` 一处定义；改写旧 videohan 测；前端类型可选延后。
