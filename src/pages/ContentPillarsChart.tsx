import { PILLAR_BAR_HEX, pillarDisplayRows } from './positioningMode';

/**
 * 定位页「内容支柱」——样式从原型 `11-账号定位.html` 原样搬过来（inline），
 * 不用 Tailwind 任意网格，避免条被排成一列或算不出宽度。
 */
export default function ContentPillarsChart({ items }: { items: string[] | string | null | undefined }) {
  const rows = pillarDisplayRows(
    Array.isArray(items) ? items : typeof items === 'string' ? [items] : [],
  );

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e2dccd',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        内容支柱{' '}
        <span style={{ fontSize: 11, color: '#8a8578', fontWeight: 400 }}>选题库按此配比推荐</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a09a8a' }}>档案里没有这一项</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {rows.map((row, i) => (
            <div
              key={`${row.name}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 40px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.name}
              </span>
              <div style={{ height: 8, background: '#f2efe6', borderRadius: 4, minWidth: 0 }}>
                <div
                  style={{
                    height: 8,
                    width: `${Math.max(0, Math.min(100, row.pct))}%`,
                    background: PILLAR_BAR_HEX[i % PILLAR_BAR_HEX.length],
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ color: '#8a8578', fontSize: 12 }}>{row.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
