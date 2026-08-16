import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../../api/client';
import {
  VOICE_FIELD_KEYS,
  getActiveProfile,
  updateProfileFields,
  type ActiveProfileView,
  type VoiceFieldKey,
} from '../../api/profile';
import {
  draftErrors,
  draftToPatch,
  readProfileFields,
  toFieldDraft,
  type ProfileFieldDraft,
} from '../../lib/profileFields';

/**
 * 创作页「人设声音」——定位档案的<b>三字段投影</b>（D19：档案是唯一真源）。
 *
 * <p>展示与编辑对齐原型 `13-文案创作.html`：只读是暖底卡 + 纯文本三行；编辑是 520px 弹窗，
 * 不是在卡片里展开表单。红线用中点连写，不做成芯片。
 *
 * <p>三条行为约束：只三项；取消不发请求；保存中不能取消。
 */
const ROWS: VoiceFieldKey[] = [...VOICE_FIELD_KEYS];

function redlinesLine(value: unknown): string {
  const list = Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : [];
  return list.join(' · ');
}

function lineToRedlinesDraft(text: string): string {
  return text
    .split(/\s*[·、，,\n]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

export default function VoicePanel({ generated = false }: { generated?: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileFieldDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ActiveProfileView>({
    queryKey: ['profile'],
    queryFn: getActiveProfile,
  });

  const profile = readProfileFields(data?.content);

  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof updateProfileFields>[0]) => updateProfileFields(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'], exact: true });
      setEditing(false);
      setDraft(null);
      setSaveError(null);
    },
    onError: (e: unknown) => setSaveError(getBizMessage(e, '保存失败')),
  });

  const patchDraft = draft
    ? { ...draft, redlines: lineToRedlinesDraft(draft.redlines) }
    : null;
  const errors = patchDraft ? draftErrors(patchDraft, profile, ROWS) : {};
  const patch = patchDraft ? draftToPatch(patchDraft, profile, ROWS) : {};

  const openEditor = () => {
    const next = toFieldDraft(profile);
    next.redlines = redlinesLine(profile.redlines);
    setDraft(next);
    setSaveError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (mut.isPending) return;
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  };

  const save = () => {
    if (!draft) return;
    const firstError = ROWS.map((k) => errors[k]).find(Boolean);
    if (firstError) {
      setSaveError(firstError);
      return;
    }
    if (Object.keys(patch).length === 0) {
      cancel();
      return;
    }
    mut.mutate(patch);
  };

  return (
    <section className="rounded-panel border border-paper-goldPale bg-paper-tint px-4 py-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="text-copy font-bold text-paper-inkSoft">人设声音</div>
        {data?.calibrated && !editing && (
          <button
            type="button"
            onClick={openEditor}
            className="shrink-0 text-meta text-paper-primary hover:text-paper-primaryHover"
          >
            编辑
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-caption text-paper-muted">加载中…</p>
      ) : !data?.calibrated ? (
        <div>
          <p className="mb-2.5 text-caption leading-relaxed text-paper-inkSoft">
            还没校准定位，这次生成的是通用版口播稿。花 15 分钟聊出档案，稿子才会像你本人写的。
          </p>
          <Link
            to="/positioning"
            className="block w-full rounded-chip border border-paper-primary bg-transparent px-2 py-2 text-center text-caption text-paper-primary hover:bg-paper-tint"
          >
            去校准定位 →
          </Link>
        </div>
      ) : (
        <div className="text-caption leading-relaxed text-paper-inkSoft">
          <div className="mb-[5px]">
            {profile.persona?.trim() || (
              <span className="text-paper-mutedLight">档案里没有这一项</span>
            )}
          </div>
          <div className="mb-[5px]">
            <span className="font-bold text-paper-inkSoft">口吻 </span>
            {profile.tone?.trim() || (
              <span className="text-paper-mutedLight">档案里没有这一项</span>
            )}
          </div>
          <div>
            <span className="font-bold text-paper-inkSoft">红线 </span>
            {redlinesLine(profile.redlines) || (
              <span className="text-paper-mutedLight">档案里没有这一项</span>
            )}
          </div>
          <div className="mt-2.5 border-t border-dashed border-paper-goldPale pt-2 text-[11.5px] leading-normal text-paper-primary">
            {generated
              ? '本稿已按这套人设生成 · 改了会回写定位档案'
              : '这次生成就会用它 · 现在改完再点「生成口播稿」'}
          </div>
        </div>
      )}

      {editing && draft && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(35,35,31,0.45)] p-4">
          <div className="w-full max-w-[520px] animate-slideup rounded-soft bg-paper-card px-7 py-[26px] shadow-modal">
            <div className="mb-2 text-meta font-bold tracking-wide text-paper-primary">
              人设声音 · 来自定位档案
            </div>
            <p className="mb-4 text-caption leading-relaxed text-paper-muted">
              这三项决定「稿子像不像你」，每次生成都会用上。在这里改，账号定位档案同步更新
            </p>
            {saveError && (
              <p
                role="alert"
                className="mb-3 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
              >
                {saveError}
              </p>
            )}
            <label className="mb-3 block">
              <span className="mb-1.5 block text-meta font-bold text-paper-inkSoft">人设一句话</span>
              <input
                value={draft.persona}
                onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
                className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-meta font-bold text-paper-inkSoft">口吻</span>
              <input
                value={draft.tone}
                onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
                className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-meta font-bold text-paper-inkSoft">红线（不许说的）</span>
              <input
                value={draft.redlines}
                onChange={(e) => setDraft({ ...draft, redlines: e.target.value })}
                className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
              />
            </label>
            <p className="mt-2.5 text-meta text-paper-mutedLight">
              保存即回写定位档案，下一篇稿子立刻生效
            </p>
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={mut.isPending}
                onClick={cancel}
                className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                取消
              </button>
              <button
                type="button"
                disabled={mut.isPending}
                onClick={save}
                className="rounded-card bg-paper-primary px-[22px] py-2.5 text-body font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {mut.isPending ? '保存中…' : '保存并回写档案'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
