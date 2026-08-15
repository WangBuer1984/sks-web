import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { type CardSummary, listCards } from '../api/kb';
import {
  type ScriptDetail,
  type ScriptSummary,
  createTopic,
  generateScript,
  listScripts,
} from '../api/script';
import CreateAside from './create/CreateAside';
import CreateInput from './create/CreateInput';
import CreateProgress from './create/CreateProgress';
import ScriptView from './create/ScriptView';

/**
 * C 端创作页 `/create`——对齐原型 `sections/13-文案创作.html`（B 混合）。
 *
 * <p>两条入参路径：
 * - 自由 textarea → createTopic → generateScript(topicId, platform, duration)
 * - `?topic=<id>` 深链（Topics/HomeNormal「生成文案」）→ 复用已有选题直接 generate，不造重复选题
 *
 * <p>时长真传后端控篇幅（Task 0 跨仓）；三平台 Tab 切换重生；查重接 dedupWarnScriptId；
 * genLoading 用多阶段进度动画（CLAUDE.md 硬不变量「无流式→多阶段进度动画 mask 等待」）。
 */
const PROGRESS_STAGES = ['检索知识库', '撰写中', '安全审核中'];

type Platform = 'douyin' | 'xhs' | 'gzh';
type Duration = '45' | '90' | '180';

export default function Create() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetTopicId = params.get('topic');
  // 仿写深链（拆视频「用这个框架仿写」）经 router state 携带：预填框架到输入框、**不自动生成**。
  // 与 `?topic=` 深链（选题库「生成文案」→ 复用已有选题直接生成）互斥：仿写用 state、无 query。
  const preset = useLocation().state as
    | { presetTopic?: string; presetRationale?: string; presetSource?: string }
    | null;

  const { data: history } = useQuery<ScriptSummary[]>({
    queryKey: ['scripts', 'draft'],
    queryFn: () => listScripts('draft'),
  });

  // script 必须在 bCards query 之前声明——bCards 的 enabled 引用它（否则 TDZ 崩页）。
  const [script, setScript] = useState<ScriptDetail | null>(null);
  const { data: bCards } = useQuery<CardSummary[]>({
    queryKey: ['kb-cards', 'B'],
    queryFn: () => listCards('B'),
    enabled: script != null && script.citedCardIds.length > 0,
  });

  const [genError, setGenError] = useState<string | null>(null);
  // 仿写预填：初始值取 router state 的 framework；无 state（自由进入/`?topic=` 深链）则为空。
  const [topic, setTopic] = useState(preset?.presetTopic ?? '');
  const [duration, setDuration] = useState<Duration>('45');
  const [platform, setPlatform] = useState<Platform>('douyin');
  const [stage, setStage] = useState(-1);
  // createTopic await 期间也禁用按钮——否则二次点击会再 createTopic+generate，双扣额度。
  const [submitting, setSubmitting] = useState(false);

  const genMut = useMutation({
    mutationFn: (vars: { topicId: number; platform?: Platform; duration?: Duration }) =>
      generateScript(vars.topicId, vars.platform, vars.duration),
    onMutate: () => {
      setGenError(null);
      setStage(0);
    },
    onSuccess: (s) => {
      setScript(s);
      setStage(-1);
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
    onError: (e: unknown) => {
      setStage(-1);
      setGenError(getBizMessage(e, '生成失败'));
    },
  });

  // 多阶段进度自动推进（每 7s，掩盖 30-60s 等待）
  useEffect(() => {
    if (stage < 0) return;
    const t = setTimeout(() => setStage((s) => (s + 1 < PROGRESS_STAGES.length ? s + 1 : s)), 7000);
    return () => clearTimeout(t);
  }, [stage]);

  // ?topic=<id> 深链：复用已有选题直接生成（不 createTopic）。ref 防 StrictMode 双调。
  const presetFiredRef = useRef(false);
  // 仿写携带的 benchmark 上下文：首次点「生成口播稿」时作 rationale 喂大模型
  // （framework+whyHot+diffHint），编辑后文字作 title。source='benchmark'。
  // 复用即消费；regenerate 走 script.topicId 不再碰这里。
  const presetRationaleRef = useRef(preset?.presetRationale ?? '');
  const presetSourceRef = useRef(preset?.presetSource);
  useEffect(() => {
    if (presetFiredRef.current) return;
    if (!presetTopicId) return;
    const tid = Number(presetTopicId);
    if (Number.isNaN(tid)) return;
    presetFiredRef.current = true;
    setScript(null);
    genMut.mutate({ topicId: tid, platform, duration });
    // 依赖只看 presetTopicId：深链值变才重跑，平台/时长切换不重跑（由 Tab/handleGenerate 走）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTopicId]);

  // 自由 textarea → createTopic → generateScript
  const handleGenerate = async () => {
    const t = topic.trim();
    if (!t || submitting || genMut.isPending) return;
    setScript(null);
    setGenError(null);
    setSubmitting(true);
    try {
      const topicId = await createTopic(t, presetRationaleRef.current, presetSourceRef.current);
      genMut.mutate({ topicId, platform, duration });
    } catch (e: unknown) {
      setGenError(getBizMessage(e, '创建选题失败'));
    } finally {
      setSubmitting(false);
    }
  };

  // 切平台 / 换个角度 → 用当前 script.topicId 重生
  const regenerate = (p: Platform = platform) => {
    if (!script) return;
    const topicId = script.topicId;
    setScript(null);
    genMut.mutate({ topicId, platform: p, duration });
  };

  const handleEdited = (s: ScriptDetail) => {
    setScript(s);
    queryClient.invalidateQueries({ queryKey: ['scripts'] });
  };

  const generating = submitting || genMut.isPending || stage >= 0;

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-5 font-serif text-title font-black text-paper-ink">文案创作</h1>
      <CreateInput
        topic={topic}
        onTopic={setTopic}
        duration={duration}
        onDuration={setDuration}
        onGenerate={handleGenerate}
        generating={generating}
      />

      {stage >= 0 && (
        <div className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-[30px] py-7.5">
          <ol className="flex flex-col gap-1.5">
            {PROGRESS_STAGES.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 text-body ${
                  i <= stage ? 'text-paper-primary' : 'text-paper-muted'
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    i <= stage ? 'bg-paper-primary' : 'bg-paper-line'
                  }`}
                />
                {label}
                {i === stage && <span className="ml-1 animate-pulse text-hint">…</span>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-center text-caption text-paper-muted">
            约 30-60 秒，完成后整稿一次呈现
          </p>
        </div>
      )}
      <CreateProgress error={genError} />

      {!script && !generating && (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body text-paper-mutedLight">
          输入选题后点击「生成口播稿」，AI 会结合你的账号档案和知识库卡片来写
        </div>
      )}
      {script && (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_280px]">
          <ScriptView
            script={script}
            bCards={bCards ?? []}
            platform={platform}
            onPlatform={(p) => {
              setPlatform(p);
              regenerate(p);
            }}
            onAdopt={() => navigate('/review')}
            onRegenerate={() => regenerate()}
            onEdited={handleEdited}
          />
          <CreateAside script={script} bCards={bCards ?? []} history={history ?? []} />
        </div>
      )}
    </div>
  );
}
