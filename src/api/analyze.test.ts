import { describe, it, expect } from 'vitest';
import { parseStructure } from './analyze';

describe('parseStructure', () => {
  it('透传 transcript（链接流 result 五字段）', () => {
    const r = parseStructure(
      JSON.stringify({
        structure: '钩子→正文→CTA',
        why_hot: '切中焦虑',
        framework: '问题-方案',
        diff_hint: '可复用',
        transcript: '开场就问你家师傅怕不怕检查……',
      }),
    );
    expect(r?.transcript).toBe('开场就问你家师傅怕不怕检查……');
    expect(r?.structure).toBe('钩子→正文→CTA');
  });

  it('旧任务无 transcript 字段 → undefined，不报错', () => {
    const r = parseStructure(JSON.stringify({ structure: 's', why_hot: 'w' }));
    expect(r?.transcript).toBeUndefined();
    expect(r?.structure).toBe('s');
  });

  it('非法 JSON → null', () => {
    expect(parseStructure('{不是 JSON')).toBeNull();
    expect(parseStructure(null)).toBeNull();
  });
});