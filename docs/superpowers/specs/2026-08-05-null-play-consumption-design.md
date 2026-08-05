# null-play / 消费链 — 设计 spec

> **范围**：D4 follow-up（D1-D4 + 前 follow-up 全合 main）。视频号 detail 不返真实播放量（read_count=0）——改成服务端写 null + 消费链 null-based like-proxy，**两套策略不硬揉**（抖音主指标 play、视频号主指标 like）。
> **仓**：sks-ai + sks-server（前端不改——formatMetric 已 null→「—」）。
> **基准日期**：2026-08-05。

## 1. 目标与背景

D4 like-proxy 只改了 track classify（`play>0?play:like`），但：① markMetrics 存真实 play=0（视频号）——DB 0 与 hot 标签矛盾、前端显示「0」掩盖不可用；② attribute/周卡 仍传 play=0——与 hot/flop 矛盾；③ `play>0` 启发式对抖音偶发真 0 也会误走 like。

**两套策略（产品层）**：
- **抖音**：主指标 play。判态+归因+周卡 都用 play。表显示 播放/点赞/评论/分享/收藏。
- **视频号**：主指标 like（无可靠播放不占坑）。判态+归因+周卡 都用 like。表播放格「—」（不塞 like），显示 点赞/评论/分享/收藏。

**关键洞察**：平台区分编码进 **null-vs-值**——视频号 play_count=null、抖音 play_count=真值（含真 0）。消费者 `play_count != null ? play_count : like_count` 即得：抖音→play（含真 0）、视频号→like。无需消费者知平台、无需 sks-ai prompt 改（消费者传一个数；β「按点赞评估」以后再开）。

## 2. 非目标

- **不改 sks-ai 归因 prompt 文案**（`_build_single_messages` / `_build_weekly_messages` 不动）——消费者传数（like-proxy 后的 int），sks-ai 收到的是数不是 null。β「标按点赞评估」未来另开。
- **不混 like+play 进 baseline**：avgPlayCount30d 保持 `play_count > 0`（排除 null/0）——baseline = 正播放量抖音；视频号不进 baseline（混会让抖音误判）。视频号按 like-vs-抖音-play-avg 隔离判（模糊但不污染抖音）。
- **不「播放格里塞 like」**：前端播放列视频号显示「—」（null），like 列两边都显示真实 like。
- **不改前端**：formatMetric(null)→「—」已对；ScriptSummary.playCount 已 nullable。

## 3. sks-ai（null 信号源）

- `VideoMeta.play_count: int | None`（`tikhub.py`，现 `int`）。
- `_parse_channels_video`（视频号）：`play_count = read_count if (read_count := _safe_int(item.get("read_count"))) > 0 else None`——视频号 read_count=0/缺失 → None（不可用信号）；read_count>0（罕见真值）→ 保留。**抖音 `_parse_video` 不动**（statistics.play_count 真值，含真 0，保留 0）。
- `VideoMetricsResponse.play_count: int | None = None`（`analyze.py`，现 `int = 0`）。
- 抖音返真 play（0+）；视频号返 None。
- 端点 `GET /ai/analyze/video/metrics`：found=true + play_count=None（视频号）/ 真值（抖音）。

## 4. sks-server（存 null + null-based 消费）

### 4.1 VideoMetricsResponse + track
- `AiClient.VideoMetricsResponse.playCount`：已 `Integer`（nullable）✓。
- `ReviewService.track`：
  ```java
  Integer playN = m.playCount();                 // null（视频号）/ 真值（抖音，含 0）
  int like = m.likeCount() == null ? 0 : m.likeCount();
  int comment = ..., share = ..., collect = ...;   // null-safe
  double avg = scriptMapper.avgPlayCount30d(userId);
  int classifyCount = playN != null ? playN : like; // null-based: 抖音→play(含真0), 视频号→like
  ReviewContext ctx = new ReviewContext(classifyCount, avg, hotThreshold, flopThreshold);
  String next = transition(TRACKING, PLAY_COUNT, ctx);
  scriptMapper.markMetrics(scriptId, userId, next, playN, like, comment, share, collect); // 存真 playN（视频号=null）
  return new TrackResponse(next, playN, like, comment, share, collect);                    // 返真 playN（视频号=null）
  ```
  （替换现 `play > 0 ? play : like` 的 >0 启发式为 `playN != null ? playN : like` 的 null-based。）
- `markMetrics` SQL：`playCount` 参数 `int → Integer`；`play_count = #{playCount}`（MyBatis null→SQL NULL）。视频号存 NULL，抖音存真值。
- `TrackResponse.playCount`：`int → Integer`（返 null 给前端）。

