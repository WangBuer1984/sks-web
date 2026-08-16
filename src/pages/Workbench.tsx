import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { fetchMe } from '../api/auth';
import { getBizMessage } from '../api/client';
import { listContents, type ContentSummary } from '../api/content';
import { getActiveProfile } from '../api/profile';
import { type ScriptSummary, listScripts } from '../api/script';
import { type Topic, listTopics } from '../api/topic';
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
 * 组合已有 API（`/me`、`/profile`、`/topics`、`/kb/contents`、`/scripts`），不新增后端。
 * homeNew 只依赖 me/profile；homeNormal 等 topics/contents/scripts 全部 settled 再渲染。
 */
export default function Workbench() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: getActiveProfile });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() });
  const contentsQ = useQuery({ queryKey: ['contents'], queryFn: () => listContents() });
  const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: () => listScripts() });

  if (meQ.isLoading || profileQ.isLoading) {
    return <p className="text-copy text-paper-muted">加载中…</p>;
  }
  const gateError = meQ.error ?? profileQ.error;
  if (gateError) {
    return <p className="text-copy text-paper-danger">加载失败：{getBizMessage(gateError)}</p>;
  }

  const balance = meQ.data?.balance ?? 0;
  const mode = deriveHomeMode(profileQ.data?.calibrated ?? false);

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="mb-1 font-serif text-title font-black text-paper-ink">
        {homeGreeting(meQ.data?.nickname, new Date())}
      </h1>
      <p className="mb-[26px] text-lead text-paper-muted">{homeSub(mode, balance)}</p>
      {mode === 'new' ? (
        <HomeNew balance={balance} />
      ) : (
        <HomeNormalBody topicsQ={topicsQ} contentsQ={contentsQ} scriptsQ={scriptsQ} />
      )}
    </div>
  );
}

/** homeNormal 专用：三路辅助查询必须 settled；失败与真·空库分开。 */
function HomeNormalBody({
  topicsQ,
  contentsQ,
  scriptsQ,
}: {
  topicsQ: UseQueryResult<Topic[], Error>;
  contentsQ: UseQueryResult<ContentSummary[], Error>;
  scriptsQ: UseQueryResult<ScriptSummary[], Error>;
}) {
  const pending = topicsQ.isPending || contentsQ.isPending || scriptsQ.isPending;
  if (pending) {
    return <p className="text-copy text-paper-muted">加载工作台数据…</p>;
  }

  const firstError = topicsQ.error ?? contentsQ.error ?? scriptsQ.error;
  if (firstError) {
    return (
      <p className="text-copy text-paper-danger">
        工作台数据加载失败：{getBizMessage(firstError)}。请刷新重试。
      </p>
    );
  }

  const contents = contentsQ.data ?? [];
  const scripts = scriptsQ.data ?? [];
  const topics = topicsQ.data ?? [];
  const since = weekStart(new Date());
  const { pct, sample } = adoptRate(scripts.map((s) => s.reviewState));

  return (
    <HomeNormal
      contentCount={contents.length}
      contentsUpdatedThisWeek={countSince(
        contents.map((c) => c.updatedAt),
        since,
      )}
      scriptsThisWeek={countSince(
        scripts.map((s) => s.createdAt),
        since,
      )}
      adoptPct={pct}
      adoptSample={sample}
      topics={topics}
    />
  );
}
