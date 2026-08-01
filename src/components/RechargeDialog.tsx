import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, type MeResponse } from '../api/auth';
import { useRechargeStore } from '../store/recharge';

/**
 * 充值额度弹窗——逐字逐样对齐原型 `{{ rechargeModal }}` 块
 * （`prototypes/随口说原型-07191700.html` 第 387 行内嵌源码，未单独提取为 section）。
 *
 * 触发：侧边栏「联系我充值」/ 工作台「查看二维码」→ `useRechargeStore.open()`；
 * 由 AppLayout 单实例挂载。关闭：点遮罩 / ESC / 「知道了」。
 *
 * 手机尾号取 `me.phone` 后 4 位（原型硬编码 6621，这里动态化）。
 * 套餐静态展示、150 高亮（非交互可选，原型即如此）。无在线支付，仅展示微信转账方式；
 * 站长手动开通（sks-server RechargeOrderService）。套餐 p50/p150 与后端一致。
 */
export default function RechargeDialog() {
  const isOpen = useRechargeStore((s) => s.isOpen);
  const close = useRechargeStore((s) => s.close);
  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const tail = me?.phone ? me.phone.slice(-4) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper-ink/45 px-4"
      onClick={close}
    >
      <div
        className="w-[380px] max-w-full animate-slideup rounded-soft bg-paper-card px-8 py-[30px] text-center shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-[16px] font-bold text-paper-ink">充值额度</h2>
        <p className="mb-[18px] text-caption leading-[1.7] text-paper-muted">
          网站暂不支持在线支付
          <br />
          扫码加我微信，备注手机尾号{tail ? ` ${tail}` : ''}，转账后即时到账
        </p>

        <div className="mx-auto mb-2.5 flex h-[170px] w-[170px] items-center justify-center rounded-block border border-paper-lineStrong bg-paper-card">
          <div className="qr-placeholder relative h-[140px] w-[140px] rounded-tag">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-chip border-2 border-paper-ink bg-paper-card px-2 py-1 text-hint font-bold text-paper-ink">
                微信二维码占位
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3.5 text-copy font-bold text-paper-ink">微信号：suikoushuo-wang</div>

        <div className="mb-5 flex flex-wrap justify-center gap-2 text-meta text-paper-inkSoft">
          <span className="rounded-chip border border-paper-line px-2.5 py-1.5">50 条 / ¥49</span>
          <span className="rounded-chip border border-paper-primary bg-paper-tint px-2.5 py-1.5 text-paper-primary">
            150 条 / ¥129
          </span>
          <span className="rounded-chip border border-paper-line px-2.5 py-1.5">拆账号 1 次 = 10 条</span>
        </div>

        <button
          type="button"
          onClick={close}
          className="rounded-card border border-paper-lineStrong bg-paper-card px-7 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
