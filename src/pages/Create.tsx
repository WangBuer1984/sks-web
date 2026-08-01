import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * <p>结构：自由 textarea + 时长芯片 + 生成（CreateInput）→ 单行 pulse（genLoading）→
 * 三平台 Tab + 查重条 + 逐句编辑 + 采纳/换个角度/复制（ScriptView）+ 引用卡 + 历史稿件
 * （CreateAside）。逐句编辑/换个说法保留真 API（editSentence/rewriteSentence）。
 *
 * <p>输入模型：自由 textarea → createTopic → generateScript(topicId, platform, duration)。
 * 时长真传后端控篇幅（Task 0 跨仓）。三平台 Tab 切换 = 按平台重生。查重接 dedupWarnScriptId。
 */
type Platform = 'douyin' | 'xhs' | 'gzh';
type Duration = '45' | '90' | '180';

export default function Create() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: history } = useQuery<ScriptSummary[]>({
    queryKey: ['scripts', 'draft'],
    queryFn: () => listScripts('draft'),
  });
  const { data: bCards } = useQuery<CardSummary[]>({
    queryKey: ['kb-cards', 'B'],
    queryFn: () => listCards('B'),
    enabled: script != null && script.citedCardIds.length > 0,
  });

  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<Duration>('45');
  const [platform, setPlatform] = useState<Platform>('douyin');

  const genMut = useMutation({
    mutationFn: (vars: { topicId: number; platform?: Platform; duration?: Duration }) =>
      generateScript(vars.topicId, vars.platform, vars.duration),
    onMutate: () => setGenError(null),
    onSuccess: (s) => {
      setScript(s);
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
    onError: (e: unknown) => setGenError(getBizMessage(e, '生成失败')),
  });

  // 自由 textarea → createTopic → generateScript(topicId, platform, duration)
  const handleGenerate = async () => {
    const t = topic.trim();
    if (!t || genMut.isPending) return;
    setScript(null);
    setGenError(null);
    try {
      const topicId = await createTopic(t, '');
      genMut.mutate({ topicId, platform, duration });
    } catch (e: unknown) {
      setGenError(getBizMessage(e, '创建选题失败'));
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

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-5 font-serif text-title font-black text-paper-ink">文案创作</h1>
      <CreateInput
        topic={topic}
        onTopic={setTopic}
        duration={duration}
        onDuration={setDuration}
        onGenerate={handleGenerate}
        generating={genMut.isPending}
      />

      {genMut.isPending && (
        <div className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-[30px] py-7.5 text-center">
          <p className="animate-pulse text-lead text-paper-primary">
            ① 检索知识库 → ② 撰写口播稿 → ③ 安全审核 · 约 30-60 秒，完成后整稿一次呈现
          </p>
        </div>
      )}
      <CreateProgress error={genError} />

      {!script && !genMut.isPending && (
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
