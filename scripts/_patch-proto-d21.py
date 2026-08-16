#!/usr/bin/env python3
"""One-shot D18–D21 tweaks on extracted/full.html. Layout stays."""
from pathlib import Path

p = Path("/Users/rick/work/sks-web/prototypes/extracted/full.html")
t = p.read_text()

# --- sidebar: restore 账号定位 ---
t = t.replace(
    'style-hover="background: #3a382f;">账号</div>',
    'style-hover="background: #3a382f;">账号定位</div>',
    1,
)

# --- workbench: drop 最近内容 / 待复盘 ---
start = t.find('        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px;">\n          <div style="font-size: 16px; font-weight: 700;">最近内容</div>')
end = t.find('        <div style="background: #f7f3ea; border: 1px solid #dcc6a4; border-left: 3px solid #8a5a2b;')
if start < 0 or end < 0 or end <= start:
    raise SystemExit(f"workbench blocks not found start={start} end={end}")
t = t[:start] + t[end:]

# --- landing 02 title ---
t = t.replace(
    '<div style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">每天知道拍什么</div>',
    '<div style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">选题从三处来</div>',
    1,
)

# --- profile completeness note ---
t = t.replace(
    '<div style="font-size: 14px; color: #8a8578; margin-bottom: 18px;">这些资料会注入每次创作——AI 越了解你，稿子越像你</div>',
    '<div style="font-size: 14px; color: #8a8578; margin-bottom: 18px;">这些资料会注入每次创作。完善度只算昵称、行业、身份、出镜风格、每周更新目标；性别、年龄、城市不计入。</div>',
    1,
)

# --- calib step 3: FAQ checkboxes before 试试效果 ---
old_try = '''            <div style="background: #f7f3ea; border-left: 3px solid #8a5a2b; border-radius: 6px; padding: 12px 16px; font-size: 12.5px; line-height: 1.7; margin-bottom: 18px;">试试效果：同一个选题「报价为什么差一倍」——'''
new_try = '''            <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">要不要留下这些客户问答？</div>
            <div style="font-size: 12px; color: #8a8578; margin-bottom: 10px;">默认都不勾，不勾也能完成。勾了的会进定位档案，之后你可以再点「生成选题」。</div>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px;">
              <div sc-camel-on-click="{{ toggleFaq1 }}" style="display: flex; align-items: center; gap: 10px; background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 10px 12px; cursor: pointer;">
                <span style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid #8a5a2b; background: {{ faq1Bg }};"></span>
                <span>同样是做柜子，为什么报价能差一倍？</span>
              </div>
              <div sc-camel-on-click="{{ toggleFaq2 }}" style="display: flex; align-items: center; gap: 10px; background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 10px 12px; cursor: pointer;">
                <span style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid #8a5a2b; background: {{ faq2Bg }};"></span>
                <span>定制柜的甲醛到底多久能散？</span>
              </div>
            </div>
            <div style="background: #f7f3ea; border-left: 3px solid #8a5a2b; border-radius: 6px; padding: 12px 16px; font-size: 12.5px; line-height: 1.7; margin-bottom: 18px;">试试效果：同一个选题「报价为什么差一倍」——'''
if old_try not in t:
    raise SystemExit("calib try block not found")
t = t.replace(old_try, new_try, 1)

# --- pos: add 口吻 / 红线 ---
old_grid4 = '''                <div style="background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 12px 14px;"><div style="font-size: 11px; color: #8a5a2b; font-weight: 700; margin-bottom: 4px;">转化路径</div><div style="line-height: 1.6;">评论扣字 → 私域群 → 免费拆报价单 → 到店</div></div>
              </div>
            </div>
            <div style="background: #fff; border: 1px solid #e2dccd; border-radius: 12px; padding: 20px 24px;">
              <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px;">内容支柱'''
new_grid4 = '''                <div style="background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 12px 14px;"><div style="font-size: 11px; color: #8a5a2b; font-weight: 700; margin-bottom: 4px;">转化路径</div><div style="line-height: 1.6;">评论扣字 → 私域群 → 免费拆报价单 → 到店</div></div>
                <div style="background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 12px 14px;"><div style="font-size: 11px; color: #8a5a2b; font-weight: 700; margin-bottom: 4px;">口吻</div><div style="line-height: 1.6;">直接、爱用数字、先给结论再给理由</div></div>
                <div style="background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 12px 14px;"><div style="font-size: 11px; color: #8a5a2b; font-weight: 700; margin-bottom: 4px;">红线</div><div style="line-height: 1.6;">不承诺零甲醛 · 不贬低具体同行 · 不说「家人们」</div></div>
              </div>
            </div>
            <div style="background: #fff; border: 1px solid #e2dccd; border-radius: 12px; padding: 20px 24px;">
              <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px;">内容支柱'''
