import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { fetchMe } from '../api/auth';
import { getBizMessage } from '../api/client';
import { listContents, type ContentSummary } from '../api/content';
import { getActiveProfile } from '../api/profile';
import { type Topic, listTopics } from '../api/topic';
import HomeNew from './workbench/HomeNew';
import HomeNormal from './workbench/HomeNormal';
import {
  countAdoptedThisWeek,
  deriveHomeMode,
  homeGreeting,
  homeSub,
  weekStart,
} from './workbench/homeMode';

/**
 * C 端工作台 `/workbench`——对齐原型 `08-工作台.html`（`{{ isHome }}`）。
 *
 * 双态：`homeNew`（未校准→三步引导）与 `homeNormal`（已校准→三数字 + 选题建议）互斥，
 * 由 `deriveHomeMode(profile.calibrated)` 决定。额度余额改由侧边栏展示，本页不再做大号余额卡
 * 与 ad-hoc 导航条；退出登录只留侧边栏入口。
 *
 * 组合已有 API（`/me`、`/profile`、`/topics`、`/kb/contents`），不新增后端。
 * homeNew 只依赖 me/profile；homeNormal 等 topics/contents settled 再渲染。
 */
export default function Workbench() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: getActiveProfile });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() });
  const contentsQ = useQuery({ queryKey: ['contents'], queryFn: () => listContents() });

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
        <HomeNormalBody topicsQ={topicsQ} contentsQ={contentsQ} />
      )}
    </div>
  );
}

/** homeNormal 专用：三路辅助查询必须 settled；失败与真·空库分开。 */
function HomeNormalBody({
  topicsQ,
  contentsQ,
}: {
  topicsQ: UseQueryResult<Topic[], Error>;
  contentsQ: UseQueryResult<ContentSummary[], Error>;
}) {
  const pending = topicsQ.isPending || contentsQ.isPending;
  if (pending) {
    return <p className="text-copy text-paper-muted">加载工作台数据…</p>;
  }

  const firstError = topicsQ.error ?? contentsQ.error;
  if (firstError) {
    return (
      <p className="text-copy text-paper-danger">
        工作台数据加载失败：{getBizMessage(firstError)}。请刷新重试。
      </p>
    );
  }

  const contents = contentsQ.data ?? [];
  const topics = topicsQ.data ?? [];
  const since = weekStart(new Date());

  return (
    <HomeNormal
      contentCount={contents.length}
      topicCount={topics.filter((t) => t.status === 'open').length}
      adoptedThisWeek={countAdoptedThisWeek(contents, since)}
      topics={topics}
    />
  );
}
