# D4 · 发布复盘真指标 + 表格布局 — 设计 spec

> **范围**：交付物 D4（D1-D3 已合入 main）。把 `Review.tsx`(`/review`) 从「手填播放量 + state 分组卡片 + text-2xl/sm」重塑为：登记链接后自动抓真互动五码（播放/点赞/评论/分享/收藏）→ 真实 play_count 判 hot/plain/flop → 9 列表格展示；砍手填 `/play`；令牌化；选题列用 topic.title（JOIN）。
> **尺子**：原型 `15-知识库`... `16-历史稿件.html`（section 16，本 spec 改源原型加 3 指标列）。
> **仓**：sks-ai + sks-server + sks-web + 原型（跨 3 仓 + 原型，D4 最大）。
> **基准日期**：2026-08-05。

## 1. 目标与背景

`Review.tsx` 现状（见 `PROTOTYPE_GAP.md` 行 16）：令牌不过（`text-2xl`/`text-sm` + 裸 hex）；结构是 state 分组卡片（非原型表格）；`ScriptSummary` 无任何指标字段（连手填的 play_count 列表都拿不到）；`track` 纯存 url 不抓取；`play` 手填 count（`data_source='manual'`）；attribution 只用 play_count。

**真指标能力**（已勘察确认）：sks-ai `tikhub.py` 的 `video_meta(url)` + `_parse_video`(抖音) / `_parse_channels_video`(视频号) 能解析全部 5 码（`VideoMeta.{play,like,comment,share,collect}_count`），但**未暴露 `/ai/*` 端点给复盘**。`script` 表只有 `play_count`，无 like/comment/share/collect。

## 2. 非目标

- **不改 attribution prompt**（仍只用 play_count + baseline；互动指标只展示不进归因——除非后续单独开）。
- **不接 topic 标题之外的选题字段**（只 JOIN 取 `title`）。
- **不引入异步轮询**：track 同步等抓取（单视频快）；抓取失败可重试（再调 track）。
- **不改原型 16 之外的其他 section**（只动 section 16 表头/行加 3 列）。
- **不动 D1-D3 已合入的代码**。

## 3. 架构总览

```
前端 POST /api/review/{id}/track {url}
  → ReviewService.track（短 tx 拆分，不持 DB 连接调 Python）
      1. load script (IDOR: userId 归属校验)
      2. 若 pending → 短 tx markTracking(url) → 'tracking'
         若已 tracking（重试）→ 不走 TRACK 事件（非法迁移），沿用/覆盖 publish_url，直接重抓
      3. aiClient.fetchVideoMetrics(url)   // 无 DB conn
      4. found=false → 抛 PARAM_INVALID（可改链）；超时/5xx → 抛 AI_FAILED（可重试）
      5. 短 tx: markMetrics(五码, data_source='tikhub') + ReviewStateMachine.classify(play, avg, ×3, ×0.5) → hot/plain/flop
         hot → applyHotSideEffects（best-effort：续集写选题库；失败不回滚态）
      ← { reviewState, metrics }   // BREAKING（原 Void）
sks-ai GET /ai/analyze/video/metrics?url=
  → 检测 platform（url → 抖音/视频号）→ 对应 tikhub 解析
  → { found, play_count, like_count, comment_count, share_count, collect_count }
```

## 4. sks-ai `GET /ai/analyze/video/metrics`

- **router**：`app/api/analyze.py`（已有 `prefix` + `verify_service_token`）。新路由 `/video/metrics`（全路径 `/ai/analyze/video/metrics`）。
- **入参**：query `url`（必填）。
- **实现**：新 `app/datasource/...` 或 analyze 内函数，**复用现成 tikhub 解析，不新写抓取管线**：
  - 平台检测：`douyin.com` / 分享短链 → 抖音；微信视频号 share → 视频号。
  - 抖音：复用 `tikhub.fetch_one_video_by_share` + `_enrich_douyin_statistics` + `_parse_video`（取 `statistics.{play,digg,comment,share,collect}_count`）。
  - 视频号：复用 `tikhub` 视频号端点 + `_parse_channels_video`（`read_count`=播放 / `like_count`=点赞 / `fav_count`=收藏 / `forward_count`=分享 / `comment_count`=评论）。
  - 命令名对齐：`VideoMeta` 字段映射统一到 `{play_count, like_count, comment_count, share_count, collect_count}`（视频号 `read→play`、`forward→share`、`fav→collect`，见 §勘察）。
- **出参**（蛇形，对齐 sks-ai 惯例）：
  ```jsonc
  { "found": true, "play_count": 1234, "like_count": 56, "comment_count": 7, "share_count": 8, "collect_count": 9 }
  // found=false（非视频/不可达/解析空）：{ "found": false, "play_count": 0, ... }
  ```
- **found=false**：url 非视频 / 不可达 / 解析空（各 count 0）。不抛 500，返 200 + found=false（Java 翻译为 PARAM_INVALID）。
- **超时/5xx**：tikhub 抛 → 让其冒泡 → Java `AiClient.get` 基座翻译为 `AI_FAILED`。
- **API_CONTRACT.md**：补 `/ai/analyze/video/metrics` 行 + 契约段。