### 4.2 attribute（single 归因）
```java
public AttributionView attribute(long userId, long scriptId) {
    Script s = load(userId, scriptId);
    if (!FLOP.equals(s.getReviewState())) throw BizException(PARAM_INVALID, "仅扑街稿件可看归因");
    double baseline = scriptMapper.avgPlayCount30d(userId);
    int metric = s.getPlayCount() != null ? s.getPlayCount() : s.getLikeCount(); // null-based like-proxy
    AiClient.AttributionSingleResult r = aiClient.attributionSingle(scriptText(s), metric, baseline);
    ...
}
```
（替换现 `s.getPlayCount()==null?0:...`。视频号→like、抖音→play 传给 sks-ai 作 play_count；skss-ai 收到数，prompt 不改。）

### 4.3 weekly（周卡）
`WeeklyReportJob.runForUser`：
```java
for (Script s : scripts) {
    Map<String, Object> item = new HashMap<>();
    item.put("script", ReviewService.scriptText(s));
    item.put("play_count", s.getPlayCount() != null ? s.getPlayCount() : s.getLikeCount()); // null-based like-proxy（数，非 null）
    item.put("review_state", s.getReviewState() == null ? "unknown" : s.getReviewState());
    item.put("baseline", baseline);
    scriptsPayload.add(item);
}
```
（替换现 `s.getPlayCount()==null?0:...`。传数（like-proxy），skss-ai `_build_weekly_messages` `s.get("play_count", 0)` 收到数，不渲染 "None"。）

### 4.4 avgPlayCount30d（不改）
`play_count IS NOT NULL AND play_count > 0`——视频号 null 排除、抖音真 0 排除、抖音正播放量进 baseline。✓ baseline = 正播放量抖音，视频号不进。

### 4.5 V7 迁移（清存量视频号 0-play）
`V7__script_null_videohan_play.sql`：
```sql
UPDATE script SET play_count = NULL
WHERE play_count = 0 AND publish_url LIKE '%weixin.qq.com%';
```
（存量视频号 0-play → null，与新行为一致。publish_url 含 weixin.qq.com 是视频号信号，照 `_platform_of` host 判。抖音真 0 不动。）

## 5. 前端（不改）
- `ScriptSummary.playCount?: number | null`（已 nullable）。
- `Review.tsx` 播放列 `formatMetric(s.playCount)`——null→「—」（视频号）、真值→数（抖音，含 0）。like 列两边都显真实 like。
- `TrackResponse.playCount: number | null`（track 返 null 视频号）。

## 6. 两套策略汇总

| 触点 | 抖音 | 视频号 |
|---|---|---|
| DB play_count | 真值（含真 0） | null |
| 前端播放列 | 数（含 0） | 「—」 |
| 前端点赞列 | like | like |
| classify | play | like（`playN!=null?playN:like`） |
| attribute | play | like（`play!=null?play:like`） |
| weekly | play | like（同上） |
| avgPlayCount30d | 正播放量进 baseline | 不进（null/0 排除） |

## 7. 测试
- sks-ai：`_parse_channels_video` video号 read_count=0 → play_count=None；read_count>0 → 保留。VideoMetricsResponse video号 play_count=None。
- sks-server ReviewServiceTest：
  - track 视频号（fetchVideoMetrics play=null, like=9000）→ classifyCount=like → hot；DB play_count=NULL；TrackResponse.playCount=null。
  - track 抖音真 0（play=0, like=5）→ classifyCount=0 → flop/plain（用 play=0，非 like）——**防 >0 启发式误走 like**。
  - attribute 视频号（s.play=null, like=9000）→ metric=like 传 attributionSingle。
  - weekly 视频号（s.play=null, like=9000）→ Map play_count=9000（like-proxy）。

## 8. 契约文档
- `REST_CONTRACT.md`：ScriptSummary/TrackResponse playCount 标 nullable（视频号 null）；track/attribute 用 null-based like-proxy 一句。
- `API_CONTRACT.md`：`/ai/analyze/video/metrics` play_count `int | None`（视频号 null）。

## 9. 验收
- 视频号 play_count=null（DB + 前端「—」）；判态+归因+周卡 用 like。
- 抖音 play_count=真值（含真 0）；判态+归因+周卡 用 play。
- null-based `play!=null?play:like` 一处定义，三消费点（classify/attribute/weekly）一致。
- 不混 like+play 进 baseline；不塞 like 进播放列；sks-ai prompt 不改。
