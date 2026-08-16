import { describe, expect, it } from 'vitest';
import {
  defaultPillarWeights,
  expandPillarItems,
  parseContentPillar,
  pillarDisplayRows,
  shouldShowReplay,
  voiceSuggestText,
} from './positioningMode';
import type { InterviewTurn } from '../api/profile';

const t = (role: 'ai' | 'user', text: string): InterviewTurn => ({ role, text });

describe('shouldShowReplay', () => {
  it('found 且 turns 非空 → true', () =>
    expect(shouldShowReplay(true, [t('ai', 'q'), t('user', 'a')])).toBe(true));
  it('found=false → false', () =>
    expect(shouldShowReplay(false, [t('ai', 'q')])).toBe(false));
  it('turns 空 → false', () =>
    expect(shouldShowReplay(true, [])).toBe(false));
  it('turns null → false', () =>
    expect(shouldShowReplay(true, null)).toBe(false));
});

describe('voiceSuggestText', () => {
  it('口吻建议写明点确认才写入', () => {
    const t = voiceSuggestText({ tone: '先给数字，再讲故事' });
    expect(t).toContain('先给数字，再讲故事');
    expect(t).toContain('点确认才写入档案');
    expect(t).not.toContain('已写入');
  });

  it('红线建议单独成句', () => {
    const t = voiceSuggestText({ redlines: '不承诺效果' });
    expect(t).toContain('红线改成「不承诺效果」');
  });
});

describe('parseContentPillar / pillarDisplayRows', () => {
  it('带 % 的拆出名称和数字', () => {
    expect(parseContentPillar('报价拆解 40%')).toEqual({
      name: '报价拆解',
      amount: 40,
      hadPercent: true,
    });
    expect(parseContentPillar('工艺科普')).toEqual({
      name: '工艺科普',
      amount: null,
      hadPercent: false,
    });
  });

  it('旧「名称 4 : 名称 3」拆成两行并按权重换算', () => {
    expect(expandPillarItems(['报价拆解 4 : 工艺 3'])).toEqual(['报价拆解 4', '工艺 3']);
    const rows = pillarDisplayRows(['报价拆解 4 : 工艺 3']);
    expect(rows.map((r) => r.name)).toEqual(['报价拆解', '工艺']);
    expect(rows.map((r) => r.pct).reduce((a, b) => a + b, 0)).toBe(100);
    expect(rows[0].pct).toBeGreaterThan(rows[1].pct);
  });

  it('光秃秃的 5:3:2 → 套原型三类名并换算成 50/30/20', () => {
    expect(expandPillarItems(['5:3:2'])).toEqual(['行业揭秘 5', '避坑清单 3', '客户案例 2']);
    expect(pillarDisplayRows(['5:3:2']).map((r) => r.pct)).toEqual([50, 30, 20]);
  });

  it('全角 5：3：2 不能收成一条 100%', () => {
    expect(pillarDisplayRows(['5：3：2']).map((r) => r.pct)).toEqual([50, 30, 20]);
    expect(pillarDisplayRows(['5：3：2'])).toHaveLength(3);
  });

  it('中点/中文逗号/空格分隔的类目要拆开', () => {
    expect(expandPillarItems(['报价拆解·工艺科普'])).toEqual(['报价拆解', '工艺科普']);
    expect(expandPillarItems(['报价拆解，工艺科普，客户案例'])).toHaveLength(3);
    expect(expandPillarItems('报价拆解 工艺科普')).toEqual(['报价拆解', '工艺科普']);
  });

  it('四条无占比 → 对齐原型 40/30/20/10', () => {
    expect(defaultPillarWeights(4)).toEqual([40, 30, 20, 10]);
    expect(pillarDisplayRows(['行业揭秘', '避坑清单', '客户案例', '产品种草']).map((r) => r.pct)).toEqual([
      40, 30, 20, 10,
    ]);
  });

  it('「名称40% + 名称35% + 名称25%」拆成三行配比', () => {
    const raw = '技术评测内容40% + AI科普内容35% + 行业趋势分析25%';
    expect(pillarDisplayRows([raw])).toEqual([
      { name: '技术评测内容', pct: 40 },
      { name: 'AI科普内容', pct: 35 },
      { name: '行业趋势分析', pct: 25 },
    ]);
  });

  it('明确百分数且合计约 100 → 原样用', () => {
    expect(pillarDisplayRows(['行业揭秘 40%', '避坑清单 30%', '客户案例 20%', '产品种草 10%'])).toEqual([
      { name: '行业揭秘', pct: 40 },
      { name: '避坑清单', pct: 30 },
      { name: '客户案例', pct: 20 },
      { name: '产品种草', pct: 10 },
    ]);
  });
});
