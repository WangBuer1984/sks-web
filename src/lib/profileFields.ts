import {
  PROFILE_FIELD_KEYS,
  type PositioningProfileContent,
  type ProfileFieldKey,
} from '../api/profile';

/**
 * 定位档案七字段的展示与编辑纯逻辑（D19：档案是唯一真源）。
 *
 * 两件事在这里收口：
 *
 * 1. **读**（`readProfileFields`）：库里既有规范键也有旧中文键的档案（老档案不迁移），页面不该各自
 *    `content['人设'] ?? content['persona']` 地凑——凑漏一个键，用户看到的就是「档案里没有这一项」。
 * 2. **写**（`toFieldDraft` → `draftToPatch`）：编辑草稿全在本地，只有真改了的字段才进 patch。
 *    「取消不发请求、不动 Query cache」这条要求的落点就是这里返回的空对象。
 *
 * `draftToPatch` / `draftErrors` 的 `keys` 参数用于**字段子集编辑**：创作页「人设声音」只管
 * `persona/tone/redlines` 三项，范围外字段既不该进它的 patch，也不该用它没显示的字段挡住保存。
 */

/** 字段中文标签（UI 文案中文；键名是英文契约）。顺序同 PROFILE_FIELD_KEYS = 页面展示顺序。 */
export const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, string> = {
  persona: '人设',
  targetAudience: '目标人群',
  differentiation: '差异化',
  conversionPath: '转化路径',
  tone: '口吻',
  redlines: '红线',
  contentPillars: '内容支柱',
};

/** 输入框占位（给「档案里没这一项」的用户一点方向，不是硬性格式要求）。 */
export const PROFILE_FIELD_HINTS: Record<ProfileFieldKey, string> = {
  persona: '你以什么身份说话，例如「佛山做了 12 年全屋定制的工厂老板娘」',
  targetAudience: '你想说给谁听，例如「怕被装修公司坑的业主」',
  differentiation: '和同行不一样的那一点，例如「敢把真实报价拆开摆出来」',
  conversionPath: '看完之后希望观众做什么，例如「私信要报价单模板」',
  tone: '怎么说话，例如「直白、爱举例、不端着」',
  redlines: '不能说的话，一行一条',
  contentPillars: '常写的几类内容，一行一类',
};

/** 多值字段：红线是清单，内容支柱是几类内容；其余五项是单段文本。 */
const LIST_FIELDS: ReadonlySet<string> = new Set<ProfileFieldKey>(['redlines', 'contentPillars']);

export function isListField(key: string): boolean {
  return LIST_FIELDS.has(key);
}

/** 旧中文键 → 规范键。与 Java `ProfileContent` / Python `profile_fields.py` 同一套规则（读侧兼容）。 */
const LEGACY_KEYS: Record<string, ProfileFieldKey> = {
  人设: 'persona',
  人群: 'targetAudience',
  目标人群: 'targetAudience',
  差异化: 'differentiation',
  变现: 'conversionPath',
  转化路径: 'conversionPath',
  口吻: 'tone',
  红线: 'redlines',
  支柱配比: 'contentPillars',
  内容支柱: 'contentPillars',
};

/** 编辑草稿：七字段都是字符串（多值字段用换行分行），因为受控 textarea 只能吃字符串。 */
export type ProfileFieldDraft = Record<ProfileFieldKey, string>;

/**
 * 档案 `content`（可能混着旧中文键与 meta 键）→ 规范七字段视图。
 *
 * 缺的字段**不补默认值**：调用方据「键不存在」渲染「档案里没有这一项」，与「用户填了空串」是两回事。
 * 未知键（`_interview_turns`、历史遗留的「创作偏好」等）一律丢掉——档案里多一个字段不该悄悄影响任何展示。
 */
