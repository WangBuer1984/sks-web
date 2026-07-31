/**
 * 设计令牌基线 —— 取值全部来自原型的 inline 样式统计，不是拍脑袋定的。
 *
 * 数据来源：`node scripts/extract-prototype.mjs && node scripts/prototype-tokens.mjs`
 * → `prototypes/extracted/TOKENS.md`（3122 条声明的频次表）。注释里的 ×N 就是该值在原型中的出现次数，
 * 是判断「这是令牌还是局部微调」的依据。改令牌前先重跑那两个脚本，别凭印象改。
 *
 * 原型无任何 class 选择器（730 处 inline style、0 处 class），两个 <style> 块一个是 505 条
 * @font-face、另一个仅 7 行，所以没有可移植的样式表——令牌只能这样反推。
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          // ── 纸面层次（浅 → 深）
          card: '#ffffff',      // ×101 卡片面
          sunken: '#faf8f2',    // ×36  次级面（表头、内嵌块）
          base: '#f4f1e9',      // ×3   页面底色
          tint: '#f7f3ea',      // ×27  暖调底纹（徽章、强调块）
          tintDeep: '#eee8da',  // ×18  更深一档暖调
          shade: '#f2efe6',     // ×8
          shadeDeep: '#e9e4d6', // ×5

          // ── 墨色（文字）。ink/muted 原为 #2b2b2b/#7a7770，原型一次都没用过 → 已按原型校准。
          ink: '#23231f',       // ×44  主文字；也是侧边栏「暖炭」底色
          inkSoft: '#6b6558',   // ×48  次级文字（正文段落）
          muted: '#8a8578',     // ×83  弱化文字（最高频的灰）
          mutedLight: '#a09a8a',// ×14  更弱（提示语）
          mutedFaint: '#9a937f',// ×7
          mutedPale: '#b5ae9a', // ×3

          // ── 描边。line 原为 #e7e3d8，原型未用 → 已校准。
          line: '#e2dccd',      // ×61  常规描边
          lineStrong: '#d8d2c4',// ×44  强调描边/分隔

          // ── 暖炭系（侧边栏内部层次）
          coal: '#2e2c25',      // ×6
          coalLine: '#4a4536',  // ×6
          coalLine2: '#444136', // ×4

          // ── 强调色（棕）
          primary: '#8a5a2b',     // ×195 全局强调，出现频次最高的颜色
          primaryHover: '#6e4620',// 原型 style-hover 声明的按钮 hover 态
          primaryDeep: '#7a3a26', // ×4
          gold: '#c89a5e',        // ×21
          goldSoft: '#c9b997',    // ×11
          goldPale: '#dcc6a4',    // ×7   徽章描边

          // ── 语义色
          danger: '#b0492f',      // ×12
          dangerTint: '#faf0ec',  // ×8
          dangerLine: '#e4b9ab',  // ×6
          success: '#4a8c5c',     // ×8
          successDeep: '#2f5c3b', // ×3
          successTint: '#edf5ef', // ×3
          info: '#4a6c8c',        // ×6
        },
      },

      /**
       * 字号阶。**这是现有页面「看着不像原型」的结构性原因**：原型主力字号是 13.5 / 12.5 / 11.5px
       * 这类半像素档，Tailwind 默认阶（text-xs=12、text-sm=14）命不中，用默认类永远差一点。
       * 名字避开 Tailwind 自带的 xs/sm/base/lg，可与 text-paper-* 颜色类共存。
       */
      fontSize: {
        hint: ['11px', { lineHeight: '1.6' }],      // ×42
        meta: ['12px', { lineHeight: '1.6' }],      // ×77
        caption: ['12.5px', { lineHeight: '1.6' }], // ×54
        copy: ['13px', { lineHeight: '1.6' }],      // ×58
        body: ['13.5px', { lineHeight: '1.6' }],    // ×64  正文主力
        lead: ['14px', { lineHeight: '1.6' }],      // ×34
        sub: ['15px', { lineHeight: '1.7' }],       // ×15
        title: ['26px', { lineHeight: '1.4' }],     // ×12  区块标题
        display: ['58px', { lineHeight: '1.22', letterSpacing: '0.02em' }], // 落地页 Hero 大标题
      },

      borderRadius: {
        // Tailwind 默认缺 10/14/20px 这几档，而它们在原型里是明确的形状语言
        card: '8px',   // ×77  卡片
        chip: '6px',   // ×40  小标签
        panel: '10px', // ×34  面板/主按钮
        block: '12px', // ×33  大块
        badge: '20px', // ×12  胶囊徽章
        tag: '4px',    // ×26
        soft: '14px',  // ×14
      },

      lineHeight: {
        tight: '1.22', // Hero 标题
        snug: '1.5',
        normal: '1.6', // ×53 正文主力
        relaxed: '1.7',
        loose: '1.9',  // 落地页副标题
      },

      letterSpacing: {
        display: '0.02em', // Hero 标题
        label: '0.06em',   // ×3
        caps: '0.08em',    // ×6
        wide: '0.1em',     // ×9  小写标签/全大写
      },

      boxShadow: {
        modal: '0 20px 60px rgba(0,0,0,0.25)',       // ×4 弹窗
        primary: '0 8px 32px rgba(138,90,43,0.22)',  // ×2 强调按钮
        overlay: '0 24px 80px rgba(0,0,0,0.4)',
        card: '0 8px 24px rgba(0,0,0,0.2)',
      },

      fontFamily: {
        sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'],
      },
    },
  },
  plugins: [],
};
