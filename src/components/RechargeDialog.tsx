import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, type MeResponse } from '../api/auth';
import { useRechargeStore } from '../store/recharge';

/**
 * 充值额度弹窗——对齐原型 `openRecharge` 目标（联系我充值 / 查看二维码 触发）。
 * 与登录引导页 loginStep2（「账号已创建」+ 两入口进工作台）不同：本弹窗是充值场景，
 * 展示套餐选择 + 微信二维码 + 转账说明，无在线充值（网站不支持，转账由站长手动开通）。
 *
 * 触发点经 `useRechargeStore.open()`；由 AppLayout 单实例挂载。
 * 手机尾号取当前登录用户 `me.phone` 后 4 位（提示转账时备注）。
 * 套餐与 sks-server `RechargeOrderService` 一致：p50（50条/¥49）、p150（150条/¥129，默认选中）。
 * 「拆账号 1 次 = 10 条」是计费换算说明。无 C 端自助充值 API，选套餐仅作金额提示，不提交。
 */
const PACKAGES = [
  { id: 'p50', qty: 50, price: 49 },
  { id: 'p150', qty: 150, price: 129 },
] as const;

type PkgId = (typeof PACKAGES)[number]['id'];

export default function RechargeDialog() {
  const isOpen = useRechargeStore((s) => s.isOpen);
  const close = useRechargeStore((s) => s.close);
  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 30_000,
  });
  const [pkg, setPkg] = useState<PkgId>('p150');

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper-ink/40 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-sm animate-slideup rounded-block border border-paper-line bg-paper-card p-8 text-center shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-sub font-bold text-paper-ink">充值额度</h2>
        <p className="mb-[18px] text-caption leading-[1.7] text-paper-muted">
          网站不支持在线充值，扫码加我微信{tail ? `，备注手机尾号 ${tail}` : ''}，转账后即时到账。
        </p>

        <div className="mx-auto mb-5 flex h-[180px] w-[180px] items-center justify-center rounded-block border border-paper-lineStrong bg-paper-card">
          <div className="qr-placeholder relative h-[148px] w-[148px] rounded-tag">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-chip border-2 border-paper-ink bg-paper-card px-2 py-1 text-hint font-bold text-paper-ink">
                微信二维码占位
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2.5">
          {PACKAGES.map((p) => {
            const selected = pkg === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPkg(p.id)}
                className={
                  selected
                    ? 'rounded-panel border border-paper-primary bg-paper-tint px-3 py-3'
                    : 'rounded-panel border border-paper-line bg-paper-sunken px-3 py-3 hover:border-paper-primary'
                }
              >
                <div className="font-serif text-title font-bold text-paper-ink">
                  {p.qty}
                  <span className="ml-1 text-meta font-normal text-paper-muted">条</span>
                </div>
                <div className="text-copy font-bold text-paper-primary">￥{p.price}</div>
              </button>
            );
          })}
        </div>
        <p className="mb-5 text-meta text-paper-muted">拆账号 1 次 = 10 条</p>

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
