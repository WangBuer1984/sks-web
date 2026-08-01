/** 创作页生成错误条（统一 danger 样式）。无 error → 不渲染。 */
export default function CreateProgress({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-[18px] rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-2.5 text-copy text-paper-danger"
    >
      {error}
    </div>
  );
}
