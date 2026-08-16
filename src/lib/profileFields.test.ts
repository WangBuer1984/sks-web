import { describe, expect, it } from 'vitest';
import {
  PROFILE_FIELD_LABELS,
  draftErrors,
  draftToPatch,
  isListField,
  readProfileFields,
  toFieldDraft,
} from './profileFields';
import { PROFILE_FIELD_KEYS, VOICE_FIELD_KEYS } from '../api/profile';

/**
 * 定位档案七字段的展示与编辑纯逻辑（D19）。
 *
 * 编辑弹窗的 draft 全在本地：这里的 `draftToPatch` 是「取消不发请求」这条要求的落点——
 * 没有改动就没有 patch，调用方据此不调 PUT、不 invalidate cache。
 */

describe('PROFILE_FIELD_LABELS', () => {
  it('七个规范键各有中文标签（UI 文案中文）', () => {
    for (const k of PROFILE_FIELD_KEYS) {
      expect(PROFILE_FIELD_LABELS[k], k).toBeTruthy();
    }
    expect(PROFILE_FIELD_LABELS.persona).toBe('人设');
    expect(PROFILE_FIELD_LABELS.conversionPath).toBe('转化路径');
  });

  it('只有红线与内容支柱是多值字段', () => {
    expect(isListField('redlines')).toBe(true);
    expect(isListField('contentPillars')).toBe(true);
    expect(isListField('persona')).toBe(false);
    expect(isListField('tone')).toBe(false);
  });
});

describe('readProfileFields', () => {
  it('规范键原样读', () => {
    expect(
      readProfileFields({
        persona: '佛山工厂老板娘',
        targetAudience: '装修业主',
        redlines: ['不诋毁同行'],
        contentPillars: ['报价拆解', '工艺科普'],
      }),
    ).toEqual({
      persona: '佛山工厂老板娘',
      targetAudience: '装修业主',
      redlines: ['不诋毁同行'],
      contentPillars: ['报价拆解', '工艺科普'],
    });
  });

  it('旧中文键映射到规范键（老档案要能显示）', () => {
    const read = readProfileFields({
      人设: '工厂人',
      人群: '业主',
      差异化: '敢报真价',
      变现: '到店咨询',
      口吻: '直白',
      红线: '不诋毁同行',
      支柱配比: '报价拆解 4 : 工艺 3',
    });
    expect(read.persona).toBe('工厂人');
    expect(read.targetAudience).toBe('业主');
    expect(read.differentiation).toBe('敢报真价');
    expect(read.conversionPath).toBe('到店咨询');
    expect(read.tone).toBe('直白');
    // 旧档案的红线/支柱是单串文本，读成单元素清单（渲染与编辑都按清单走）
    expect(read.redlines).toEqual(['不诋毁同行']);
    expect(read.contentPillars).toEqual(['报价拆解 4 : 工艺 3']);
  });

  it('旧「支柱配比」的 [{名称,占比}] 形状 → 「名称 占比%」文本项（不显示 [object Object]）', () => {
    expect(
      readProfileFields({
        支柱配比: [
          { 名称: '报价拆解', 占比: 40 },
          { 名称: '工艺科普', 占比: 30 },
        ],
      }).contentPillars,
    ).toEqual(['报价拆解 40%', '工艺科普 30%']);
  });

  it('规范键与中文键同时在（迁移中途的行）→ 规范键优先', () => {
    expect(readProfileFields({ persona: '新', 人设: '旧' }).persona).toBe('新');
  });

  it('未知键与 meta 键不进视图', () => {
    const read = readProfileFields({
      persona: 'p',
      _interview_turns: [{ role: 'ai', text: 'q' }],
      创作偏好: '偷偷影响写稿的东西',
      faqs: [{ question: 'q' }],
    });
    expect(read).toEqual({ persona: 'p' });
  });

  it('缺字段不补默认值（缺键降级渲染，不是空字符串）', () => {
    expect(readProfileFields({})).toEqual({});
  });
});

