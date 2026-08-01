/**
 * 登录第二步——新用户开通额度引导。对齐原型 `loginStep2`（`prototypes/随口说原型-07191700.html`
 * 第 387 行内嵌源码，未单独提取为 section）。注册（`isNew=true`）后展示：
 * 账号已创建 + 微信二维码占位 + 微信号 + 两入口（都进工作台）。
 *
 * 真实环境无 C 端自助充值（充值由管理端开通，见 sks-server RechargeOrderService），
 * 故此处只展示联系方式，不调 API。二维码为占位图案，上线前替换为真实二维码图。
 */
export default function LoginOnboarding({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="text-center">
      <h2 className="mb-1 text-sub font-bold text-paper-ink">账号已创建，还差最后一步</h2>
      <p className="mb-[18px] text-caption leading-[1.7] text-paper-muted">
        新账号暂无使用额度
        <br />
        加我微信，备注手机尾号，我来为你开通
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
        onClick={onEnter}
        className="w-full rounded-card bg-paper-primary py-3.5 text-sub font-medium text-white hover:bg-paper-primaryHover"
      >
        已加微信，先进去看看
      </button>
      <button
        type="button"
        onClick={onEnter}
        className="mt-3 text-caption text-paper-primary hover:text-paper-primaryHover"
      >
        跳过，直接体验
      </button>
    </div>
  );
}
