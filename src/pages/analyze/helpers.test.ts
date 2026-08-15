import { describe, it, expect } from 'vitest';
import { extractShareUrl } from './helpers';

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