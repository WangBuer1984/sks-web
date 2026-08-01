/**
 * 创作页输入卡——对齐原型 `13-文案创作.html` 第 7–17 行（`{{ isCreate }}` 输入卡）。
 * 自由 textarea（「这条视频想讲什么？」）+ 时长芯片（45/90/3分钟，45 选中）+ 生成按钮。
 *
 * <p>时长 `duration` 真传后端（`generateScript(topicId, platform, duration)` → sks-ai system prompt
 * 控篇幅），非 display-only。原型 45 秒默认选中。
 */
const DURATIONS = [
  { id: '45', label: '45 秒口播' },
  { id: '90', label: '90 秒' },
  { id: '180', label: '3 分钟深度' },
] as const;

export type DurationId = (typeof DURATIONS)[number]['id'];

export default function CreateInput({
  topic,
  onTopic,
  duration,
  onDuration,
  onGenerate,
  generating,
}: {
  topic: string;
  onTopic: (v: string) => void;
  duration: DurationId;
  onDuration: (d: DurationId) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <section className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-6 py-[22px]">
      <div className="mb-2.5 text-copy font-bold text-paper-ink">这条视频想讲什么？</div>
      <textarea
        value={topic}
        onChange={(e) => onTopic(e.target.value)}
        placeholder="输入关键词、一句话选题，或粘贴要仿写的爆款文案…"
        rows={3}
        className="w-full resize-none rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-3 text-lead leading-normal text-paper-ink outline-none focus:border-paper-primary"
      />
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <span className="text-meta text-paper-muted">时长</span>
        {DURATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onDuration(d.id)}
            className={
              duration === d.id
                ? 'rounded-badge border border-paper-primary bg-paper-tint px-3.5 py-[5px] text-caption text-paper-primary'
                : 'rounded-badge border border-paper-lineStrong px-3.5 py-[5px] text-caption text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary'
            }
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !topic.trim()}
          className="ml-auto rounded-card bg-paper-primary px-7 py-2.5 text-lead font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generating ? '生成中…' : '生成口播稿'}
        </button>
      </div>
    </section>
  );
}
