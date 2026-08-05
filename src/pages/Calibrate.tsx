import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  asrVoice,
  confirmProfile,
  interviewStep,
  sampleOpening,
  type InterviewStepView,
} from '../api/profile';
import { asText, extractProfileContent } from '../lib/profileText';
import { currentStep, shouldShowSampleBlock, storeTurns, type Phase, type SampleState } from './calibrateMode';

const SAMPLE_MATERIAL = `我叫王姐，在佛山做了12年全屋定制工厂。自家厂房自家工人，不外包。
专治装修怕被坑的业主——报价单每一项给你拆清楚，哪家贵在哪、哪家便宜在哪，
敢把真实价格摆出来。不诋毁同行，但不说假话。`;

interface Turn {
  role: 'ai' | 'user';
  text: string;
}

/** Step3 四宫格 → 档案键。原型「表达红线」对应档案 `红线`。 */
const CARDS: { title: string; key: string }[] = [
  { title: '人设', key: '人设' },
  { title: '目标人群', key: '人群' },
  { title: '差异化', key: '差异化' },
  { title: '表达红线', key: '红线' },
];

export default function Calibrate() {
  const navigate = useNavigate();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<Phase>('materials');
  const [materials, setMaterials] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string>('');
  const [asrPending, setAsrPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sampleData, setSampleData] = useState<SampleState | null>(null); // Task 4 接线前恒 null
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // turns 的同步镜像 ref（供 onSuccess 即时读 + done 快照），doneTurnsRef 首次进 done 时快照一次。
  // 防「再补充几句」幽灵 turn：/step 幂等忽略 done 后的 reply，但乐观追加的 user turn 会污染 _interview_turns 回放；
  // confirm 存 doneTurnsRef 快照（不含补充后加的 turn）。
  const turnsRef = useRef<Turn[]>([]);
  const doneTurnsRef = useRef<Turn[] | null>(null);

  const stepMut = useMutation({
    mutationFn: (vars: { reply?: string; materials?: string }) =>
      interviewStep(sessionId, vars.reply, vars.materials),
    onSuccess: (resp: InterviewStepView) => {
      setError(null);
      setBanner(resp.banner ?? '');
      if (resp.blocked) {
        setError('内容被安全拦截，请调整后重试');
        return;
      }
      if (resp.question) {
        turnsRef.current = [...turnsRef.current, { role: 'ai', text: resp.question as string }];
        setTurns(turnsRef.current);
      }
      if (resp.done) {
        setDraft(resp.profileDraft);
        setPhase('done');
        if (doneTurnsRef.current === null) {
          doneTurnsRef.current = turnsRef.current; // 首次进 done 快照（含本轮 AI 问，不含后续补充幽灵 turn）
        }
      } else if (resp.stage === 'await_feedback') {
        setPhase('await_feedback');
      } else if (resp.stage === 'ask') {
        setPhase('ask');
      } else if (resp.stage === 'summarize') {
        setPhase('summarize');
      }
    },
    onError: (e: unknown) => setError(getBizMessage(e, '访谈推进失败')),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmProfile(sessionId, storeTurns(doneTurnsRef.current, turnsRef.current)),
    onSuccess: () => {
      setError(null);
      navigate('/workbench');
    },
    onError: (e: unknown) => setError(getBizMessage(e, '生效失败')),
  });

  const sampleMut = useMutation({
    mutationFn: () => sampleOpening(sessionId),
    onSuccess: (resp) => setSampleData(resp),
    onError: () => setSampleData(null), // 静默失败：隐藏对比块，不阻断 confirm
  });

  // 进入 done 阶段触发样例开头（失败静默）
  useEffect(() => {
    if (phase === 'done') {
      sampleMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submitMaterials = () => {
    if (!materials.trim()) {
      // 允许空素材「直接聊」分支调到这里时 materials 已被清空校验跳过——见「没有素材，直接聊」按钮直接 mutate
      setError('请先粘贴素材（主页说明 / 过往文案 / 朋友圈长文）');
      return;
    }
    turnsRef.current = [];
    setTurns([]);
    doneTurnsRef.current = null;
    setPhase('ask');
    stepMut.mutate({ materials: materials.trim() });
  };

  const skipMaterials = () => {
    turnsRef.current = [];
    setTurns([]);
    doneTurnsRef.current = null;
    setPhase('ask');
    stepMut.mutate({ materials: null });
  };

  const submitReply = (reply?: string) => {
    const text = (reply ?? input).trim();
    if (!text) {
      setError('请输入回答');
      return;
    }
    turnsRef.current = [...turnsRef.current, { role: 'user', text }];
    setTurns(turnsRef.current);
    setInput('');
    setPhase('ask');
    stepMut.mutate({ reply: text });
  };

  // 语音：按住录音 → 松开 ASR → 回显可改（逻辑不变）
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          setRecording(false);
          return;
        }
        setAsrPending(true);
        try {
          const text = await asrVoice(blob);
          if (!text.trim()) {
            setError('没听清，请再说一次或改用文字输入');
          } else {
            setInput(text);
          }
        } catch (e) {
          setError('语音识别失败，请改用文字输入（不阻断访谈）');
        } finally {
          setAsrPending(false);
          setRecording(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError('无法访问麦克风，请改用文字输入');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
  };

  useEffect(() => {
    return () => stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = stepMut.isPending || confirmMut.isPending;
  const showQA = phase === 'await_feedback' || phase === 'ask' || phase === 'summarize';
  const step = currentStep(phase);
  const content = extractProfileContent(draft);

  return (
    <main className="mx-auto min-h-full max-w-3xl px-5 py-8">
      <header className="mb-[18px] flex items-center justify-between">
        <h1 className="font-serif text-title font-black text-paper-ink">校准定位</h1>
        <Link
          to="/workbench"
          className="text-copy text-paper-muted transition hover:text-paper-primary"
        >
          保存并退出
        </Link>
      </header>

      {/* 三步进度条 */}
      <div className="mb-[22px] flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-[5px] flex-1 rounded-[3px] ${
              i < step ? 'bg-paper-primary' : 'bg-paper-shade'
            }`}
          />
        ))}
      </div>

      {banner && (
        <p className="mb-4 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2 text-meta font-semibold text-paper-primary">
          {banner}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
        >
          {error}
        </div>
      )}

      {/* 第 1 步：贴素材 */}
      {phase === 'materials' && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[30px_32px]">
          <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">
            第 1 步 · 共 3 步 · 约 3 分钟
          </div>
          <h2 className="mb-1.5 text-[18px] font-bold text-paper-ink">先给我一点「你」的素材</h2>
          <p className="mb-[18px] text-body leading-relaxed text-paper-inkSoft">
            主页链接、过往视频文案、朋友圈长文，任意一样即可——AI 先猜一版你的人设，比让你填空快得多。没有素材也可以跳过，直接聊。
          </p>
          <textarea
            rows={4}
            placeholder="粘贴主页链接或一段你写过的文案…"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            className="mb-3 w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMaterials(SAMPLE_MATERIAL)}
              className="rounded-badge border border-dashed border-paper-goldSoft px-3.5 py-1.5 text-caption text-paper-primary transition hover:bg-paper-tint"
            >
              用示例：王姐的抖音主页
            </button>
            <div className="ml-auto flex gap-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={skipMaterials}
                className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                没有素材，直接聊
              </button>
              <button
                type="button"
                disabled={pending || !materials.trim()}
                onClick={submitMaterials}
                className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {stepMut.isPending ? 'AI 思考中…' : '开始校准'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 第 2 步：确认人设 + 问答 */}
      {showQA && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[26px_28px]">
          <div className="mb-3.5 text-meta font-bold tracking-wide text-paper-primary">
            第 2 步 · 确认并补充 · 约 8 分钟
          </div>

          {turns.length > 0 && (
            <div className="mb-[18px] flex flex-col gap-3">
              {turns.map((t, i) => (
                <div key={i}>
                  <div
                    className={`max-w-[94%] rounded-[10px_10px_10px_2px] px-4 py-3.5 text-body leading-relaxed ${
                      t.role === 'ai'
                        ? 'bg-paper-tint text-paper-ink'
                        : 'ml-auto bg-paper-ink text-paper-shadeDeep'
                    }`}
                  >
                    {t.text}
                  </div>
                  {/* await_feedback 阶段：最新 AI 气泡下挂确认/否认胶囊 */}
                  {t.role === 'ai' && phase === 'await_feedback' && i === turns.length - 1 && (
                    <div className="mt-2.5 flex gap-2 ml-auto">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => submitReply('基本对')}
                        className="rounded-badge border border-paper-primary bg-paper-tint px-4 py-2 text-copy text-paper-primary transition hover:bg-paper-tintDeep disabled:opacity-45"
                      >
                        基本对
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('calib-answer')?.focus()}
                        className="rounded-badge border border-paper-lineStrong px-4 py-2 text-copy text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
                      >
                        不太对，我来说
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {stepMut.isPending && (
            <p className="mb-3 text-copy text-paper-muted">AI 思考中…（约 30-60s）</p>
          )}

          <textarea
            id="calib-answer"
            rows={3}
            placeholder={asrPending ? '识别中…' : '打字或语音都行，大白话即可…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={asrPending}
            className="mb-3 w-full rounded-[10px_10px_3px_12px] border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary disabled:bg-paper-base"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || asrPending || !input.trim()}
              onClick={() => submitReply()}
              className="rounded-panel bg-paper-primary px-4 py-2 text-body font-bold text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              提交回答
            </button>
            <button
              type="button"
              disabled={pending || asrPending}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`rounded-panel border px-4 py-2 text-body font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                recording
                  ? 'border-paper-danger bg-paper-danger text-white'
                  : 'border-paper-lineStrong bg-paper-card text-paper-primary hover:bg-paper-tint'
              }`}
            >
              {recording ? '录音中…松开识别' : asrPending ? '识别中…' : '按住录音'}
            </button>
          </div>
          <p className="mt-2 text-caption text-paper-muted">
            语音回答先转出文字回显，可编辑后再提交；识别失败可改用文字输入，不阻断访谈。
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-paper-tintDeep pt-4">
            <p className="text-meta text-paper-mutedLight">
              正式版会连续问 5–8 个问题（人群、案例、口头禅…），原型演示只走一问
            </p>
            <button
              type="button"
              disabled={pending || asrPending || !input.trim()}
              onClick={() => submitReply()}
              className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              生成定位档案 →
            </button>
          </div>
        </section>
      )}

      {/* 第 3 步：档案确认 */}
      {phase === 'done' && draft && (
        <section className="rounded-block border border-paper-line bg-paper-card p-[26px_28px]">
          <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">
            第 3 步 · 你的定位档案
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2.5 text-body">
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

          {/* 试试效果对比块（Task 4 接线前 sampleData 恒 null → 不渲染） */}
          {shouldShowSampleBlock(sampleData) && (
            <div className="mb-[18px] rounded-card border-l-[3px] border-paper-primary bg-paper-tint px-4 py-3 text-caption leading-relaxed">
              试试效果：同一个选题「{sampleData!.topic}」——
              <br />
              <span className="text-paper-muted">无档案版开头：「{sampleData!.without}」</span>
              <br />
              <span className="font-bold text-paper-primary">
                有档案版开头：「{sampleData!.with}」
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setPhase('ask')}
              className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
            >
              再补充几句
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirmMut.mutate()}
              className="rounded-panel bg-paper-primary px-6 py-2.5 text-body text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {confirmMut.isPending ? '生效中…' : '确认档案，开始创作'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
