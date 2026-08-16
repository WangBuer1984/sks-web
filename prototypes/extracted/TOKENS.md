# 原型设计令牌（自动生成，勿手改）

由 `node scripts/prototype-tokens.mjs` 生成，数据源是 `extracted/full.html` 的 body inline 样式。

样式声明总数 **3347** 条，来自 **740** 处 `style="..."`。
原型无任何 class 选择器，令牌全部由此反推。**出现 ≥3 次的值才建议进 tailwind.config**，
只出现 1 次的多为局部微调，照搬会把令牌表撑烂。

## 颜色

`现有令牌` 列为空 = tailwind.config 里没有，需新增。

| 色值 | 出现次数 | 现有令牌 |
|---|---|---|
| `#8a5a2b` | 182 | `paper.primary` |
| `#ffffff` | 85 | `paper.card` |
| `#8a8578` | 80 | `paper.muted` |
| `#6b6558` | 59 | `paper.inkSoft` |
| `#e2dccd` | 54 | `paper.line` |
| `#d8d2c4` | 52 | `paper.lineStrong` |
| `#23231f` | 47 | `paper.ink` |
| `#f7f3ea` | 41 | `paper.tint` |
| `#faf8f2` | 41 | `paper.sunken` |
| `#6e4620` | 29 | `paper.primaryHover` |
| `#a09a8a` | 24 | `paper.mutedLight` |
| `#eee8da` | 20 | `paper.tintDeep` |
| `#c89a5e` | 18 | `paper.gold` |
| `#c9b997` | 12 | `paper.goldSoft` |
| `#b0492f` | 11 | `paper.danger` |
| `#dcc6a4` | 10 | `paper.goldPale` |
| `#3a382f` | 9 | `paper.coalHover` |
| `#f2efe6` | 8 | `paper.shade` |
| `#4a8c5c` | 7 | `paper.success` |
| `#9a937f` | 7 | `paper.mutedFaint` |
| `#e9e4d6` | 7 | `paper.shadeDeep` |
| `#faf0ec` | 7 | `paper.dangerTint` |
| `#2e2c25` | 6 | `paper.coal` |
| `#4a4536` | 6 | `paper.coalLine` |
| `#4a6c8c` | 5 | `paper.info` |
| `#444136` | 4 | `paper.coalLine2` |
| `#e4b9ab` | 4 | `paper.dangerLine` |
| `rgba(0,0,0,0.25)` | 4 |  |
| `rgba(35,35,31,0.45)` | 4 |  |
| `#7a3a26` | 3 | `paper.primaryDeep` |
| `#b5ae9a` | 3 | `paper.mutedPale` |
| `#edf5ef` | 3 | `paper.successTint` |
| `#2f5c3b` | 2 | `paper.successDeep` |
| `#8f3a25` | 2 | `paper.dangerHover` |
| `#b3c5d6` | 2 |  |
| `#eef3f8` | 2 |  |
| `#f4f1e9` | 2 | `paper.base` |
| `rgba(138,90,43,0.22)` | 2 |  |
| `#bcd8c4` | 1 |  |
| `#c9c2ae` | 1 |  |
| `#efe6d4` | 1 |  |
| `#f2ead8` | 1 |  |
| `#f4e3dd` | 1 |  |
| `#f7f5ee` | 1 |  |
| `rgba(0,0,0,0.2)` | 1 |  |
| `rgba(0,0,0,0.4)` | 1 |  |
| `rgba(138,90,43,0.10)` | 1 |  |
| `rgba(244,241,233,0.92)` | 1 |  |
| `rgba(250,248,242,0)` | 1 |  |

### 与现有 tailwind.config 的冲突

无——现有令牌的色值原型都在用。

## 字号（`font-size`）

| 值 | 出现次数 |
|---|---|
| `12px` | 81 |
| `12.5px` | 60 |
| `13.5px` | 60 |
| `13px` | 56 |
| `11px` | 40 |
| `14px` | 34 |
| `11.5px` | 19 |
| `15px` | 15 |
| `26px` | 12 |
| `30px` | 8 |
| `14.5px` | 7 |
| `16px` | 6 |
| `18px` | 6 |
| `28px` | 3 |
| `22px` | 2 |
| `20px` | 1 |
| `58px` | 1 |

## 字重（`font-weight`）

| 值 | 出现次数 |
|---|---|
| `700` | 94 |
| `900` | 28 |
| `500` | 26 |
| `400` | 10 |
| `{{ acctTabW }}` | 1 |
| `{{ douyinWeight }}` | 1 |
| `{{ gzhWeight }}` | 1 |
| `{{ videoTabW }}` | 1 |

## 圆角（`border-radius`）

