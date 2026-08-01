import { useEffect } from 'react';
import { useRechargeStore } from '../store/recharge';

/**
 * 充值引导弹窗——对齐原型 loginStep2 的微信二维码 + 微信号 + 开通说明块
 * （原型 `openRecharge` 的目标未单独成段，故复用 loginStep2 的引导内容）。
 * 由 AppLayout 单实例挂载；触发点经 `useRechargeStore.open()`。
 * 关闭：点遮罩 / ESC / 「我已加微信」「关闭」。
 * 无 C 端自助充值 API，仅展示联系方式；上线前换真二维码、改微信号占位。
 */
export default function RechargeDialog() {
  const isOpen = useRechargeStore((s) => s.isOpen);
  const close = useRechargeStore((s) => s.close);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper-ink/40 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm animate-slideup rounded-block border border-paper-line bg-paper-card p-8 text-center shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sub font-bold text-paper-ink">开通额度</h2>
        <p className="mb-[18px] text-caption leading-[1.7] text-paper-muted">
          加我微信，备注手机尾号
          <br />
          我来为你开通
        </p>

        <div className="mx-auto mb-2.5 flex h-[180px] w-[180px] items-center justify-center rounded-block border border-paper-lineStrong bg-paper-card">
          <div className="qr-placeholder relative h-[148px] w-[148px] rounded-tag">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-chip border-2 border-paper-ink bg-paper-card px-2 py-1 text-hint font-bold text-paper-ink">
                微信二维码占位
              </div>
            </div>
          </div>
        </div>

        <div className="mb-0.5 text-copy font-bold text-paper-ink">微信号：suikoushuo-wang</div>
        <div className="mb-5 text-meta text-paper-muted">工作时间一般 10 分钟内开通 · 首充送 10 条体验额度</div>

        <button
          type="button"
          onClick={close}
          className="w-full rounded-card bg-paper-primary py-3.5 text-sub font-medium text-white hover:bg-paper-primaryHover"
        >
          我已加微信
        </button>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-caption text-paper-muted hover:text-paper-ink"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