export function readProfileFields(
  content: Record<string, unknown> | null | undefined,
): PositioningProfileContent {
  const out: Record<string, unknown> = {};
  if (!content) return out as PositioningProfileContent;
  for (const rawKey of Object.keys(content)) {
    const key = (PROFILE_FIELD_KEYS as readonly string[]).includes(rawKey)
      ? (rawKey as ProfileFieldKey)
      : LEGACY_KEYS[rawKey];
    if (!key) continue;
    // 规范键优先：迁移中途的行可能两套键都有，此时以规范键为准
    if (rawKey !== key && out[key] !== undefined) continue;
    const value = isListField(key) ? toList(content[rawKey]) : toText(content[rawKey]);
    if (isListField(key) ? (value as string[]).length > 0 : value !== '') {
      out[key] = value;
    }
  }
  return out as PositioningProfileContent;
}

/** 规范档案 → 编辑草稿。缺字段给空串（受控输入不能是 undefined）。 */
export function toFieldDraft(profile: PositioningProfileContent): ProfileFieldDraft {
  const draft = {} as ProfileFieldDraft;
  for (const key of PROFILE_FIELD_KEYS) {
    const value = profile[key];
    draft[key] = isListField(key) ? toList(value).join('\n') : toText(value);
  }
  return draft;
}

/**
 * 草稿 → 提交给 `PUT /api/profile/fields` 的 patch：**只含真改了的字段**。
 *
 * 文本字段被清空时**不进** patch（后端 4005），由 {@link draftErrors} 提示用户——静默丢弃比
 * 发一个必然失败的请求好，也比把空串写进档案好。
 */
export function draftToPatch(
  draft: ProfileFieldDraft,
  base: PositioningProfileContent,
  keys: readonly ProfileFieldKey[] = PROFILE_FIELD_KEYS,
): Partial<PositioningProfileContent> {
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    if (isListField(key)) {
      const next = splitLines(draft[key]);
      if (!sameList(next, toList(base[key]))) patch[key] = next;
    } else {
      const next = (draft[key] ?? '').trim();
      if (next && next !== toText(base[key]).trim()) patch[key] = next;
    }
  }
  return patch as Partial<PositioningProfileContent>;
}

/**
 * 校验草稿：只报「把原有文本清空了」。
 *
 * 档案本来就缺的字段留空不算错——否则档案不全的用户改不了任何一项。
 * 红线 / 内容支柱清空同样合法（把红线全删掉是正当意图，后端也接受空数组）。
 */
export function draftErrors(
  draft: ProfileFieldDraft,
  base: PositioningProfileContent,
  keys: readonly ProfileFieldKey[] = PROFILE_FIELD_KEYS,
): Partial<Record<ProfileFieldKey, string>> {
  const errors: Partial<Record<ProfileFieldKey, string>> = {};
  for (const key of keys) {
    if (isListField(key)) continue;
    const had = toText(base[key]).trim();
    if (had && !(draft[key] ?? '').trim()) {
      errors[key] = `${PROFILE_FIELD_LABELS[key]}不能清空——留着原来的内容，或者换个说法写`;
    }
  }
  return errors;
}

function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(' · ');
  if (typeof v === 'object') return objectText(v as Record<string, unknown>);
  return String(v);
}

/**
 * 老档案里的对象值——主要是旧「支柱配比」的 `[{名称, 占比}]`（改 schema 前的产出，那些行还在库里）。
 *
 * 认得出这个形状就压成「报价拆解 40%」：不认就是 `[object Object]`，而且用户一编辑就把它存回档案。
 * 认不出的对象退化成 `键：值` 串——难看但不丢信息。
 */
function objectText(o: Record<string, unknown>): string {
  const name = typeof o['名称'] === 'string' ? o['名称'].trim() : '';
  const pct = Number(o['占比']);
  if (name) return Number.isFinite(pct) ? `${name} ${pct}%` : name;
  return Object.entries(o)
    .map(([k, val]) => `${k}：${toText(val)}`)
    .join('；');
}

/** 旧档案的红线/支柱是单串文本，读成单元素清单——清单 UI 与编辑框都按清单走。 */
function toList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(toText).map((s) => s.trim()).filter(Boolean);
  const text = toText(v).trim();
  return text ? [text] : [];
}

function splitLines(text: string): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}
