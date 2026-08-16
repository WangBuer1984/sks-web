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
  PROFILE_FIELD_HINTS,
  PROFILE_FIELD_LABELS,
  draftErrors,
  draftToPatch,
  isListField,
  readProfileFields,
  toFieldDraft,
  type ProfileFieldDraft,
} from '../../lib/profileFields';

/**
 * 创作页「人设声音」——定位档案的<b>三字段投影</b>（D19：档案是唯一真源）。
 *
 * <p>为什么它在创作页而不是只在定位页：人设、口吻、红线是这次生成的**输入**，用户往往在看到稿子不对味
 * 的那一刻才想改。要是只能去定位页改，他会改成 prompt 里的临时要求——于是「创作偏好」这种第二套隐性
 * 人设就长出来了。所以这里可看可改，但改的是**同一个对象**：`PUT /api/profile/fields` 只提交这三项的
 * 变更子集，定位页立刻可见。
 *
 * <p>三条行为约束：
 * <ul>
 *   <li>**只三项**：不展示也不提交目标人群 / 差异化 / 转化路径 / 内容支柱——那四项属于定位页的整档编辑。
 *   <li>**取消不发请求**：草稿只在本地 state，取消即丢弃，不动 Query cache。
 *   <li>**保存中不能取消**：PUT 一旦发出就拦不住（服务端可能已提交），此时「取消」只会给用户一个
 *       改动没生效的假象。宁可禁用按钮，也不给一个撤不回来的撤销。
 * </ul>
 */
const ROWS: VoiceFieldKey[] = [...VOICE_FIELD_KEYS];

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
      // exact：FAQ 与回放挂在 ['profile', …] 下，改口吻不该顺手把它们也重拉一遍
      void queryClient.invalidateQueries({ queryKey: ['profile'], exact: true });
      setEditing(false);
      setDraft(null);
      setSaveError(null);
    },
    onError: (e: unknown) => setSaveError(getBizMessage(e, '保存失败')),
  });

  const errors = draft ? draftErrors(draft, profile, ROWS) : {};
  const patch = draft ? draftToPatch(draft, profile, ROWS) : {};

  const openEditor = () => {
    setDraft(toFieldDraft(profile));
    setSaveError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (mut.isPending) return; // 已发出的 PUT 拦不住，别给假撤销
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
      cancel(); // 一处没改：关掉编辑器，不发请求
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

      {saveError && (
        <p
          role="alert"
          className="mb-2.5 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
        >
          {saveError}
        </p>
      )}

      {isLoading ? (
        <p className="text-caption text-paper-muted">加载中…</p>
      ) : !data?.calibrated ? (
        <div>
          <p className="mb-2.5 text-caption leading-normal text-paper-inkSoft">
            还没有定位档案，这次生成的是通用版口播稿。花 15 分钟聊出档案，稿子才会像你本人写的。
          </p>
          <Link
            to="/positioning"
            className="block w-full rounded-chip border border-paper-primary px-2 py-2 text-center text-caption text-paper-primary hover:bg-paper-goldSoft"
          >
            去校准定位 →
          </Link>
        </div>
      ) : editing && draft ? (
        <div className="flex flex-col gap-2.5">
          {ROWS.map((key) => (
            <label key={key} className="block">
              <span className="mb-1 block text-hint font-bold text-paper-primary">
                {PROFILE_FIELD_LABELS[key]}
                {isListField(key) && (
                  <span className="ml-1 font-normal text-paper-mutedLight">（一行一条）</span>
                )}
              </span>
              <textarea
                rows={isListField(key) ? 3 : 2}
                value={draft[key]}
                placeholder={PROFILE_FIELD_HINTS[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className={`w-full rounded-card border bg-paper-sunken px-3.5 py-2.5 text-copy leading-normal text-paper-ink outline-none focus:border-paper-primary ${
                  errors[key] ? 'border-paper-dangerLine' : 'border-paper-lineStrong'
                }`}
              />
              {errors[key] && (
                <span className="mt-1 block text-hint text-paper-danger">{errors[key]}</span>
              )}
            </label>
          ))}
          <div className="flex items-center justify-end gap-2.5">
            <span className="mr-auto text-hint text-paper-mutedLight">
              只会更新你动过的字段，定位页看到的是同一份档案
            </span>
            <button
              type="button"
              disabled={mut.isPending}
              onClick={cancel}
              className="rounded-card border border-paper-lineStrong px-5 py-2 text-copy text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              取消
            </button>
            <button
              type="button"
              disabled={mut.isPending}
              onClick={save}
              className="rounded-panel bg-paper-primary px-5 py-2 text-copy text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {mut.isPending ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-caption leading-normal text-paper-inkSoft">
          {ROWS.map((key) => {
            const value = profile[key];
            const list = isListField(key) ? ((value as string[] | undefined) ?? []) : null;
            return (
              <div key={key}>
                {key !== 'persona' && (
                  <span className="text-paper-mutedLight">{PROFILE_FIELD_LABELS[key]} </span>
                )}
                {list ? (
                  list.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((item) => (
                        <span
                          key={item}
                          className="rounded-tag border border-paper-lineStrong bg-paper-card px-2 py-[3px] text-hint text-paper-inkSoft"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-paper-mutedLight">档案里没有这一项</span>
                  )
                ) : (
                  <div className="leading-normal">
                    {(value as string | undefined)?.trim() || (
                      <span className="text-paper-mutedLight">档案里没有这一项</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-2.5 border-t border-dashed border-paper-goldSoft pt-2 text-hint leading-normal text-paper-primary">
            {generated
              ? '本稿已按这套人设生成 · 改了会回写定位档案'
              : '这次生成就会用它 · 现在改完再点「生成口播稿」'}
          </div>
        </div>
      )}
    </section>
  );
}