describe('toFieldDraft', () => {
  it('多值字段用换行拼成 textarea 文本，单值原样', () => {
    expect(
      toFieldDraft({ persona: '工厂人', redlines: ['不诋毁同行', '不承诺工期'] }),
    ).toMatchObject({
      persona: '工厂人',
      redlines: '不诋毁同行\n不承诺工期',
    });
  });

  it('缺字段 → 空串（受控输入不能是 undefined）', () => {
    const d = toFieldDraft({});
    for (const k of PROFILE_FIELD_KEYS) expect(d[k]).toBe('');
  });
});

describe('draftToPatch', () => {
  const base = {
    persona: '工厂人',
    targetAudience: '业主',
    differentiation: '敢报真价',
    conversionPath: '到店咨询',
    tone: '直白',
    redlines: ['不诋毁同行'],
    contentPillars: ['报价拆解'],
  };

  it('一处没改 → 空 patch（取消编辑不发请求的依据）', () => {
    expect(draftToPatch(toFieldDraft(base), base)).toEqual({});
  });

  it('只提交改动的键（部分更新语义，未出现的字段后端保持不变）', () => {
    const draft = { ...toFieldDraft(base), tone: '更犀利一点' };
    expect(draftToPatch(draft, base)).toEqual({ tone: '更犀利一点' });
  });

  it('多值字段按换行拆项并去掉空行', () => {
    const draft = { ...toFieldDraft(base), redlines: '不诋毁同行\n\n不承诺工期  ' };
    expect(draftToPatch(draft, base)).toEqual({ redlines: ['不诋毁同行', '不承诺工期'] });
  });

  it('多值字段清空 → []（把红线全删掉是正当意图，不是「没改」）', () => {
    expect(draftToPatch({ ...toFieldDraft(base), redlines: '  \n ' }, base)).toEqual({
      redlines: [],
    });
  });

  it('文本字段首尾空白不算改动（避免误发 PUT）', () => {
    expect(draftToPatch({ ...toFieldDraft(base), persona: '  工厂人  ' }, base)).toEqual({});
  });

  it('文本字段被清空 → 不进 patch（空白后端 4005；由 draftErrors 拦住并提示）', () => {
    expect(draftToPatch({ ...toFieldDraft(base), tone: '' }, base)).toEqual({});
  });

  it('原本缺失的字段填上了 → 进 patch', () => {
    const patch = draftToPatch({ ...toFieldDraft({}), persona: '工厂人' }, {});
    expect(patch).toEqual({ persona: '工厂人' });
  });

  it('限定 keys 时只看这几项——创作页「人设声音」改不到别的字段', () => {
    const draft = { ...toFieldDraft(base), tone: '更犀利', targetAudience: '装修公司' };
    expect(draftToPatch(draft, base, VOICE_FIELD_KEYS)).toEqual({ tone: '更犀利' });
  });
});

describe('draftErrors', () => {
  const base = { persona: '工厂人', tone: '直白' };
  const draft = toFieldDraft(base);

  it('原样未改 → 无错', () => {
    expect(draftErrors(draft, base)).toEqual({});
  });

  it('把原有文本清空 → 报错（后端同样 4005，但不该让用户白等一趟）', () => {
    const errs = draftErrors({ ...draft, tone: '   ' }, base);
    expect(errs.tone).toBeTruthy();
    expect(errs.persona).toBeUndefined();
  });

  it('档案本来就缺的字段留空 → 不算错（不能因为档案不全就不许改别的字段）', () => {
    expect(draftErrors({ ...draft, differentiation: '' }, base)).toEqual({});
  });

  it('红线/支柱清空 → 不算错（把红线全删掉是正当意图）', () => {
    expect(draftErrors({ ...toFieldDraft({ ...base, redlines: ['x'] }), redlines: '' }, {
      ...base,
      redlines: ['x'],
    })).toEqual({});
  });

  it('限定 keys 时不报范围外字段的错（创作页看不到目标人群，就不该被它挡住保存）', () => {
    const b = { persona: '工厂人', tone: '直白', targetAudience: '业主' };
    const d = { ...toFieldDraft(b), targetAudience: '' };
    expect(draftErrors(d, b, VOICE_FIELD_KEYS)).toEqual({});
    expect(draftErrors(d, b).targetAudience).toBeTruthy();
  });
});
