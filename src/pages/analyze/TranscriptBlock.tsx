import { useState } from 'react';

/**
 * 视频文案全文区块——拆视频结果区与明细详情态共用（spec D10）。
 *
 * <p>用**折叠 + 展开**而非固定高度内滚动：内滚动会与页面滚动打架（鼠标滚到这块就被
 * 抢走）。折叠态约 6 行 + 渐隐遮罩暗示"下面还有"，展开即完整高度、页面只有一个滚动条。
 *
 * <p>全宽容器下正文限宽居中（`max-w-[62em]`）：1040px 一行七十多字会看串行。
 * 复制失败（无 clipboard 权限 / 非安全上下文）只是不提示成功，不打断阅读。
 */
export default function TranscriptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const chars = text.replace(/\s/g, '').length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 无剪贴板权限：静默降级，用户仍可手动选中复制 */
    }
  };

  return (
    <div className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-copy font-bold text-paper-ink">
          文案全文 <span className="text-hint font-normal text-paper-muted">{chars} 字</span>
        </h3>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-meta text-paper-primary hover:text-paper-primaryHover"
        >
          {copied ? '已复制' : '复制全文'}
        </button>
      </div>

      <div className="relative">
        <p
          className={`mx-auto max-w-[62em] overflow-hidden whitespace-pre-wrap break-words rounded-card border border-paper-tintDeep bg-paper-sunken px-4 py-3.5 text-body leading-relaxed text-paper-ink ${
            open ? '' : 'max-h-[168px]'
          }`}
        >
          {text}
        </p>
        {open ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-card bg-gradient-to-b from-transparent to-paper-sunken" />
        )}
      </div>

      <div className="mt-2.5 text-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-meta text-paper-primary hover:text-paper-primaryHover"
        >
          {open ? '收起' : `展开全文（${chars} 字）`}
        </button>
      </div>
    </div>
  );
}