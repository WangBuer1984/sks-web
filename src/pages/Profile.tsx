import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { fetchMe, updateMe, type MeResponse, type UpdateMePayload } from '../api/auth';
import PhoneChangeDialog, { maskPhone } from '../components/PhoneChangeDialog';

/**
 * 个人中心 `/profile`——对齐原型「个人中心」段
 * （`prototypes/extracted/sections/09-个人中心.html`，条件 `{{ isProfile }}`）。
 *
 * <p>完善度条只按**创作资料 5 字段**算（nickname/industry/identity/style/weeklyGoal），
 * 这是后端 `UserService` 的口径——所以只填了性别/年龄/城市时进度条不动，属预期而非 bug，
 * 页面上直接把这点写出来，免得用户以为没保存成功。
 */

/** 出镜风格三选一，文案取自原型。 */
const STYLES = ['直爽敢说', '亲和唠嗑', '专业讲解'];

/** 表单态：全部用字符串承载，提交时再转数字——避免输入过程中的空串被当成 0。 */
interface Form {
  nickname: string;
  gender: string;
  age: string;
  city: string;
  industry: string;
  identity: string;
  style: string;
  weeklyGoal: string;
}

function toForm(me: MeResponse): Form {
  return {
    nickname: me.nickname ?? '',
    gender: me.gender ?? '',
    age: me.age == null ? '' : String(me.age),
    city: me.city ?? '',
    industry: me.industry ?? '',
    identity: me.identity ?? '',
    style: me.style ?? '',
    weeklyGoal: me.weeklyGoal == null ? '' : String(me.weeklyGoal),
  };
}

