import { Link } from 'react-router-dom';
import { useRechargeStore } from '../../store/recharge';

/**
 * 工作台 `homeNew` 态——未校准用户的三步引导。
 * 文案/间距逐字对齐 `prototypes/extracted/sections/08-工作台.html`（`{{ homeNew }}` 块）。
 * 额度未开通条：原型在 homeNew 内恒显，这里收窄为 `balance === 0` 才显（有额度就不打扰）。
 */
const STEPS = [
  {
    to: '/positioning',
    step: '第 1 步 · 约 15 分钟',
    title: '校准账号定位',
    desc: '贴个链接聊几句，生成你的定位档案',
    emphasize: true, // 金边 tint 底（原型第 1 步强调）
  },
  {
    to: '/analyze',
    step: '第 2 步 · 约 5 分钟',
    title: '拆一个对标账号',
    desc: 'TOP10 爆款全拆解，选题库立刻有货',
    emphasize: false,
  },
  {
    to: '/create',
    step: '第 3 步 · 约 1 分钟',
    title: '生成第一条文案',
    desc: '挑个选题一键生成，不满意免费换角度',
    emphasize: false,
  },
] as const;

export default function HomeNew({ balance }: { balance: number }) {
  const openRecharge = useRechargeStore((s) => s.open);
  return (
    <>
      <section className="mb-5 rounded-block border border-paper-line bg-paper-card px-[32px] py-[30px]">
        <h2 className="mb-1.5 font-serif text-[18px] font-black">三步开始，第一条文案 10 分钟内到手</h2>
        <p className="mb-[18px] text-copy text-paper-muted">按顺序完成，每一步都直接提升「稿子像不像你」</p>
        <div className="grid grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={
                s.emphasize
                  ? 'rounded-panel border border-paper-goldPale bg-paper-tint px-[18px] py-4 hover:border-paper-primary'
                  : 'rounded-panel border border-paper-line bg-paper-sunken px-[18px] py-4 hover:border-paper-primary'
              }
            >
              <div className="mb-1.5 text-meta font-bold text-paper-primary">{s.step}</div>
              <div className="mb-1 text-lead font-bold text-paper-ink">{s.title}</div>
              <div className="text-meta leading-normal text-paper-inkSoft">{s.desc}</div>
            </Link>
          ))}
        </div>
      </section>
      {balance === 0 && (
        <div className="flex items-center gap-3.5 rounded-panel border border-paper-dangerLine bg-paper-dangerTint px-[18px] py-3.5">
          <p className="flex-1 text-copy leading-normal text-paper-primaryDeep">
            <strong>额度未开通</strong> · 加微信备注手机尾号，10 分钟内开通并送 10 条体验额度
          </p>
          <button
            type="button"
            className="whitespace-nowrap rounded-chip bg-paper-danger px-4 py-2 text-copy text-white hover:bg-paper-dangerHover"
            onClick={openRecharge}
          >
            查看二维码
          </button>
        </div>
      )}
    </>
  );
}