if old_grid4 not in t:
    raise SystemExit("pos grid not found")
t = t.replace(old_grid4, new_grid4, 1)

# --- pos: FAQ block after 内容支柱 card ---
old_pillar_end = '''                <div style="display: grid; grid-template-columns: 110px 1fr 40px; gap: 12px; align-items: center;"><span>产品种草</span><div style="height: 8px; background: #f2efe6; border-radius: 4px;"><div style="height: 8px; width: 10%; background: #4a6c8c; border-radius: 4px;"></div></div><span style="color: #8a8578; font-size: 12px;">10%</span></div>
              </div>
            </div>
          </div>
          <div style="background: #fff; border: 1px solid #e2dccd; border-radius: 12px; padding: 20px; display: flex; flex-direction: column;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">定位校准对话</div>'''
new_pillar_end = '''                <div style="display: grid; grid-template-columns: 110px 1fr 40px; gap: 12px; align-items: center;"><span>产品种草</span><div style="height: 8px; background: #f2efe6; border-radius: 4px;"><div style="height: 8px; width: 10%; background: #4a6c8c; border-radius: 4px;"></div></div><span style="color: #8a8578; font-size: 12px;">10%</span></div>
              </div>
            </div>
            <div style="background: #fff; border: 1px solid #e2dccd; border-radius: 12px; padding: 20px 24px;">
              <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">高频问答</div>
              <div style="font-size: 12px; color: #8a8578; margin-bottom: 12px;">属于定位档案。点「生成选题」才会进选题库，不会自动塞。</div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <sc-for list="{{ faqList }}" as="f" hint-placeholder-count="2">
                  <div style="display: flex; align-items: center; gap: 10px; background: #faf8f2; border: 1px solid #eee8da; border-radius: 8px; padding: 10px 12px;">
                    <div style="flex: 1; font-size: 13.5px; line-height: 1.5;">{{ f.q }}</div>
                    <button sc-camel-on-click="{{ f.gen }}" style="border: 1px solid #8a5a2b; color: #8a5a2b; background: none; border-radius: 6px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; white-space: nowrap;" style-hover="background: #f7f3ea;">{{ f.genLabel }}</button>
                    <span sc-camel-on-click="{{ f.del }}" style="font-size: 12px; color: #8a8578; cursor: pointer;" style-hover="color: #b0492f;">删除</span>
                  </div>
                </sc-for>
              </div>
            </div>
          </div>
          <div style="background: #fff; border: 1px solid #e2dccd; border-radius: 12px; padding: 20px; display: flex; flex-direction: column;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">定位校准对话</div>'''
if old_pillar_end not in t:
    raise SystemExit("pillar end not found")
t = t.replace(old_pillar_end, new_pillar_end, 1)

# --- topics empty hint + FAQ source ---
t = t.replace(
    "拆一个对标账号，立刻拿到 TOP10 爆款选题参考<br>也可以在发布复盘里给爆款出续集，选题会汇到这里",
    "在账号定位里把问答生成选题，或拆一个对标账号、给爆款出续集——都由你点了才会出现",
    1,
)
t = t.replace(
    "在「对标拆解」里点「存入选题库」、或在「发布复盘」里给爆款出续集，选题会自动汇入这里。",
    "选题只来自三处：定位页的「生成选题」、对标拆解存入、复盘爆款续集。没有每日热点。",
    1,
)

# --- create: video tab + lazy hint + 查重 copy ---
t = t.replace(
    ">视频号版（切换时生成）</div>",
    ">视频号版</div>",
    1,
)
t = t.replace(
    """              <div style="padding: 24px 26px;">
                <sc-if value="{{ editingKb }}" hint-placeholder-val="{{ false }}">""",
    """              <div style="padding: 24px 26px;">
                <sc-if value="{{ gzhLazyHint }}" hint-placeholder-val="{{ false }}">
                  <div style="font-size: 12.5px; color: #8a5a2b; margin-bottom: 12px;">视频号版刚生成 · 不另扣额度</div>
                </sc-if>
                <sc-if value="{{ editingKb }}" hint-placeholder-val="{{ false }}">""",
    1,
)
t = t.replace(
    "查重提醒：「报价差一倍」角度与你 6 月 28 日的稿件相似度 41%，本稿已自动换用「拆报价单」切入。",
    "这篇和《同样是做柜子，为什么报价能差一倍？》相似度高，可换个角度或继续采用。不挡住入库、不另扣额度。",
    1,
)

