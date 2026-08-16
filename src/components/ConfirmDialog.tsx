/** 删除等危险操作的二次确认。对齐原型 `{{ confirmOpen }}` 弹窗。 */

export default function ConfirmDialog({
  title,
  hint,
  confirmLabel = '确认删除',
  pending = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  hint: string;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-[400px] rounded-block border border-paper-line bg-paper-card p-6">
        <h2 className="mb-2 font-serif text-sub font-black text-paper-ink">{title}</h2>
        <p className="mb-5 text-caption leading-normal text-paper-muted">{hint}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-card border border-paper-lineStrong px-5 py-2 text-copy text-paper-inkSoft hover:border-paper-primary disabled:opacity-45"
          >
            取消
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-card bg-paper-danger px-5 py-2 text-copy text-white hover:opacity-90 disabled:opacity-45"
          >
            {pending ? '删除中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
