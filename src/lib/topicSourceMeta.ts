/** 选题四路来源标签。原型 tag 色是模板变量未持久化，按 paper 语义色分配（与 Topics 页一致）。 */
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  hot: { label: '历史热点', cls: 'border-paper-goldPale bg-paper-tint text-paper-primary' },
  faq: { label: '你的 FAQ', cls: 'border-paper-goldSoft bg-paper-sunken text-paper-gold' },
  benchmark: { label: '对标拆解', cls: 'border-paper-lineStrong bg-paper-sunken text-paper-info' },
  replay: { label: '爆款复盘', cls: 'border-paper-lineStrong bg-paper-successTint text-paper-success' },
};

export function topicSourceMeta(source: string): { label: string; cls: string } {
  return (
    SOURCE_META[source] ?? {
      label: source || '未分类',
      cls: 'border-paper-line bg-paper-sunken text-paper-muted',
    }
  );
}