# --- kb copy ---
t = t.replace(
    "这里是「稿子像你」的原料——去创作一篇，点「直接采用」它就会存进来<br>也可以把以前写过的口播文案直接粘进来，支持 Markdown",
    "这里是「稿子像你」的原料——去创作一篇，点「采用抖音版 / 采用视频号版」才会存进来<br>也可以把以前写过的口播文案直接粘进来，支持 Markdown",
    1,
)
t = t.replace(
    "创作页点「直接采用」的稿子会自动存进来；发布复盘判为爆款的自动打上「爆款」标签，之后创作优先参考。内容越厚，稿子越像你——维护知识库不扣额度。",
    "创作页点「采用当前平台版」的稿子会存进来；发布复盘判为爆款才打「爆款」标签。维护知识库不扣额度。",
    1,
)

# --- JS: state extras ---
t = t.replace(
    "    quota: 36, demoNew: false,",
    "    quota: 36, demoNew: false, adoptedDy: false, adoptedGzh: false, gzhReady: false, faq1: false, faq2: false,",
    1,
)
t = t.replace(
    """    topics: [
      { tag: '对标拆解', title: '工厂人教你验自家柜子（对立视角清单框架）', src: '拆解自「装修避坑老张」12w 赞 · 清单体框架' },
      { tag: '高频问答', title: '定制柜的甲醛到底多久能散？工厂人给你测给你看', src: '你知识库里聊过的「甲醛」· 客户咨询频率第 2' },
      { tag: '复盘反哺', title: '验收系列出续集：交付后 3 个月最容易出的 4 个问题', src: '源自你的爆款「验收 5 个地方」· 清单体播放为均值 6 倍' },
    ],""",
    """    faqs: [
      { q: '同样是做柜子，为什么报价能差一倍？', used: false },
      { q: '定制柜的甲醛到底多久能散？', used: false },
    ],
    topics: [
      { tag: '对标拆解', title: '工厂人教你验自家柜子（对立视角清单框架）', src: '拆解自「装修避坑老张」12w 赞 · 清单体框架' },
      { tag: '高频问答', title: '定制柜的甲醛到底多久能散？工厂人给你测给你看', src: '来自定位档案里你确认过的客户问答' },
      { tag: '复盘反哺', title: '验收系列出续集：交付后 3 个月最容易出的 4 个问题', src: '源自你的爆款「验收 5 个地方」· 清单体播放为均值 6 倍' },
    ],""",
    1,
)

# --- JS: completeness 5 fields ---
t = t.replace(
    """    const fields = [
      [p.nick, '填上昵称，口播稿的自我介绍会用它'],
      [p.gender, '选择性别，帮 AI 校准语气'],
      [p.age, '填上年龄，表达方式会更贴合你的年龄段'],
      [p.city, '填上城市，可以推荐本地化选题'],
      [p.industry, '填上行业，选题推荐才有方向'],
      [p.role, '填上职业身份，稿件立场更可信'],
      [p.style, '选一个出镜风格'],
      [p.freq, '填上更新频率，选题库按需备货'],
    ];""",
    """    const fields = [
      [p.nick, '填上昵称，口播稿的自我介绍会用它'],
      [p.industry, '填上行业，选题推荐才有方向'],
      [p.role, '填上职业身份，稿件立场更可信'],
      [p.style, '选一个出镜风格'],
      [p.freq, '填上每周更新目标，选题库按需备货'],
    ];""",
    1,
)

# --- JS: generate reset platform adopt ---
t = t.replace(
    "    this.setState({ gen: 'loading', adopted: false, kbEditing: null, quota: this.state.quota - 1 });",
    "    this.setState({ gen: 'loading', adopted: false, adoptedDy: false, adoptedGzh: false, gzhReady: false, platform: 'douyin', kbEditing: null, quota: this.state.quota - 1 });",
    1,
)

