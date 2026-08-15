import { type BenchmarkVideoDetail, parseStructure } from '../../api/analyze';
import VideoResult from './VideoResult';
import { fmtCount, fmtDuration } from './helpers';

/**
 * 明细详情态的展示层（`/analyze?video=<id>`）——拆账号 TOP 清单与选题库共用的落地内容。
 *
 * <p>展示的全是拆账号当时已落库的东西（转写全文 + 四字段结构化 + 指标），
 * **不重新拆解、不扣费**。取数与输入框预填在 {@code Analyze.tsx}（spec §4.1）。
 *
 * <p>本组件只多画一张「这是哪条视频」的卡——链接流不需要它（链接是用户自己贴的），
 * 详情态需要（用户点进来时只知道标题）。其余全部交给 {@code VideoResult}，
 * 于是两个入口的结果区是同一份代码、同一套版面。
 */
export default function VideoDetail({ data }: { data: BenchmarkVideoDetail }) {
  const struct = parseStructure(data.structure);
  const metrics: [string, string][] = [
    ['播放', fmtCount(data.playCount)],
    ['点赞', fmtCount(data.likeCount)],
    ['评论', fmtCount(data.commentCount)],
    ['分享', fmtCount(data.shareCount)],
    ['收藏', fmtCount(data.collectCount)],
  ];
  // 缺项直接省略：author 对 V9 之前的旧行为 null，publishedAt/durationSec 上游也可能没有
  const subline = [
    data.author || null,
    data.publishedAt ? `发布 ${data.publishedAt.slice(0, 10)}` : null,
    fmtDuration(data.durationSec) || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex animate-slideup flex-col gap-4">
      <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
        <h2 className="mb-1 font-serif text-sub font-black leading-snug text-paper-ink">
          {data.title || '（无标题）'}
        </h2>
        {subline ? <p className="mb-3 text-caption text-paper-muted">{subline}</p> : null}
        <div className="flex flex-wrap gap-2">
          {metrics.map(([label, value]) => (
            <span
              key={label}
              className="rounded-tag border border-paper-lineStrong bg-paper-sunken px-2 py-[3px] text-hint text-paper-inkSoft"
            >
              {label} {value}
            </span>
          ))}
        </div>
        {data.description?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-caption leading-normal text-paper-inkSoft">
            {data.description}
          </p>
        ) : null}
      </section>

      <VideoResult
        structure={struct?.structure ?? ''}
        whyHot={struct?.why_hot ?? ''}
        framework={struct?.framework ?? ''}
        diffHint={struct?.diff_hint ?? ''}
        imitateTitle={data.title ?? undefined}
        transcript={data.transcript}
        existingTopicId={data.topicId}
      />
    </div>
  );
}