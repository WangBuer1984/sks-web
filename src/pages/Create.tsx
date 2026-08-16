import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  getContent,
  updateContentInPlace,
  type ContentDetail,
  type ContentReferenceView,
  type Platform,
} from '../api/content';
import { adoptScript } from '../api/review';
import {
  type GenerationView,
  type ScriptDetail,
  createTopic,
  generateGroupVersion,
  generateScript,
  getScript,
} from '../api/script';
import CreateAside from './create/CreateAside';
import CreateInput from './create/CreateInput';
import CreateProgress from './create/CreateProgress';
import ScriptView from './create/ScriptView';
import VoicePanel from './create/VoicePanel';
import { flattenScriptMarkdown, versionForPlatform } from './createMode';

const PROGRESS_STAGES = ['检索知识库', '撰写中', '安全审核中'];

type Duration = '45' | '90' | '180' | '300';

export default function Create() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const presetTopicId = params.get('topic');
  const contentIdParam = params.get('content');
  const preset = useLocation().state as
    | { presetTopic?: string; presetRationale?: string; presetSource?: string; presetFramework?: string }
    | null;

  const [groupId, setGroupId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ScriptDetail[]>([]);
  const [citedContents, setCitedContents] = useState<ContentReferenceView[]>([]);
  const [dedupWarn, setDedupWarn] = useState<number | null>(null);
  const [adopted, setAdopted] = useState<Record<number, number>>({});
  const [editingContent, setEditingContent] = useState<ContentDetail | null>(null);

  const [genError, setGenError] = useState<string | null>(null);
  const [topic, setTopic] = useState(preset?.presetTopic ?? '');
  const [duration, setDuration] = useState<Duration>('45');
  const [platform, setPlatform] = useState<Platform>('douyin');
  const [stage, setStage] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [lazyLoading, setLazyLoading] = useState(false);
  const [lazyHint, setLazyHint] = useState<string | null>(null);

  const applyView = (v: GenerationView) => {
    setGroupId(v.groupId);
    setVersions(v.versions);
    setCitedContents(v.citedContents ?? []);
    setDedupWarn(v.dedupWarnScriptId);
    const first = versionForPlatform(v.versions, platform) ?? v.versions[0];
    if (first) setPlatform(first.platform as Platform);
  };

  const genMut = useMutation({
    mutationFn: (vars: { topicId: number; platform?: Platform; duration?: Duration; framework?: string }) =>
      generateScript(vars.topicId, vars.platform, vars.duration, vars.framework),
    onMutate: () => {
      setGenError(null);
      setStage(0);
    },
    onSuccess: (v) => {
      applyView(v);
      setStage(-1);
      void queryClient.invalidateQueries({ queryKey: ['scripts'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      setStage(-1);
      setGenError(getBizMessage(e, '生成失败'));
    },
  });

  useEffect(() => {
    if (stage < 0) return;
    const t = setTimeout(() => setStage((s) => (s + 1 < PROGRESS_STAGES.length ? s + 1 : s)), 7000);
    return () => clearTimeout(t);
  }, [stage]);

  const presetFiredRef = useRef(false);
  const presetRationaleRef = useRef(preset?.presetRationale ?? '');
  const presetSourceRef = useRef(preset?.presetSource);
  const presetFrameworkRef = useRef(preset?.presetFramework ?? '');
  useEffect(() => {
    if (presetFiredRef.current) return;
    if (!presetTopicId) return;
    const tid = Number(presetTopicId);
    if (Number.isNaN(tid)) return;
    presetFiredRef.current = true;
    setVersions([]);
    genMut.mutate({
      topicId: tid,
      platform,
      duration,
      framework: presetFrameworkRef.current || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTopicId]);

  const contentFiredRef = useRef(false);
  useEffect(() => {
    if (contentFiredRef.current) return;
    const cid = Number(contentIdParam);
    if (!contentIdParam || Number.isNaN(cid)) return;
    contentFiredRef.current = true;
    void (async () => {
      try {
        const c = await getContent(cid);
        setEditingContent(c);
        if (c.scriptId) {
          const s = await getScript(c.scriptId);
          setVersions([s]);
          setGroupId(c.generationGroupId);
          setPlatform((c.platform as Platform) ?? 'douyin');
          setAdopted({ [s.id]: c.id });
        }
      } catch (e: unknown) {
        setGenError(getBizMessage(e, '打开内容失败'));
      }
    })();
  }, [contentIdParam]);

  const handleGenerate = async () => {
    const t = topic.trim();
    if (!t || submitting || genMut.isPending) return;
    setVersions([]);
    setGenError(null);
    setSubmitting(true);
    try {
      const topicId = await createTopic(t, presetRationaleRef.current, presetSourceRef.current);
      genMut.mutate({
        topicId,
        platform,
        duration,
        framework: presetFrameworkRef.current || undefined,
      });
    } catch (e: unknown) {
      setGenError(getBizMessage(e, '创建选题失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const current = versionForPlatform(versions, platform) ?? null;
  const missingChannels = !versionForPlatform(versions, 'channels');

  const switchPlatform = async (p: Platform) => {
    setPlatform(p);
    setLazyHint(null);
    if (p === 'channels' && missingChannels && groupId != null) {
      setLazyLoading(true);
      setLazyHint('视频号版将懒生成，不另扣额度。');
      try {
        const s = await generateGroupVersion(groupId, 'channels');
        setVersions((prev) => [...prev.filter((v) => v.platform !== 'channels'), s]);
        setLazyHint('视频号版刚生成 · 不另扣额度');
      } catch (e: unknown) {
        setGenError(getBizMessage(e, '视频号版生成失败，可重试'));
      } finally {
        setLazyLoading(false);
      }
    }
  };

  const regenerate = () => {
    const sid = current ?? versions[0];
    if (!sid) return;
    setEditingContent(null);
    setVersions([]);
    genMut.mutate({
      topicId: sid.topicId,
      platform,
      duration,
      framework: presetFrameworkRef.current || undefined,
    });
  };

  const saveKbMut = useMutation({
    mutationFn: async () => {
      if (!editingContent || !current) throw new Error('没有可保存的内容');
      return updateContentInPlace(
        editingContent.id,
        editingContent.title,
        flattenScriptMarkdown(current),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contents'] });
    },
    onError: (e: unknown) => setGenError(getBizMessage(e, '保存失败')),
  });

  const handleEdited = (s: ScriptDetail) => {
    setVersions((prev) => prev.map((v) => (v.id === s.id ? s : v)));
    void queryClient.invalidateQueries({ queryKey: ['scripts'] });
    const cid = adopted[s.id] ?? editingContent?.id;
    if (cid) {
      void updateContentInPlace(
        cid,
        editingContent?.title ?? '未命名内容',
        flattenScriptMarkdown(s),
      ).then(() => queryClient.invalidateQueries({ queryKey: ['contents'] }));
    }
  };

  const adoptMut = useMutation({
    mutationFn: (id: number) => adoptScript(id),
    onSuccess: (r, id) => {
      setAdopted((p) => ({ ...p, [id]: r.contentId }));
      void queryClient.invalidateQueries({ queryKey: ['contents'] });
      void queryClient.invalidateQueries({ queryKey: ['review'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => setGenError(getBizMessage(e, '采用失败')),
  });

  const generating = submitting || genMut.isPending || stage >= 0;
  const shown = current
    ? { ...current, dedupWarnScriptId: current.id === versions[0]?.id ? dedupWarn : current.dedupWarnScriptId }
    : null;

  const adoptedCurrent = shown ? adopted[shown.id] != null : false;

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-5 font-serif text-title font-black text-paper-ink">文案创作</h1>
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1fr_280px]">
        <div>
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
                约 30-60 秒，完成后整稿一次呈现 · 一次额度含抖音与视频号两个独立版本
              </p>
            </div>
          )}
          <CreateProgress error={genError} />

          {!shown && !generating && !lazyLoading && (
            <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body text-paper-mutedLight">
              输入选题后点击「生成口播稿」，AI 会结合你的定位档案和知识库里相关的内容来写
            </div>
          )}
          {(shown || lazyLoading) && (
            <>
              <ScriptView
                script={shown}
                platform={platform}
                missingChannels={missingChannels}
                lazyLoading={lazyLoading}
                lazyHint={lazyHint}
                adopted={adoptedCurrent}
                editingKb={editingContent != null}
                onPlatform={(p) => void switchPlatform(p)}
                onAdopt={() => shown && adoptMut.mutate(shown.id)}
                onSaveKb={() => saveKbMut.mutate()}
                onRegenerate={regenerate}
                onEdited={handleEdited}
              />
              {adoptedCurrent && !editingContent && (
                <div className="mt-[18px] flex items-center gap-3.5 rounded-card border border-paper-goldPale border-l-[3px] border-l-paper-primary bg-paper-tint px-4 py-3">
                  <div className="flex-1 text-copy leading-normal text-paper-ink">
                    <strong>拍完发布后，把视频链接贴回来</strong>
                    ——之后在「发布复盘」点「复盘」，才能拿真实数据、归因爆点。
                  </div>
                  <Link
                    to="/review"
                    className="whitespace-nowrap rounded-chip bg-paper-primary px-4 py-2 text-copy text-white hover:bg-paper-primaryHover hover:text-white"
                  >
                    去登记
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
        <div className="sticky top-2 flex flex-col gap-3">
          <VoicePanel generated={!!shown} />
          <CreateAside citedContents={citedContents} generated={!!shown} platform={platform} />
        </div>
      </div>
    </div>
  );
}
