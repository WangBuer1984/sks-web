import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../api/auth';
import { getBizMessage } from '../api/client';
import { listCards } from '../api/kb';
import { getActiveProfile } from '../api/profile';
import { listScripts } from '../api/script';
import { listTopics } from '../api/topic';
import HomeNew from './workbench/HomeNew';
import HomeNormal from './workbench/HomeNormal';
import {
  adoptRate,
  countSince,
  deriveHomeMode,
  homeGreeting,
  homeSub,
  weekStart,
} from './workbench/homeMode';

/**
 * C 端工作台 `/workbench`——对齐原型 `08-工作台.html`（`{{ isHome }}`）。
 *
 * 双态：`homeNew`（未校准→三步引导）与 `homeNormal`（已校准→指标 + 今日选题）互斥，
 * 由 `deriveHomeMode(profile.calibrated)` 决定。额度余额改由侧边栏展示，本页不再做大号余额卡
 * 与 ad-hoc 导航条；退出登录只留侧边栏入口。
 *
 * 组合已有 API（`/me`、`/profile`、`/topics`、`/kb/cards`、`/scripts`），不新增后端。
 * topics/cards/scripts 失败降级为空数组，不整页打爆；me/profile 失败才进 error 态。
 * 知识空白条无后端信号，本期不渲染（见 PROTOTYPE_GAP）。
 */
export default function Workbench() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: getActiveProfile });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() });
  const cardsQ = useQuery({ queryKey: ['kb-cards'], queryFn: () => listCards() });
  const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: () => listScripts() });

  const loading = meQ.isLoading || profileQ.isLoading;
  const error = meQ.error ?? profileQ.error;

  if (loading) {
    return <p className="text-copy text-paper-muted">加载中…</p>;
  }
  if (error) {
    return <p className="text-copy text-paper-danger">加载失败：{getBizMessage(error)}</p>;
  }

  const balance = meQ.data?.balance ?? 0;
  const mode = deriveHomeMode(profileQ.data?.calibrated ?? false);
  const since = weekStart(new Date());

  const cards = cardsQ.data ?? [];
  const scripts = scriptsQ.data ?? [];
  const topics = topicsQ.data ?? [];

  const cardsUpdatedThisWeek = countSince(
    cards.map((c) => c.updatedAt),
    since,
  );
  const scriptsThisWeek = countSince(
    scripts.map((s) => s.createdAt),
    since,
  );
  const { pct, sample } = adoptRate(scripts.map((s) => s.reviewState));

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="mb-1 font-serif text-title font-black text-paper-ink">
        {homeGreeting(meQ.data?.nickname, new Date())}
      </h1>
      <p className="mb-[26px] text-lead text-paper-muted">{homeSub(mode, balance)}</p>
      {mode === 'new' ? (
        <HomeNew balance={balance} />
      ) : (
        <HomeNormal
          cardCount={cards.length}
          cardsUpdatedThisWeek={cardsUpdatedThisWeek}
          scriptsThisWeek={scriptsThisWeek}
          adoptPct={pct}
          adoptSample={sample}
          topics={topics}
        />
      )}
    </div>
  );
}