# --- JS: renderVals extras before return's adopt ---
t = t.replace(
    "      setDouyin: () => this.setState({ platform: 'douyin' }),\n      setGzh: () => this.setState({ platform: 'gzh' }),",
    """      setDouyin: () => this.setState({ platform: 'douyin' }),
      setGzh: () => {
        if (s.gen === 'done' && !s.gzhReady) {
          this.setState({ platform: 'gzh', gzhReady: true });
          this.showToast('视频号版已生成 · 不另扣额度');
        } else this.setState({ platform: 'gzh' });
      },
      gzhLazyHint: s.platform === 'gzh' && s.gzhReady && s.gen === 'done',
      toggleFaq1: () => this.setState({ faq1: !s.faq1 }),
      toggleFaq2: () => this.setState({ faq2: !s.faq2 }),
      faq1Bg: s.faq1 ? '#8a5a2b' : '#fff', faq2Bg: s.faq2 ? '#8a5a2b' : '#fff',
      faqList: (s.demoNew ? [] : s.faqs).map((f, i) => ({
        q: f.q,
        genLabel: f.used ? '已生成选题' : '生成选题',
        gen: () => {
          if (f.used) { this.setNav('topics'); return; }
          const faqs = s.faqs.map((x, j) => j === i ? Object.assign({}, x, { used: true }) : x);
          this.setState({ faqs, topics: [{ tag: '高频问答', title: f.q, src: '来自定位档案 · 刚刚生成' }].concat(s.topics) });
          this.showToast('已生成选题，去选题库查看');
        },
        del: () => {
          const faqs = s.faqs.filter((_, j) => j !== i);
          const topics = s.topics.map((tp) => tp.title === f.q ? Object.assign({}, tp, { src: '原问答已删除' }) : tp);
          this.setState({ faqs, topics });
          this.showToast('问答已删 · 已生成的选题还在，并标「原问答已删除」');
        },
      })),
      homeKbN: s.demoNew ? 0 : s.kbDocs.length,
      homeTopicN: s.demoNew ? 0 : s.topics.length,
      homeAdoptN: s.demoNew ? 0 : s.history.filter((h) => h.date === '今天' || h.kind === 'pending').length,""",
    1,
)

t = t.replace(
    """      adopt: () => {
        if (s.adopted) return;
        const title = (s.topic || '未命名选题').slice(0, 24);
        this.setState({
          adopted: true,
          history: [{ title, platform: '待发布', status: '已采用', date: '今天', views: '—', likes: '—', kind: 'pending' }].concat(s.history),
          kbDocs: [{
            title, source: '平台生成', status: '未发布', updated: '今天', words: 486,
            excerpt: '同样一套柜子，别人报 3 万，我报 1 万 6，是我在亏本做慈善吗？不是，今天把报价单拆开给你看。',
          }].concat(s.kbDocs),
        });
        this.showToast('已采用并存入知识库 · 发布后回来登记链接，再点「复盘」看数据');
      },""",
    """      adopt: () => {
        const key = s.platform === 'douyin' ? 'adoptedDy' : 'adoptedGzh';
        if (s[key]) return;
        const plat = s.platform === 'douyin' ? '抖音' : '视频号';
        const title = ((s.topic || '未命名选题').slice(0, 20)) + ' · ' + plat;
        const patch = { [key]: true, adopted: s.platform === 'douyin' ? true : s.adopted };
        this.setState(Object.assign({
          history: [{ title, platform: plat, status: '已采用', date: '今天', views: '—', likes: '—', kind: 'pending' }].concat(s.history),
          kbDocs: [{
            title, source: '平台生成', status: '未发布', updated: '今天', words: 486,
            excerpt: '同样一套柜子，别人报 3 万，我报 1 万 6，是我在亏本做慈善吗？不是，今天我把报价单拆开给你看。',
          }].concat(s.kbDocs),
        }, patch));
        this.showToast('已采用' + plat + '版并存入知识库 · 登记链接后再点「复盘」');
      },""",
    1,
)

t = t.replace(
    """      adopted: s.adopted,
      adoptBg: s.adopted ? '#4a8c5c' : '#8a5a2b',
      adoptLabel: s.adopted ? '✓ 已采用' : '直接采用',""",
    """      adopted: s.platform === 'douyin' ? s.adoptedDy : s.adoptedGzh,
      adoptBg: (s.platform === 'douyin' ? s.adoptedDy : s.adoptedGzh) ? '#4a8c5c' : '#8a5a2b',
      adoptLabel: (s.platform === 'douyin' ? s.adoptedDy : s.adoptedGzh) ? '已采用' : (s.platform === 'douyin' ? '采用抖音版' : '采用视频号版'),""",
    1,
)

# topicList highlight for freshly generated
t = t.replace(
    "        return { tag: t.tag, title: t.title, src: t.src, tagColor: c[0], tagBorder: c[1], tagBg: c[2], go: () => this.pickTopic(t.title) };",
    "        return { tag: t.tag, title: t.title, src: t.src, tagColor: c[0], tagBorder: c[1], tagBg: c[2], go: () => this.pickTopic(t.title) };",
    1,
)

p.write_text(t)
print("patched", p, "chars", len(t))