## 5. sks-server

### 5.1 Flyway（前置：V4+V5 先合，再 V6；禁 out-of-order）
- **先**：把未跟踪的 `V4__benchmark_video_metrics.sql` + `V5__benchmark_video_duration.sql`（用户 WIP）提交入库（as-is，不改）。
- **再**：新增 `V6__script_video_metrics.sql`：
  ```sql
  ALTER TABLE script
    ADD COLUMN like_count    INT,
    ADD COLUMN comment_count INT,
    ADD COLUMN share_count   INT,
    ADD COLUMN collect_count INT;
  -- play_count 已存在（INT/Java Integer），4 列对齐其类型，避免 BIGINT/Long 引入分歧。
  ```
  4 列 NULL（未抓取前为 null）。

### 5.2 实体 / Mapper / DTO
- `Script.java`：加 `Integer likeCount / commentCount / shareCount / collectCount`（`playCount` 已有，类型一致 Integer）。
- `ScriptMapper.listByUser`：SELECT 加 `play_count, like_count, comment_count, share_count, collect_count`；**LEFT JOIN topic**：
  ```sql
  SELECT s.id, s.user_id, s.topic_id, s.platform, s.review_state, s.created_at, s.updated_at,
         s.play_count, s.like_count, s.comment_count, s.share_count, s.collect_count,
         t.title AS topic_title
  FROM script s
  LEFT JOIN topic t ON t.id = s.topic_id AND t.user_id = s.user_id
  WHERE s.user_id = #{userId} AND (#{state}::text IS NULL OR s.review_state = #{state})
  ORDER BY s.updated_at DESC, s.id DESC
  ```
  （topic 跨用户隔离：JOIN 条件带 `t.user_id = s.user_id`，防跨用户串题。）
- `ScriptSummary` record：加 `Integer playCount/likeCount/commentCount/shareCount/collectCount` + `String topicTitle`（可空）。`ScriptController` 的 list 端点返此。
- 新 `markMetrics` Mapper 方法：
  ```java
  @Update("UPDATE script SET review_state=#{state}, play_count=#{playCount}, like_count=#{likeCount}, "
          + "comment_count=#{commentCount}, share_count=#{shareCount}, collect_count=#{collectCount}, "
          + "data_source='tikhub', updated_at=now() "
          + "WHERE id=#{id} AND user_id=#{userId}")
  int markMetrics(@Param("id") long id, @Param("userId") long userId, @Param("state") String state,
          @Param("playCount") Integer playCount, @Param("likeCount") Integer likeCount,
          @Param("commentCount") Integer commentCount, @Param("shareCount") Integer shareCount,
          @Param("collectCount") Integer collectCount);
  ```

### 5.3 track 重写（同步 + 短事务）
`ReviewService.track(userId, scriptId, url)`：
1. 校验 url 非空（PARAM_INVALID「链接不能为空」）；`findById(scriptId)` + 归属校验（IDOR：`userId` 不符 → NOT_FOUND/PARAM_INVALID）。
2. **态分流**：
   - `pending` → 短 tx `markTracking(scriptId, userId, url)` → state='tracking'。
   - `tracking`（重试）→ **不走 TRACK 事件**（状态机非法）；沿用/覆盖 publish_url（`markTracking` 幂等覆盖 url，态不变）；直接进步骤 3 重抓。
   - 其它态（hot/plain/flop/rejected/draft）→ PARAM_INVALID「当前状态不可登记链接」。
3. `VideoMetrics m = aiClient.fetchVideoMetrics(url);`（无 DB 连接）。
4. `if (!m.found())` → 抛 `BizException(PARAM_INVALID, "链接无法识别为视频，请检查发布链接")`（state 留 tracking，url 已存，可改链重试）。
   - tikhub 超时/5xx → `AiClient` 基座已翻译为 `AI_FAILED`（"指标抓取失败，可重试"），state 留 tracking。
5. 短 tx：`ReviewStateMachine.classify(m.playCount, avgPlayCount30d, hot×3, flop×0.5)` → state；`markMetrics(scriptId, userId, state, m.playCount, m.likeCount, m.commentCount, m.shareCount, m.collectCount)`。
   - hot → `applyHotSideEffects(userId, scriptId)`（best-effort：续集选题写入选题库；失败 log.warn 不回滚态，不阻断 track 返回）。
6. 返 `new TrackResponse(state, m)`。

### 5.4 砍 /play
- 移除 `POST /api/review/{id}/play` 端点 + `ReviewController.play` + `ReviewService.play` + `PlayRequest`/`PlayResponse`。
- `ReviewStateMachine.classify` 保留（track backfill 调用）。
- 状态机注释改：`tracking = 已登记，指标抓取中/可重试`（不新增终态）。

### 5.5 AiClient.fetchVideoMetrics
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
（蛇形入参键 ↔ Java 驼峰字段，照 `interviewResult` 模式。）