| 值 | 出现次数 |
|---|---|
| `8px` | 84 |
| `6px` | 41 |
| `12px` | 35 |
| `10px` | 28 |
| `4px` | 28 |
| `20px` | 19 |
| `14px` | 14 |
| `5px` | 6 |
| `50%` | 4 |
| `10px 10px 10px 2px` | 3 |
| `3px` | 3 |
| `10px 10px 2px 10px` | 2 |
| `12px 12px 12px 3px` | 2 |
| `2px` | 2 |
| `0 0 8px 8px` | 1 |
| `12px 12px 3px 12px` | 1 |
| `16px` | 1 |

## 字距（`letter-spacing`）

| 值 | 出现次数 |
|---|---|
| `0.08em` | 6 |
| `0.1em` | 6 |
| `0.06em` | 3 |
| `0` | 1 |
| `0.02em` | 1 |
| `0.2em` | 1 |

## 栅格间距（`gap`）

| 值 | 出现次数 |
|---|---|
| `10px` | 32 |
| `12px` | 25 |
| `8px` | 15 |
| `14px` | 10 |
| `16px` | 8 |
| `6px` | 6 |
| `18px` | 4 |
| `5px` | 3 |
| `10px 14px` | 1 |
| `20px` | 1 |
| `26px` | 1 |
| `4px` | 1 |

## 内边距（`padding`）

| 值 | 出现次数 |
|---|---|
| `10px 12px` | 19 |
| `12px 14px` | 15 |
| `10px 22px` | 10 |
| `20px 24px` | 10 |
| `14px 16px` | 9 |
| `5px 10px` | 8 |
| `12px 24px` | 7 |
| `14px 18px` | 7 |
| `24px` | 7 |
| `5px 12px` | 7 |
| `4px 10px` | 6 |
| `5px 14px` | 6 |
| `10px 14px` | 5 |
| `14px` | 5 |
| `16px 18px` | 5 |
| `26px 28px` | 5 |
| `3px 8px` | 5 |
| `8px 16px` | 5 |
| `10px 20px` | 4 |
| `12px 20px` | 4 |
| `16px 20px` | 4 |
| `30px` | 4 |
| `3px 0` | 4 |
| `44px 40px` | 4 |
| `7px 16px` | 4 |
| `10px` | 3 |
| `11px 20px` | 3 |
| `11px 26px` | 3 |
| `11px 28px` | 3 |
| `12px 16px` | 3 |
| `18px 20px` | 3 |
| `22px 24px` | 3 |
| `26px 34px` | 3 |
| `30px 32px` | 3 |
| `4px 12px` | 3 |
| `6px 10px` | 3 |
| `8px 14px` | 3 |
| `9px 12px` | 3 |
| `9px 14px` | 3 |
| `12px` | 2 |
| `13px 14px` | 2 |
| `3px 10px` | 2 |
| `40px` | 2 |
| `4px 8px` | 2 |
| `8px` | 2 |
| `8px 18px` | 2 |
| `9px` | 2 |
| `9px 22px` | 2 |
| `0 16px` | 1 |
| `0 24px 72px` | 1 |
| `10px 24px 14px` | 1 |
| `10px 28px` | 1 |
| `11px 14px` | 1 |
| `12px 32px` | 1 |
| `14px 20px` | 1 |
| `14px 40px` | 1 |
| `15px 20px` | 1 |
| `16px 24px` | 1 |
| `16px 40px` | 1 |
| `16px 46px` | 1 |
| `18px 24px` | 1 |
| `18px 24px 12px` | 1 |
| `20px` | 1 |
| `20px 12px` | 1 |
| `24px 26px` | 1 |
| `2px 7px` | 1 |
| `32px 40px` | 1 |
| `3px 12px` | 1 |
| `40px 38px` | 1 |
| `4px 12px 22px` | 1 |
| `64px 24px` | 1 |
| `64px 24px 80px` | 1 |
| `6px 12px` | 1 |
| `7px` | 1 |
| `7px 18px` | 1 |
| `88px 24px 72px` | 1 |
| `8px 24px` | 1 |

## 阴影（`box-shadow`）

| 值 | 出现次数 |
|---|---|
| `0 20px 60px rgba(0,0,0,0.25)` | 4 |
| `0 8px 32px rgba(138,90,43,0.22)` | 2 |
| `0 24px 80px rgba(0,0,0,0.4)` | 1 |
| `0 8px 24px rgba(0,0,0,0.2)` | 1 |

## 行高（`line-height`）

| 值 | 出现次数 |
|---|---|
| `1.6` | 42 |
| `1.7` | 22 |
| `1.65` | 10 |
| `1.5` | 7 |
| `1.8` | 6 |
| `1.9` | 2 |
| `2` | 2 |
| `1.22` | 1 |
| `1.75` | 1 |
