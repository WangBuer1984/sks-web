import SectionEditor from './SectionEditor';
import { parseSection, type ScriptDetail } from '../../api/script';
import type { CardSummary } from '../../api/kb';
import { type SectionKey } from './types';

/**
 * 稿件视图——对齐原型 13 段 genDone 左卡：三平台 Tab（切换→重生）+ 查重黄条
 * （dedupWarnScriptId 命中、不阻断）+ 三段逐句编辑（SectionEditor，保留真 API）+
 * 采纳/换个角度/复制全文。内联下划线引用无 API 未做。
 */
const TABS: { id: 'douyin' | 'xhs' | 'gzh'; label: string }[] = [
  { id: 'douyin', label: '抖音口播稿' },
  { id: 'xhs', label: '小红书图文（切换时生成）' },
  { id: 'gzh', label: '视频号版（切换时生成）' },
];
const SECTIONS: SectionKey[] = ['hook', 'body', 'cta'];

export interface ScriptViewProps {
  script: ScriptDetail;
  bCards: CardSummary[];
  platform: 'douyin' | 'xhs' | 'gzh';
  onPlatform: (p: 'douyin' | 'xhs' | 'gzh') => void;
  onAdopt: () => void;
  onRegenerate: () => void;
  onEdited: (s: ScriptDetail) => void;
}

export default function ScriptView({
  script,
  bCards,
  platform,
  onPlatform,
  onAdopt,
  onRegenerate,
  onEdited,
}: ScriptViewProps) {
  const fullText = SECTIONS.map((k) => parseSection(script[k]).map((s) => s.text).join('')).join('\n');
  return (
    <div className="overflow-hidden rounded-block border border-paper-line bg-paper-card">
      <div className="flex border-b border-paper-line bg-paper-sunken">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPlatform(t.id)}
            className={
              platform === t.id
                ? 'border-b-2 border-paper-primary px-5 py-3 text-body font-bold text-paper-primary'
                : 'px-5 py-3 text-body text-paper-inkSoft hover:text-paper-primary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-[26px] py-6">
        {script.dedupWarnScriptId != null && (
          <div className="mb-[18px] rounded-chip border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-2.5 text-caption leading-normal text-paper-danger">
            本稿与历史稿件 #{script.dedupWarnScriptId} 相似度较高——可「换个角度」重写，或继续采用。
          </div>
        )}
        <div className="flex flex-col gap-5">
          {SECTIONS.map((k) => (
            <SectionEditor
              key={k}
              scriptId={script.id}
              section={k}
              sentences={parseSection(script[k])}
              onEdited={onEdited}
            />
          ))}
        </div>
        <div className="mt-[22px] flex gap-2.5 border-t border-paper-tintDeep pt-[18px]">
          <button type="button" onClick={onAdopt} className="rounded-card bg-paper-primary px-5 py-2.5 text-body font-medium text-white hover:bg-paper-primaryHover">采纳</button>
          <button type="button" onClick={onRegenerate} className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary">换个角度</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(fullText)} className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary">复制全文</button>
        </div>
      </div>
    </div>
  );
}