/** 空串一律提交 null——后端按「字段是否已填」算完善度，空串会被当成已填。 */
function nullIfBlank(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

function intOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export default function Profile() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  // 首次拿到 me 时灌入表单；之后不再覆盖，避免把用户正在编辑的内容冲掉
  useEffect(() => {
    if (me && form === null) setForm(toForm(me));
  }, [me, form]);

  const saveMut = useMutation({
    mutationFn: (payload: UpdateMePayload) => updateMe(payload),
    onSuccess: (updated) => {
      setError(null);
      setSaved('已保存');
      setForm(toForm(updated));
      qc.setQueryData(['me'], updated);
    },
    onError: (e: unknown) => {
      setSaved('');
      setError(getBizMessage(e, '保存失败'));
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setSaved('');
  };

  const save = () => {
    if (!form) return;
    saveMut.mutate({
      nickname: nullIfBlank(form.nickname),
      gender: nullIfBlank(form.gender),
      age: intOrNull(form.age),
      city: nullIfBlank(form.city),
      industry: nullIfBlank(form.industry),
      identity: nullIfBlank(form.identity),
      style: nullIfBlank(form.style),
      weeklyGoal: intOrNull(form.weeklyGoal),
    });
  };

  if (isLoading || !form || !me) {
    return <p className="text-copy text-paper-muted">加载中…</p>;
  }

  const pct = me.completeness ?? 0;

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="mb-1 font-serif text-title font-black">个人中心</h1>
      <p className="mb-[18px] text-lead text-paper-muted">
        这些资料会注入每次创作——AI 越了解你，稿子越像你
      </p>

      <div className="mb-[18px] flex items-center gap-5 rounded-block border border-paper-line bg-paper-card px-6 py-[18px]">
        <div className="flex-1">
          <div className="mb-2 flex justify-between text-copy">
            <span className="font-bold">资料完善度</span>
            <span className="font-bold text-paper-primary">{pct}%</span>
          </div>
          <div className="h-2 rounded-[4px] bg-paper-shade">
            <div
              className="h-2 rounded-[4px] bg-gradient-to-r from-paper-gold to-paper-primary transition-[width] duration-[400ms]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="max-w-[300px] text-caption leading-normal text-paper-muted">
          完善度只算右侧「创作资料」的 5 项（昵称/行业/身份/风格/周更目标）——性别、年龄、城市影响生成质量，但不计入这个百分比。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-[18px]">
        <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h2 className="mb-3.5 font-sans text-copy font-bold">基础资料</h2>
          <div className="flex flex-col gap-3 text-copy">
            <Field label="昵称" hint="· 出现在口播稿的自我介绍里">
              <input
                value={form.nickname}
                onChange={(e) => set('nickname', e.target.value)}
                className={INPUT}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="性别">
                <div className="flex gap-1.5">
                  {['女', '男'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set('gender', form.gender === g ? '' : g)}
                      className={`flex-1 rounded-card border py-[9px] text-copy ${
                        form.gender === g
                          ? 'border-paper-primary bg-paper-tint text-paper-primary'
                          : 'border-paper-lineStrong bg-paper-sunken text-paper-inkSoft'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="年龄">
                <input
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                  placeholder="如 42"
                  inputMode="numeric"
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="所在城市" hint="· 用于本地化选题和方言梗">
              <input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="如 杭州"
                className={INPUT}
              />
            </Field>

            <Field label="手机号">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-card border border-paper-tintDeep bg-paper-sunken px-3 py-2.5 text-body text-paper-muted">
                  {maskPhone(me.phone)}
                </div>
                <button
                  type="button"
                  onClick={() => setPhoneOpen(true)}
                  className="whitespace-nowrap rounded-card border border-paper-lineStrong px-3.5 py-2.5 text-caption text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
                >
                  换绑
                </button>
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h2 className="mb-3.5 font-sans text-copy font-bold">
            创作资料
            <span className="ml-2 text-hint font-normal text-paper-primary">直接影响文案质量</span>
          </h2>
          <div className="flex flex-col gap-3 text-copy">
            <Field label="行业/赛道" hint="· 决定选题推荐方向">
              <input
                value={form.industry}
                onChange={(e) => set('industry', e.target.value)}
                placeholder="如 全屋定制家居"
                className={INPUT}
              />
            </Field>
            <Field label="职业身份" hint="· 稿件的第一人称立场">
              <input
                value={form.identity}
                onChange={(e) => set('identity', e.target.value)}
                placeholder="如 工厂主 / 12 年从业"
                className={INPUT}
              />
            </Field>
            <Field label="出镜风格" hint="· 影响稿件语气与节奏">
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('style', form.style === s ? '' : s)}
                    className={`rounded-badge border px-3.5 py-2 text-caption ${
                      form.style === s
                        ? 'border-paper-primary bg-paper-tint text-paper-primary'
                        : 'border-paper-lineStrong bg-paper-sunken text-paper-inkSoft'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="每周更新目标" hint="· 用于选题库备货量">
              <input
                value={form.weeklyGoal}
                onChange={(e) => set('weeklyGoal', e.target.value)}
                placeholder="如 4（条/周）"
                inputMode="numeric"
                className={INPUT}
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="mt-[18px] flex items-center gap-3.5">
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={save}
          className="rounded-card bg-paper-primary px-8 py-3 text-lead text-white hover:bg-paper-primaryHover disabled:opacity-45"
        >
          {saveMut.isPending ? '保存中…' : '保存资料'}
        </button>
        {saved && <span className="text-caption text-paper-success">{saved}</span>}
        {error && (
          <span role="alert" className="text-caption text-paper-danger">
            {error}
          </span>
        )}
        <p className="text-caption text-paper-muted">
          人设、口吻、目标人群等更深入的设定在 <Link to="/positioning">账号定位</Link> 里维护
        </p>
      </div>

      {phoneOpen && (
        <PhoneChangeDialog
          currentPhone={me.phone}
          onClose={() => setPhoneOpen(false)}
          onDone={() => {
            setPhoneOpen(false);
            setSaved('手机号已换绑');
            qc.invalidateQueries({ queryKey: ['me'] });
          }}
        />
      )}
    </div>
  );
}

const INPUT =
  'w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-[5px] text-meta text-paper-muted">
        {label}
        {hint && <span className="ml-1 text-paper-goldSoft">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
