import { describe, it, expect } from 'vitest';
import { extractShareUrl, routeVideoInput, validateLinkInput } from './helpers';

describe('extractShareUrl', () => {
  it('从抖音脏分享文案提取真实短链', () => {
    const e = extractShareUrl(
      '7- 长按复制此条消息，打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/L31FFnzgyzE/ 1@0.com :0pm',
    );
    expect(e).toEqual({ url: 'https://v.douyin.com/L31FFnzgyzE/', platform: 'douyin' });
  });

  it('纯链接原样返回', () => {
    expect(extractShareUrl('https://v.douyin.com/abc/')?.url).toBe('https://v.douyin.com/abc/');
  });

  it('纯文案无链接返回 null', () => {
    expect(extractShareUrl('这是一段没有任何链接的口播文案')).toBeNull();
  });

  it('URL 后紧跟中文无空格,token 在中文处断', () => {
    expect(extractShareUrl('看这个 https://v.douyin.com/L31F复制此链接打开抖音')?.url).toBe(
      'https://v.douyin.com/L31F',
    );
  });

  it('schemeless 命中后补 https://', () => {
    expect(extractShareUrl('看 v.douyin.com/L31F 这个')?.url).toBe('https://v.douyin.com/L31F');
  });

  it('脏文本先非白名单 URL 再短链,继续找而非首失败即 null', () => {
    expect(extractShareUrl('先 http://t.cn/x 再 https://v.douyin.com/abc/')?.url).toBe(
      'https://v.douyin.com/abc/',
    );
  });

  it('尾部中文标点被断,返回干净 URL', () => {
    expect(extractShareUrl('链接 https://v.douyin.com/L31F。')?.url).toBe('https://v.douyin.com/L31F');
  });

  it('小红书识别但不在支持集', () => {
    const e = extractShareUrl('https://www.xiaohongshu.com/explore/abc');
    expect(e?.platform).toBe('xiaohongshu');
  });

  it('视频号 weixin.qq.com/sph 在支持集', () => {
    const e = extractShareUrl('https://weixin.qq.com/sph/xxx');
    expect(e?.platform).toBe('wechat_channels');
  });

  it('channels.weixin.qq.com 无 /sph/ 也判 wechat_channels(host 级)', () => {
    const e = extractShareUrl('https://channels.weixin.qq.com/xxx');
    expect(e?.platform).toBe('wechat_channels');
  });

  it('畸形候选(%zz)跳过,继续找合法短链(锁 TS/Java 等价)', () => {
    expect(extractShareUrl('https://v.douyin.com/%zz https://v.douyin.com/abc/')?.url).toBe(
      'https://v.douyin.com/abc/',
    );
  });

  it('已清洗 URL 再过一次幂等', () => {
    const clean = 'https://v.douyin.com/abc/';
    expect(extractShareUrl(clean)?.url).toBe(clean);
    expect(extractShareUrl(extractShareUrl(clean)!.url)?.url).toBe(clean);
  });

  it('1@0.com 噪声不被误取', () => {
    expect(extractShareUrl('噪声 1@0.com :0pm https://v.douyin.com/abc/')?.url).toBe(
      'https://v.douyin.com/abc/',
    );
  });

  it('空串/null 返回 null', () => {
    expect(extractShareUrl('')).toBeNull();
    expect(extractShareUrl('   ')).toBeNull();
    expect(extractShareUrl(null as unknown as string)).toBeNull();
  });
});

describe('routeVideoInput', () => {
  it('带完整域名的脏文案路由到 videoLink 而非 text（锁误路由回归）', () => {
    const r = routeVideoInput('看这个 https://www.douyin.com/video/7xxx 再说');
    expect(r.kind).toBe('videoLink');
    if (r.kind === 'videoLink') expect(r.url).toBe('https://www.douyin.com/video/7xxx');
  });

  it('小红书脏文案硬拒报错，不退回 text（锁刻意收窄）', () => {
    const r = routeVideoInput('一个 https://www.xiaohongshu.com/explore/abc 分享');
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain('小红书');
  });

  it('纯文案无链接路由到 text', () => {
    expect(routeVideoInput('师傅最怕你检查这四处——看完验收比监理还专业').kind).toBe('text');
  });

  it('干净抖音短链路由到 videoLink 用清洗后 URL', () => {
    const r = routeVideoInput('https://v.douyin.com/abc/');
    expect(r.kind).toBe('videoLink');
  });
});

describe('validateLinkInput', () => {
  it('抖音脏文案提取成功', () => {
    const v = validateLinkInput('长按复制 https://v.douyin.com/abc/ 1@0.com');
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.url).toBe('https://v.douyin.com/abc/');
  });

  it('小红书 → 不支持错误（非放行）', () => {
    const v = validateLinkInput('https://www.xiaohongshu.com/explore/abc');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain('小红书');
  });

  it('无链接 → 未识别错误', () => {
    const v = validateLinkInput('纯文案没有链接');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain('未识别');
  });
});