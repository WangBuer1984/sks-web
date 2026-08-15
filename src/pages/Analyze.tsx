import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  analyzeAccount,
  analyzeVideoLink,
  analyzeVideoText,
  getAnalyzeTask,
  getBenchmarkVideo,
  getCosts,
  parseStructure,
  type TaskDetail,
  type VideoTextResponse,
} from '../api/analyze';
import { fetchMe, type MeResponse } from '../api/auth';
import { useAnalyzeTaskStore } from '../store/analyzeTask';
import AccountResult from './analyze/AccountResult';
import VideoResult from './analyze/VideoResult';
import VideoDetail from './analyze/VideoDetail';
import { routeVideoInput, validateLinkInput, videoDetailIdFromParam } from './analyze/helpers';

/**
 * C 端对标拆解 `/analyze`——对齐原型 `sections/14-对标拆解.html`（两 Tab：拆账号 / 拆视频）。
 *
 * <p>拆视频：同一 textarea，URL→link 异步，否则→text 同步。拆账号：异步轮询。
 * 结果区见 {@link AccountResult} / {@link VideoResult}。不硬编码演示结果。
 */
type Tab = 'account' | 'video';

const POLL_INTERVAL = 3000;

const ACCOUNT_SAMPLE_URL = 'https://www.douyin.com/user/';
const VIDEO_SAMPLE_TEXT =
  '师傅最怕你检查这四处——看完验收比监理还专业。第一处……评论区扣「验收」领完整清单。';

