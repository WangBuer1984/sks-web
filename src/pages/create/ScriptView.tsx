import SectionEditor from './SectionEditor';
import { parseSection, type ScriptDetail } from '../../api/script';
import { type Platform } from '../../api/content';
import { adoptButtonLabel, platformTabLabel } from '../createMode';
import { type SectionKey } from './types';

const TABS: Platform[] = ['douyin', 'channels'];
const SECTIONS: SectionKey[] = ['hook', 'body', 'cta'];

export interface ScriptViewProps {
  script: ScriptDetail | null;
  platform: Platform;
  missingChannels: boolean;
  lazyLoading?: boolean;
  lazyHint?: string | null;
  adopted?: boolean;
  onPlatform: (p: Platform) => void;
  onAdopt: () => void;
  onRegenerate: () => void;
  onEdited: (s: ScriptDetail) => void;
}

export default function ScriptView({
  script,
  platform,
  missingChannels,
  lazyLoading,
  lazyHint,
  adopted,
  onPlatform,
  onAdopt,
  onRegenerate,
  onEdited,
}: ScriptViewProps) {
  const fullText = script
    ? SECTIONS.map((k) => parseSection(script[k]).map((s) => s.text).join('')).join('\n')
    : '';
  return (
    <div className="overflow-hidden rounded-block border border-paper-line bg-paper-card">
      <div className="flex border-b border-paper-line bg-paper-sunken">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPlatform(id)}
            className={
              platform === id
                ? 'border-b-2 border-paper-primary px-5 py-3 text-body font-bold text-paper-primary'
                : 'px-5 py-3 text-body text-paper-inkSoft hover:text-paper-primary'
            }
          >
            {platformTabLabel(id, id === 'channels' && missingChannels)}
          </button>
        ))}
      </div>
      <div className="px-[26px] py-6">
        {lazyHint && (
          <p className="mb-3 text-caption text-paper-muted">{lazyHint}</p>
        )}
        {lazyLoading && (
          <p className="py-8 text-center text-body text-paper-muted">正在生成视频号版，不另扣额度…</p>
        )}
        {script && !lazyLoading && (
          <>
            {script.dedupWarnScriptId != null && (
              <div className="mb-[18px] rounded-chip border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-2.5 text-caption leading-normal text-paper-danger">
                本稿与历史稿件 #{script.dedupWarnScriptId} 相似度较高——可「换个角度」重写，或继续采用。
              </div>
            )}
            <div className="flex flex-col gap-5">
              {SECTIONS.map((k) => (
                <SectionEditor
                  key={`${script.id}-${k}`}
                  scriptId={script.id}
                  section={k}
                  sentences={parseSection(script[k])}
                  onEdited={onEdited}
                />
              ))}
            </div>
            <div className="mt-[22px] flex flex-wrap gap-2.5 border-t border-paper-tintDeep pt-[18px]">
              <button
                type="button"
                onClick={onAdopt}
                disabled={adopted}
                className="rounded-card bg-paper-primary px-5 py-2.5 text-body font-medium text-white hover:bg-paper-primaryHover disabled:opacity-45"
              >
                {adopted ? '已采用此版本' : adoptButtonLabel(platform)}
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
              >
                换个角度
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(fullText)}
                className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
              >
                复制全文
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
