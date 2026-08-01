import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getActiveProfile, type ActiveProfileView } from '../api/profile';

/**
 * 账号定位 `/positioning`——对齐原型「账号定位」段
 * （`prototypes/extracted/sections/11-账号定位.html`，条件 `{{ isPos }}`）。
 *
 * <p>两态：未校准 → 三步引导 + 开始校准；已校准 → 四张档案卡 + 内容支柱配比。
 *
 * <p>档案 `content` 是 Python summarize 产出的 JSONB，键为**中文**
 * （`人设 / 人群 / 差异化 / 变现 / 红线 / 支柱配比`）。prompt 迭代频繁，后端整体透传，
 * 故这里按键读取并对缺键降级显示，而不是假定结构齐全。
 */

/** 原型四张卡 → 档案键。原型标题「转化路径」对应档案里的 `变现`。 */
const CARDS: { title: string; key: string }[] = [
  { title: '人设', key: '人设' },
  { title: '目标人群', key: '人群' },
  { title: '差异化', key: '差异化' },
  { title: '转化路径', key: '变现' },
];

/** 把档案里任意形状的值渲染成一行文本——LLM 可能给字符串、数组或对象。 */
function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}：${asText(val)}`)
      .join('；');
  }
  return String(v);
}

/** 支柱条形色。原型四条依次是强调棕/金/绿/蓝。 */
const PILLAR_BAR = ['bg-paper-primary', 'bg-paper-gold', 'bg-paper-success', 'bg-paper-info'];

/**
 * 解析「支柱配比」。契约（sks-ai SUMMARIZE_SCHEMA）现在是 `[{名称, 占比}]`，占比为整数百分比。
 *
 * 但**改 schema 之前校准的档案存的是字符串**（如 `4:2:2:2`，无支柱名称），这些行还在库里；
 * 字符串没有名称就画不出带名字的配比条，故返回 null 让调用方回退到纯文本呈现。
 */
function parsePillars(v: unknown): { name: string; pct: number }[] | null {
  if (!Array.isArray(v)) return null;
  const parsed = v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const pct = typeof o['占比'] === 'number' ? o['占比'] : Number(o['占比']);
      return { name: String(o['名称'] ?? '').trim(), pct };
    })
    .filter((p) => p.name && Number.isFinite(p.pct));
  return parsed.length > 0 ? parsed : null;
}

export default function Positioning() {
  const { data, isLoading, error } = useQuery<ActiveProfileView>({
    queryKey: ['profile'],
    queryFn: getActiveProfile,
  });

  const content = data?.content ?? {};
  const rawPillars = content['支柱配比'];
  const pillars = parsePillars(rawPillars);
  const pillarsText = asText(rawPillars);
  const redline = asText(content['红线']);

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-1 font-serif text-title font-black">账号定位</h1>
      <p className="mb-5 text-lead text-paper-muted">
        这份定位档案是所有智能体的公共上下文——选题、创作、拆解都基于它工作
      </p>

      {isLoading ? (
        <p className="text-copy text-paper-muted">加载中…</p>
      ) : error ? (
        <p className="text-copy text-paper-danger">定位档案加载失败，请刷新重试。</p>
      ) : !data?.calibrated ? (
        <div className="rounded-block border border-paper-line bg-paper-card px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[20px] font-black">你的账号还没有定位档案</p>
          <p className="mb-[26px] text-lead leading-[1.8] text-paper-muted">
            没有定位档案，AI 只能写出「谁都能用」的通用文案
            <br />
            花 15 分钟聊一次，之后每条稿子都像你本人写的
          </p>
          <div className="mx-auto mb-7 grid max-w-[640px] grid-cols-3 gap-3 text-caption">
            {[
              ['① 贴个链接', '主页/过往文案任意一样，AI 先猜一版你的人设'],
              ['② 聊几个问题', '像访谈一样一问一答，支持语音，大白话即可'],
              ['③ 立刻见效', '当场对比「有/无定位」两版文案的差别'],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-panel border border-paper-tintDeep bg-paper-sunken p-3.5 text-left"
              >
                <div className="mb-1 font-bold">{t}</div>
                <div className="leading-normal text-paper-muted">{d}</div>
              </div>
            ))}
          </div>
          <Link
            to="/calibrate"
            className="inline-block rounded-card bg-paper-primary px-10 py-3.5 text-[15px] text-white hover:bg-paper-primaryHover hover:text-white"
          >
            开始定位校准
          </Link>
          <p className="mt-3 text-meta text-paper-mutedLight">
            约 15 分钟 · 不消耗额度 · 随时可以重新校准
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_340px] gap-[18px]">
          <div className="flex flex-col gap-3.5">
            <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="font-sans text-copy font-bold">定位档案</h2>
                <span className="text-hint text-paper-success">
                  ✓ 已校准
                  {data.version ? ` · 第 ${data.version} 版` : ''}
                  {data.calibratedAt
                    ? ` · ${new Date(data.calibratedAt).toLocaleDateString()}`
                    : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-copy">
                {CARDS.map((c) => {
                  const text = asText(content[c.key]);
                  return (
                    <div
                      key={c.key}
                      className="rounded-card border border-paper-tintDeep bg-paper-sunken px-3.5 py-3"
                    >
                      <div className="mb-1 text-hint font-bold text-paper-primary">{c.title}</div>
                      <div className="leading-normal">
                        {text || <span className="text-paper-mutedLight">档案里没有这一项</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {redline && (
                <div className="mt-3 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-3 text-copy">
                  <div className="mb-1 text-hint font-bold text-paper-danger">表达红线</div>
                  <div className="leading-normal">{redline}</div>
                </div>
              )}
            </section>

            <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
              <h2 className="mb-3 font-sans text-copy font-bold">
                内容支柱
                <span className="ml-2 text-hint font-normal text-paper-muted">
                  选题库目前按支柱分组排序，尚未按配比加权
                </span>
              </h2>
              {pillars ? (
                <div className="flex flex-col gap-2.5 text-copy">
                  {pillars.map((p, i) => (
                    <div
                      key={p.name}
                      className="grid grid-cols-[110px_1fr_40px] items-center gap-3"
                    >
                      <span>{p.name}</span>
                      <div className="h-2 rounded-[4px] bg-paper-shade">
                        <div
                          className={`h-2 rounded-[4px] ${PILLAR_BAR[i % PILLAR_BAR.length]}`}
                          style={{ width: `${Math.min(100, Math.max(0, p.pct))}%` }}
                        />
                      </div>
                      <span className="text-meta text-paper-muted">{p.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : pillarsText ? (
                // 旧档案：配比是无名称的字符串（如 4:2:2:2），画不出带名字的条，如实显示原文
                <>
                  <p className="rounded-card border border-paper-tintDeep bg-paper-sunken px-3.5 py-3 text-copy leading-normal">
                    {pillarsText}
                  </p>
                  <p className="mt-2 text-hint text-paper-mutedLight">
                    这份档案的配比是旧格式（只有比例、没有支柱名称）。重新校准后会显示分项配比条。
                  </p>
                </>
              ) : (
                <p className="text-caption text-paper-mutedLight">
                  档案里没有支柱配比——重新校准可以补上。
                </p>
              )}
            </section>
          </div>

          <aside className="flex flex-col rounded-block border border-paper-line bg-paper-card p-5">
            <h2 className="mb-1 font-sans text-copy font-bold">重新校准</h2>
            <p className="mb-3.5 text-[11.5px] text-paper-muted">
              这份档案是你聊出来的，随时可以重聊——旧版本会留档，不会丢。
            </p>
            {/* 原型此处展示了一段建库引导对话回放；访谈记录留在 Python 的 checkpoint 里、
                后端未提供历史对话读取端点，故不造假数据，只保留重新校准入口。 */}
            <p className="flex-1 text-caption leading-normal text-paper-mutedLight">
              校准过程中的问答目前不做回放——访谈状态存在 AI 侧的 checkpoint，后端还没有开放历史对话的读取端点。
            </p>
            <Link
              to="/calibrate"
              className="mt-3.5 rounded-card border border-paper-primary py-2.5 text-center text-copy text-paper-primary hover:bg-paper-tint"
            >
              重新校准定位
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