export default function Analyze() {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = videoDetailIdFromParam(searchParams.get('video'));
  // 详情态入场直接落拆视频 tab：初值即从 detailId 推导，
  // 免得首帧先画 account tab、effect 再纠正的一闪。
  const [tab, setTab] = useState<Tab>(detailId != null ? 'video' : 'account');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<VideoTextResponse | null>(null);
  // 粘文案流的原文：result 里没有（后端同步流不回传 transcript），用提交时的入参留一份。
  const [syncTranscript, setSyncTranscript] = useState<string | null>(null);
  // taskId 走 Zustand 持久化 store（localStorage），切走/刷新回来可恢复上次任务。
  const taskId = useAnalyzeTaskStore((s) => s.taskId);
  const pollRef = useRef(false);

  const textMut = useMutation({
    mutationFn: (transcript: string) => analyzeVideoText(transcript),
    onSuccess: (r, transcript) => {
      setError(null);
      setSyncResult(r);
      setSyncTranscript(transcript);
    },
    onError: (e: unknown) => {
      setSyncResult(null);
      setSyncTranscript(null);
      setError(getBizMessage(e, '拆解失败，请稍后重试'));
    },
  });

  const startMut = useMutation({
    mutationFn: async (vars: { url: string; kind: 'videoLink' | 'account' }) => {
      return vars.kind === 'videoLink'
        ? analyzeVideoLink(vars.url)
        : analyzeAccount(vars.url);
    },
    onSuccess: (r) => {
      setError(null);
      setSyncResult(null);
      setSyncTranscript(null);
      useAnalyzeTaskStore.getState().setTaskId(r.taskId);
      pollRef.current = true;
    },
    onError: (e: unknown) => {
      useAnalyzeTaskStore.getState().clear();
      setError(getBizMessage(e, '受理失败，请稍后重试'));
    },
  });

  const { data: costs } = useQuery({ queryKey: ['analyze-costs'], queryFn: getCosts });
  const { data: me } = useQuery<MeResponse>({ queryKey: ['me'], queryFn: fetchMe, staleTime: 30_000 });

  const { data: task, error: taskErr } = useQuery<TaskDetail>({
    queryKey: ['analyzeTask', taskId],
    queryFn: () => getAnalyzeTask(taskId as number),
    enabled: taskId !== null,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === 'done' || d.status === 'partial' || d.status === 'failed')) {
        return false;
      }
      return POLL_INTERVAL;
    },
  });

  // 恢复 fetch 彻底失败（任务被删/换号后旧 taskId 404、且从未拿到数据）→ 清掉，
  // 回到 idle；中途 500 有旧数据（!task 假）不清，保进度。
  useEffect(() => {
    if (taskErr && !task) {
      useAnalyzeTaskStore.getState().clear();
    }
  }, [taskErr, task]);

  // 恢复时自动切到任务所属 tab：默认 account tab 配 video 任务不渲染结果。
  // 仅 task.id 变化时同步，避免轮询/手切 tab 时 yank。
  // detailId 有意不进依赖：离开详情（清 ?video=）伴随的是用户手切 tab，
  // 若因 detailId 变化重跑，会把 tab 立刻拽回任务所属 tab，用户得点两次。
  useEffect(() => {
    if (detailId != null) return; // 详情态自己管 tab，不被上次任务类型覆盖
    if (task) {
      setTab(task.taskType === 'video' ? 'video' : 'account');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // 切走再切回 / tab 切回恢复：input 被重置为空后，用 task 的干净 url 回填，
  // 让用户看到正在拆解的地址。task.id 变化（新任务/恢复）或 tab 切回任务所属 tab
  // 时触发；轮询（task.id 不变）不重复覆盖用户手改；切到非任务所属 tab 不回填
  // （免得把 video 地址塞进 account 输入框）。
  useEffect(() => {
    if (detailId != null) return; // 详情态用 videoUrl 预填，不用上次任务的 url
    if (task?.url && !input && tabMatchesTask(tab, task.taskType)) {
      setInput(task.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, tab, detailId]);

  // 详情态（`?video=<id>`）：免费读已落库的明细，不建任务、不扣费。
  const { data: detail, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: ['benchmarkVideo', detailId],
    queryFn: () => getBenchmarkVideo(detailId as number),
    enabled: detailId != null,
    retry: false,
  });

  // 详情态挂在拆视频 tab 下：query 在场就强制切过去。
  useEffect(() => {
    if (detailId != null) {
      setTab('video');
    }
  }, [detailId]);

  // 输入框预填该条链接（spec D8）：视频号拿不到作品链接 → 留空，结果区照常。
  // 依赖 videoUrl 而非整个 detail：用户随后手改输入框不会被下一次 render 覆写。
  useEffect(() => {
    if (detailId != null) {
      setInput(detail?.videoUrl ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, detail?.videoUrl]);

  // 假进度 creep：提交后到首条 item 完成（real progress=0）期间，前端先假走，
  // 免得 0% 空窗让用户以为没启动。real>0（首条 item 完成≈10%）即交班真实值。
  // ceiling=8 < 首步 10，故 real 接管时不会回退。
  const realProgress = task?.progress ?? 0;
  const showFake = startMut.isPending || (taskId !== null && realProgress === 0);
  const [fakeProgress, setFakeProgress] = useState(0);
  useEffect(() => {
    if (!showFake) {
      setFakeProgress(0);
      return;
    }
    // 提交立即跳 2%（「立马动」），之后每 2s +1 封顶 8。
    setFakeProgress(2);
    const iv = setInterval(
      () => setFakeProgress((f) => (f >= 8 ? f : f + 1)),
      2000,
    );
    return () => clearInterval(iv);
  }, [showFake]);
  const displayProgress = realProgress > 0 ? realProgress : fakeProgress;

  const pending = textMut.isPending || startMut.isPending;
  const accountCost = costs?.account ?? 10;
  const videoCost = costs?.videoText ?? costs?.videoLink ?? 1;
  const balance = me?.balance ?? 0;
  const insufficient = tab === 'account' && balance < accountCost;

  const switchTab = (next: Tab) => {
    if (detailId != null) {
      const params = new URLSearchParams(searchParams);
      params.delete('video');
      setSearchParams(params, { replace: true });
    }
    // 切 tab 只重置输入区，不清 taskId：进行中/已完成的任务保留，
    // 切回原 tab 仍可恢复进度与地址（见下方 url-restore / tab-restore）。
    setTab(next);
    setInput('');
    setSyncResult(null);
    setSyncTranscript(null);
    setError(null);
  };

  const submit = () => {
    const text = input.trim();
    if (!text) {
      setError('请先输入内容');
      return;
    }
    setSyncResult(null);
    setSyncTranscript(null);
    if (detailId != null) {
      const params = new URLSearchParams(searchParams);
      params.delete('video');
      setSearchParams(params, { replace: true });
    }
    useAnalyzeTaskStore.getState().clear();
    setError(null);
    if (tab === 'account') {
      const v = validateLinkInput(text);
      if (!v.ok) {
        setError(v.message);
        return;
      }
      startMut.mutate({ url: v.url, kind: 'account' });
      return;
    }
    const route = routeVideoInput(text);
    if (route.kind === 'error') {
      setError(route.message);
      return;
    }
    if (route.kind === 'videoLink') {
      startMut.mutate({ url: route.url, kind: 'videoLink' });
    } else {
      textMut.mutate(route.text);
    }
  };

  // taskFetching：taskId 在但 task 尚未拿到（POST 返回后到首次轮询 / 切回恢复的 gap）。
  // 这段用假进度条占位，免空白；以前用「恢复中」文案块，但新提交也命中它、文案错。
  const taskFetching = taskId !== null && !task && !taskErr;

  const asyncRunning =
    task != null && (task.status === 'queued' || task.status === 'running');

  // 空态按任务类型判定：另一类型的进行中/已完成任务不抑制本 tab 的空态，
  // 用户可在该 tab 输入新建（提交时 submit 会清掉旧 taskId）。
  const showAccountIdle =
    detailId == null &&
    tab === 'account' &&
    !pending &&
    !taskFetching &&
    !(task && task.taskType === 'account') &&
    !error;
  const showVideoIdle =
    detailId == null &&
    tab === 'video' &&
    !pending &&
    !syncResult &&
    !taskFetching &&
    !(task && task.taskType === 'video') &&
    !error;

  const accountLoading =
    detailId == null &&
    tab === 'account' &&
    (pending || taskFetching || (asyncRunning && task?.taskType === 'account'));
  const videoLoading =
    detailId == null &&
    tab === 'video' && (pending || taskFetching || (asyncRunning && task?.taskType === 'video'));

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-1 font-serif text-title font-black text-paper-ink">对标拆解</h1>
      <p className="mb-4 text-lead text-paper-muted">
        拆账号看「它为什么值得抄、抄什么」，拆视频看「这条为什么火」
      </p>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex gap-2">
        {(
          [
            ['account', '拆账号'],
            ['video', '拆视频'],
          ] as [Tab, string][]
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={`rounded-card px-[22px] py-[9px] text-body transition ${
                on
                  ? 'border border-paper-primary bg-paper-primary font-bold text-white'
                  : 'border border-paper-lineStrong bg-paper-card font-normal text-paper-ink hover:border-paper-primary'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 输入区 */}
      {tab === 'account' ? (
        <section className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-6 py-[22px]">
          <div className="flex gap-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="粘贴抖音/视频号账号主页或分享文案，系统自动提取链接"
              className="min-w-0 flex-1 rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-3 text-lead text-paper-ink outline-none focus:border-paper-primary"
            />
            <button
              type="button"
              disabled={pending || !input.trim() || insufficient || asyncRunning}
              onClick={submit}
              className="shrink-0 whitespace-nowrap rounded-card bg-paper-primary px-7 py-[11px] text-lead font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? '受理中…' : '开始拆解'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className="text-meta text-paper-muted">试试示例：</span>
            <button
              type="button"
              onClick={() => setInput(ACCOUNT_SAMPLE_URL)}
              className="rounded-badge border border-dashed border-paper-goldSoft px-3.5 py-[5px] text-caption text-paper-primary hover:bg-paper-tint"
            >
              装修避坑老张 · 抖音 86w 粉
            </button>
            <span className="ml-auto text-meta text-paper-mutedLight">
              {insufficient
                ? `消耗 ${accountCost} 条文案额度 · 额度不够`
                : `消耗 ${accountCost} 条文案额度 · 抓取播放 TOP10 逐条拆解`}
            </span>
          </div>
          <p className="mt-2 text-hint text-paper-muted">
            可直接粘贴完整分享文案，系统自动提取链接。目前仅支持抖音、视频号。
          </p>
        </section>
      ) : (
        <section className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-6 py-[22px]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴抖音/视频号分享文案（自动提取链接），或直接粘口播文案（不限平台）"
            rows={3}
            className="w-full resize-none rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-3 text-lead leading-normal text-paper-ink outline-none focus:border-paper-primary"
          />
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <span className="text-meta text-paper-muted">试试示例：</span>
            <button
              type="button"
              onClick={() => setInput(VIDEO_SAMPLE_TEXT)}
              className="rounded-badge border border-dashed border-paper-goldSoft px-3.5 py-[5px] text-caption text-paper-primary hover:bg-paper-tint"
            >
              「装修避坑老张」验收爆款 · 文案示例
            </button>
            <button
              type="button"
              disabled={pending || !input.trim() || asyncRunning}
              onClick={submit}
              className="ml-auto rounded-card bg-paper-primary px-7 py-[11px] text-lead font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending ? 'AI 思考中…' : '开始拆解'}
            </button>
          </div>
          <p className="mt-2 text-hint text-paper-muted">
            识别为链接时走异步拆解（扣 {videoCost} 条）；粘贴文案则同步拆解（扣{' '}
            {costs?.videoText ?? 1} 条）。可先去别处稍后回来看结果。
          </p>
        </section>
      )}

      {/* Loading：进度条 + 原型 pulse 文案。进度用 displayProgress：real=0 时假走，免 0% 空窗。 */}
      {accountLoading ? (
        <LoadingBlock
          pulse={
            startMut.isPending
              ? `受理中：创建拆解任务… · ${displayProgress}%`
              : !task
                ? `正在加载任务状态… · ${displayProgress}%`
                : task?.status === 'queued'
                  ? `排队受理中：即将抓取 TOP10… · ${displayProgress}%`
                  : `已创建拆解任务：抓取 TOP10 → 逐条转写 → 归纳规律与迁移建议（约 5 分钟，可先去别处稍后回来） · ${displayProgress}%`
          }
          progress={displayProgress}
          showBar
        />
      ) : null}

      {videoLoading ? (
        <LoadingBlock
          pulse={
            textMut.isPending
              ? '拆解中：拆结构、归因爆点（贴文案约 1 分钟）…'
              : startMut.isPending
                ? `受理中：创建拆解任务… · ${displayProgress}%`
                : !task
                  ? `正在加载任务状态… · ${displayProgress}%`
                  : task?.status === 'queued'
                    ? `排队受理中… · ${displayProgress}%`
                    : `已创建拆解任务：下载音频 → 转写文案 → 拆结构、归因爆点（贴链接约 1 分钟，可先去别处稍后回来看结果） · ${displayProgress}%`
          }
          progress={displayProgress}
          showBar={!textMut.isPending}
        />
      ) : null}

      {/* 空态 */}
      {showAccountIdle ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body leading-relaxed text-paper-mutedLight">
          输入账号链接，AI 将抓取其播放量 TOP10 视频
          <br />
          逐条转写并留存完整文案与结构 → 归纳爆款规律 → 对照你的定位给出迁移建议（全程约 5
          分钟）
        </div>
      ) : null}

      {showVideoIdle ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body leading-relaxed text-paper-mutedLight">
          粘贴单条爆款链接或完整口播文案
          <br />
          AI 拆结构时间轴、爆点归因与可复用框架，并可一键跳转仿写
        </div>
      ) : null}

      {/* 同步视频结果 */}
      {detailId == null && tab === 'video' && syncResult && !videoLoading ? (
        <VideoResult
          structure={syncResult.structure}
          whyHot={syncResult.whyHot}
          framework={syncResult.framework}
          diffHint={syncResult.diffHint}
          imitateTitle={syncResult.framework?.slice(0, 40)}
          transcript={syncTranscript}
        />
      ) : null}

      {/* 异步任务终态 / 失败 */}
      {detailId == null && task && !asyncRunning && tabMatchesTask(tab, task.taskType) ? (
        <div className="mt-1">
          {task.status === 'failed' ? (
            <p className="mb-3 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger">
              拆解失败{task.error ? `：${task.error}` : ''}。已自动退款。可改用拆视频（粘链接 /
              粘文案）逐条拆解。
            </p>
          ) : null}

          {task.status === 'done' && task.taskType === 'video' && task.result ? (
            <VideoLinkDone resultJson={task.result} />
          ) : null}

          {(task.status === 'done' || task.status === 'partial') &&
          task.taskType === 'account' ? (
            <AccountResult resultJson={task.result} videos={task.videos} />
          ) : null}
        </div>
      ) : null}

      {detailId != null ? (
        detailLoading ? (
          <div className="rounded-block border border-paper-line bg-paper-card px-[30px] py-[30px] text-center">
            <div className="animate-pulse text-lead text-paper-primary">正在加载视频文案…</div>
          </div>
        ) : detailError || !detail ? (
          <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body text-paper-muted">
            该视频记录不存在或已删除
          </div>
        ) : (
          <VideoDetail data={detail} />
        )
      ) : null}
    </div>
  );
}

function tabMatchesTask(tab: Tab, taskType: string): boolean {
  if (tab === 'account') return taskType === 'account';
  return taskType === 'video';
}

function VideoLinkDone({ resultJson }: { resultJson: string }) {
  const r = parseStructure(resultJson);
  if (!r) {
    return <p className="text-copy text-paper-muted">结果解析失败。</p>;
  }
  return (
    <VideoResult
      structure={r.structure ?? ''}
      whyHot={r.why_hot ?? ''}
      framework={r.framework ?? ''}
      diffHint={r.diff_hint ?? ''}
      imitateTitle={r.framework?.slice(0, 40)}
      transcript={r.transcript ?? null}
    />
  );
}

function LoadingBlock({
  pulse,
  progress,
  showBar,
}: {
  pulse: string;
  progress?: number;
  showBar: boolean;
}) {
  return (
    <div className="rounded-block border border-paper-line bg-paper-card px-[30px] py-[30px] text-center">
      <div className="animate-pulse text-lead text-paper-primary">{pulse}</div>
      {showBar && progress != null ? (
        <div className="mx-auto mt-4 max-w-md">
          <div className="mb-1.5 flex justify-between text-meta text-paper-muted">
            <span>进度</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-badge bg-paper-shade">
            <div
              className="h-full rounded-badge bg-paper-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
