import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';

/**
 * 落地页（公开，无需登录）——对齐原型 `{{ isLanding }}` 那一支的五段：
 * 顶栏 / Hero / 四环节 / 技术 / 价格+CTA，见 `prototypes/extracted/sections/01`–`05`。
 *
 * <p>像素值取自原型 inline 样式，未经「大致换算成 Tailwind 默认阶」——原型主力字号是
 * 13.5 / 12.5px 这类半像素档，用 text-sm/text-xs 会系统性偏差，故走 tailwind.config 里
 * 按原型频次定的 body/caption/lead 等档位。
 *
 * <p>锚点导航沿用原型的 `landing-features` / `landing-tech` / `landing-price` 三个 id。
 */

/** 四环节文案，逐字取自原型 sections/03-四环节.html。 */
const STAGES = [
  {
    no: '01',
    title: '15 分钟聊出定位档案',
    desc: '贴个链接，AI 先猜你的人设；一问一答补齐红线与人群，档案注入之后的每一次创作。',
  },
  {
    no: '02',
    title: '选题从三处来',
    desc: '对标账号 TOP10 爆款拆解 + 高频客户问答 + 爆款续集，三路选题按你的内容支柱配比推荐。',
  },
  {
    no: '03',
    title: '像你、懂业务、可追溯',
    desc: '写新稿时按选题检索你的知识库，参考你自己写过的相关内容，每处参考都能点回原文；自动查重防选题撞车；一稿两个口播版本（抖音 / 视频号）按需生成，切换平台不加扣额度。',
  },
  {
    no: '04',
    title: '爆款变成下一条',
    desc: '登记视频地址，想看表现时点「复盘」抓真实数据，给该稿打上「爆款」标签，一键出续集选题。',
  },
];

/** 技术三卡，逐字取自原型 sections/04-技术.html。 */
const TECH = [
  {
    tags: ['DEEPSEEK', 'GLM'],
    title: '多模型智能调度',
    desc: '创作、拆解、归因分别调用最合适的国产大模型，兼顾中文口语质感与成本——口播稿不带「翻译腔」。',
  },
  {
    tags: ['RAG', '知识库'],
    title: '个人知识库检索增强',
    desc: '你的定位档案加上写过的口播文案组成「账号大脑」，生成时按选题整篇检索注入——参考可追溯，越写越像你。',
  },
  {
    tags: ['AGENT', 'SKILL'],
    title: '智能体 Skill 工作流',
    desc: '定位访谈、TOP20 账号拆解、爆款归因封装成持续更新的 Skill，新玩法上线即可用，无需等版本更新。',
  },
];

/** 价格三卡，逐字取自原型 sections/05-价格-+-CTA.html。 */
const PLANS = [
  { label: '体验', price: '免费', note: '首充送 10 条', featured: false },
  { label: '150 条文案', price: '¥129', note: '约 ¥0.86/条', featured: true },
  { label: '拆账号', price: '10 条额度', note: 'TOP20 视频全拆解', featured: false },
];

