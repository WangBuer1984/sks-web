/**
 * 随口说标志：主色印面里一个纸色「口」。
 * 和 `public/favicon.svg` / `public/logo.svg` 同一套路径，部署后域名标签页也用它。
 */
export default function BrandMark({
  size = 28,
  className = '',
  title = '随口说',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" fill="#8a5a2b" />
      <path fill="#f4f1e9" d="M8 7.5h16v17H8z" />
      <path fill="#8a5a2b" d="M11.6 11h8.8v10H11.6z" />
    </svg>
  );
}