### 5.6 track 响应（BREAKING）+ 契约
- `TrackResponse(String reviewState, VideoMetricsResponse metrics)`（或独立 record 不含 found——found=true 才到这）。
- `REST_CONTRACT.md`：「### 复盘」段：
  - `POST /api/review/{id}/track` 请求 `{url}`，**data 改 `TrackResponse`**（原 `null`）——BREAKING 标注。
  - 移除 `POST /api/review/{id}/play` 行。
  - `ScriptSummary` 字段补 `topicTitle + playCount/likeCount/commentCount/shareCount/collectCount`。

## 6. sks-web

### 6.1 api/review.ts
- `ScriptSummary` 加 `topicTitle?: string` + `playCount?: number` / `likeCount` / `commentCount` / `shareCount` / `collectCount`（可空，未抓取前 undefined）。
- `trackScript(id, url)` 返回类型改 `Promise<TrackResponse>`（`{reviewState, metrics}`）。

### 6.2 Review.tsx 重塑
- **标题**「发布复盘」(已对)；**令牌化**（text-2xl→text-title, text-sm→text-body/copy, 裸 hex→paper.*, 去 shadow-sm, rounded-2xl→rounded-block）；`max-w` 对齐原型量级（原型 980px → `max-w-[980px]`）。
- **空态**：dashed box「还没有稿件」+ 说明 + 「去选题库挑一个选题」`<Link to="/topics">`（working）。
- **9 列表格**（`grid-cols-[1fr_80px_72px_56px_56px_56px_56px_56px_160px]` 或实现期调）：
  - 表头：选题 / 平台 / 状态 / 播放 / 点赞 / 评论 / 分享 / 收藏 / 复盘动作（`text-meta text-paper-muted`，`bg-paper-sunken`）。
  - 行：选题=`topicTitle || '选题已删除'` + 副行 `{createdAt}`；平台；状态 badge；5 指标（`text-meta`，null→`—`）；复盘动作（行内，per state）。
  - 行内动作（沿用现有 mutation，去手填 play）：
    - draft → 「采用」
    - pending → 登记链接 input + 「登记」按钮（→ trackMut）
    - tracking → 「追踪中」（若 track 失败态显示「重试」=再调 track）
    - hot/plain → 「数据正常」（灰字）
    - flop → 「看归因」+「反哺」input
    - rejected → 「反哺」input
- **去手填 play**：移除 playCount input + 「填数判态」按钮 + `playMut`（或保留 playMut 不用？移除）。
- **track 成功** → `invalidateQueries(['scripts'])` + banner（沿用 hot 续集提示）。
- **周归因卡**：留顶部详卡（summary/wins/gaps/nextFocus），令牌化，不挪位。

### 6.3 测试
vitest node 纯函数（无 jsdom）：抽 `formatMetric(n?: number)`（null/undefined→'—'，否则本地化数字 `n.toLocaleString('zh-CN')`）+ `isHistoryEmpty(scripts)`（length===0）到 `src/pages/reviewMode.ts`，测；不渲染组件。trackScript 返回形状测（mock userClient，断言 body `{url}` + 返 TrackResponse）放 `src/api/review.test.ts`。

## 7. 原型改动

- 改 `prototypes/随口说原型-07191700.html` **section 16**（历史稿件/发布复盘）：表头 grid + 行 grid 的 `grid-template-columns` 加 评论/分享/收藏 3 列（与播放/点赞共 5 码），补对应 `<div>`。
- **重跑**：`cd /Users/rick/work/sks-web && node scripts/extract-prototype.mjs && node scripts/prototype-tokens.mjs` → 再生 `prototypes/extracted/sections/16-历史稿件.html` + `TOKENS.md`。
- 不动其它 section。

## 8. 错误处理 / 失败分流

| 情况 | 态 | 错误码 | 前端 |
|---|---|---|---|
| url 空/非视频/found=false | 留 tracking（url 已存，若已登记） | `PARAM_INVALID`(4005)「链接无法识别为视频，请检查」 | 改链重试 |
| tikhub 超时/5xx | 留 tracking | `AI_FAILED`(5001)「指标抓取失败，可重试」 | 「重试」=再调 track |
| 状态非法（非 pending/tracking） | 不变 | `PARAM_INVALID`「当前状态不可登记」 | — |
| hot 副作用失败 | 态已 hot（不回滚） | log.warn，track 正常返 | — |

## 9. 契约文档
- `sks-ai/docs/API_CONTRACT.md`：加 `/ai/analyze/video/metrics`。
- `sks-server/docs/REST_CONTRACT.md`：track data 改 `TrackResponse`（BREAKING）；删 `/play`；`ScriptSummary` 补字段。
- `prototypes/PROTOTYPE_GAP.md`：行 16 令牌不过→过 / 功能偏→过 + backlog 5 划完成。

## 10. 验收（GAP 行 16）
- 令牌：过——无 `text-2xl/sm` 冒充、无裸 hex，`max-w-[980px]`。
- 功能：过——9 列表格 + 真 5 码 + track 自动判态 + 选题 topic.title；无手填；deferred 无假数据；失败分流（坏链 PARAM / 抓取失败 AI_FAILED 可重试）。