export default function Landing() {
  return (
    <div className="h-screen overflow-y-auto bg-paper-base text-paper-ink">
      {/* 顶栏：原型为 sticky + 半透明底 + 10px 模糊 */}
      <header className="sticky top-0 z-10 border-b border-paper-line bg-paper-base/[0.92] backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-[1120px] items-center px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="font-serif text-[22px] font-black tracking-label">随口说</span>
          </div>
          <nav className="ml-auto flex items-center gap-[26px] text-body">
            <a href="#landing-features" className="text-paper-inkSoft hover:text-paper-primary">
              功能
            </a>
            <a href="#landing-tech" className="text-paper-inkSoft hover:text-paper-primary">
              技术
            </a>
            <a href="#landing-price" className="text-paper-inkSoft hover:text-paper-primary">
              价格
            </a>
            <Link
              to="/login"
              className="rounded-card border border-[#c9c2ae] px-[22px] py-2.5 text-body text-paper-ink hover:border-paper-primary hover:text-paper-primary"
            >
              登录 / 注册
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1120px] px-6 pb-[72px] pt-[88px] text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-10 h-[340px] w-[640px] -translate-x-1/2"
          style={{
            background: 'radial-gradient(ellipse, rgba(138,90,43,0.10), transparent 70%)',
          }}
        />
        <div className="relative mb-[26px] inline-flex items-center gap-2 rounded-badge border border-paper-goldPale bg-paper-tint px-[18px] py-[7px] text-caption text-paper-primary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-paper-primary" />
          面向口播博主与获客老板的 AI 内容工作台
        </div>
        <h1 className="relative mb-5 font-serif text-display font-black">
          让每条口播稿
          <br />
          都像<span className="text-paper-primary">你本人</span>写的
        </h1>
        <p className="relative mx-auto mb-9 max-w-[560px] text-[16px] leading-loose text-paper-inkSoft">
          不是又一个 AI 写作工具。「随口说」记住你的人设、口吻和业务知识，从账号定位到选题、创作、发布复盘，全流程陪你把号做起来。
        </p>
        <div className="relative mb-4 flex justify-center gap-3.5">
          <Link
            to="/login"
            className="rounded-panel bg-paper-primary px-10 py-4 text-[16px] font-bold text-white shadow-primary hover:bg-paper-primaryHover hover:text-white"
          >
            免费开始 · 手机号登录
          </Link>
        </div>
        <p className="text-caption text-paper-mutedLight">首次开通送 10 条体验额度 · 无需下载</p>
      </section>

      {/* 四环节 */}
      <section id="landing-features" className="mx-auto max-w-[1120px] px-6 pb-[72px]">
        <div className="mb-[30px] flex items-baseline gap-4">
          <h2 className="font-serif text-[30px] font-black">四个环节，一条闭环</h2>
          <p className="text-body text-paper-muted">每个环节的产出都喂给下一个环节，越用越懂你</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {STAGES.map((s) => (
            <article
              key={s.no}
              className="rounded-soft border border-paper-line bg-paper-card p-6 transition-colors hover:border-paper-primary"
            >
              <div className="mb-3 font-serif text-[30px] font-black text-paper-primary">{s.no}</div>
              <h3 className="mb-2 font-sans text-[15px] font-bold">{s.title}</h3>
              <p className="text-caption leading-relaxed text-paper-inkSoft">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 技术：整段反白（暖炭底） */}
      <section
        id="landing-tech"
        className="border-y border-paper-coal bg-paper-ink text-paper-shadeDeep"
      >
        <div className="mx-auto max-w-[1120px] px-6 py-16">
          <div className="mb-[30px] flex items-baseline gap-4">
            <h2 className="font-serif text-[30px] font-black">底层用最新的模型与技术</h2>
            <p className="text-body text-paper-mutedFaint">
              按任务调度不同大模型，每个环节都用最擅长的那个
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TECH.map((t) => (
              <article
                key={t.title}
                className="rounded-soft border border-paper-coalLine2 bg-paper-coal p-6"
              >
                <div className="mb-3.5 flex gap-2">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[5px] border border-paper-coalLine bg-paper-ink px-2.5 py-1 text-hint font-bold tracking-caps text-paper-gold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="mb-2 font-sans text-[15px] font-bold">{t.title}</h3>
                <p className="text-caption leading-relaxed text-paper-mutedPale">{t.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 价格 + CTA */}
      <section id="landing-price" className="mx-auto max-w-[1120px] px-6 pb-20 pt-16 text-center">
        <h2 className="mb-2 font-serif text-[30px] font-black">按量付费，用多少买多少</h2>
        <p className="mb-8 text-body text-paper-muted">
          没有月费套路 · 加微信人工开通，工作时间 10 分钟内到账
        </p>
        <div className="mb-9 flex justify-center gap-3">
          {PLANS.map((p) => (
            <div
              key={p.label}
              className={
                p.featured
                  ? 'relative min-w-[175px] rounded-soft border-2 border-paper-primary bg-paper-tint px-[34px] py-[26px]'
                  : 'min-w-[175px] rounded-soft border border-paper-line bg-paper-card px-[34px] py-[26px]'
              }
            >
              {p.featured && (
                <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-panel bg-paper-primary px-3 py-[3px] text-hint font-bold text-white">
                  最多人选
                </span>
              )}
              <div className="mb-2 text-copy text-paper-muted">{p.label}</div>
              <div
                className={`font-serif text-[28px] font-black ${p.featured ? 'text-paper-primary' : ''}`}
              >
                {p.price}
              </div>
              <div className="mt-2 text-caption text-paper-inkSoft">{p.note}</div>
            </div>
          ))}
        </div>
        <Link
          to="/login"
          className="inline-block rounded-panel bg-paper-primary px-[46px] py-4 text-[16px] font-bold text-white shadow-primary hover:bg-paper-primaryHover hover:text-white"
        >
          现在开始 →
        </Link>
        <p className="mt-12 border-t border-paper-line pt-[22px] text-meta text-paper-mutedLight">
          随口说 · by 王不二 · 微信：suikoushuo-wang
        </p>
        <p className="mt-2 text-meta text-paper-mutedLight">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="text-paper-mutedLight hover:text-paper-mutedLight"
          >
            鲁ICP备2026038792号
          </a>
        </p>
      </section>
    </div>
  );
}
