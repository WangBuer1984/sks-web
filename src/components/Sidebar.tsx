import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, type MeResponse } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useRechargeStore } from '../store/recharge';

/**
 * App 持久侧边栏——对齐原型「侧边栏」段（`prototypes/extracted/sections/06-侧边栏.html`）。
 *
 * <p>结构与取值均来自原型：216px 定宽、暖炭底 {@code #23231f}、七项导航、底部额度卡 + 头像块。
 * 原型此处是每页各自重复一份静态标记；这里收成单个共享组件，由 {@link AppLayout} 挂载，
 * 避免像先前那样每页手写一行 ad-hoc 链接。
 */

/** 导航项。全部已实现（positioning/topics 在基础地基 commit 落地）。`ready` 留作将来占位标记。 */
const NAV: { to: string; label: string; ready: boolean }[] = [
  { to: '/workbench', label: '工作台', ready: true },
  { to: '/positioning', label: '账号定位', ready: true },
  { to: '/topics', label: '选题库', ready: true },
  { to: '/create', label: '文案创作', ready: true },
  { to: '/analyze', label: '对标拆解', ready: true },
  { to: '/kb', label: '知识库', ready: true },
  { to: '/review', label: '发布复盘', ready: true },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const logoutUser = useAuthStore((s) => s.logoutUser);
  const openRecharge = useRechargeStore((s) => s.open);

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 30_000,
  });

  const balance = me?.balance ?? 0;
  const totalQuota = me?.totalQuota ?? 0;
  // 进度条分母 = 历史入账总额（后端 totalCredited：credit+refund 的 delta 之和），非写死 50——
  // p150 用户不再「满格却还剩额度」。totalQuota=0（无入账）时条宽 0。
  const barWidth = totalQuota > 0 ? Math.min(100, (balance / totalQuota) * 100) : 0;
  const nickname = me?.nickname?.trim() || '未设昵称';
  const initial = nickname.slice(0, 1);

  const logout = () => {
    logoutUser();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="flex w-[216px] shrink-0 flex-col bg-paper-ink px-3 py-5 text-paper-shadeDeep">
      <div className="px-3 pb-[22px] pt-1 font-serif text-[22px] font-black tracking-label">
        随口说
      </div>

      <div className="flex flex-col gap-1">
        {NAV.map((item) =>
          item.ready ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-chip px-3 py-2.5 text-lead transition',
                  // 原型的选中态是模板变量（homeBg/homeColor），其取值未随存档持久化，
                  // 故这里按侧边栏自身已有的配色推断：hover 底 + 金色字。非原型原值。
                  isActive
                    ? 'bg-paper-coalHover text-paper-gold'
                    : 'text-paper-shadeDeep hover:bg-paper-coalHover',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ) : (
            <span
              key={item.to}
              title="此页尚未实现"
              aria-disabled="true"
              className="cursor-not-allowed rounded-chip px-3 py-2.5 text-lead text-paper-coalLine"
            >
              {item.label}
            </span>
          ),
        )}
      </div>

      <div className="mt-auto">
        <div className="mb-3.5 rounded-card bg-paper-coal p-3">
          <div className="mb-1.5 text-meta text-paper-mutedFaint">剩余额度</div>
          <div className="text-[18px] font-bold">
            {balance}
            {totalQuota > 0 && (
              <span className="ml-1 text-meta font-normal text-paper-mutedFaint">/ {totalQuota}</span>
            )}
            <span className="ml-1 text-meta font-normal text-paper-mutedFaint">条</span>
          </div>
          <div className="mt-2 h-1 rounded-sm bg-paper-coalLine2">
            <div
              className="h-1 rounded-sm bg-paper-gold transition-[width] duration-300"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <button
            type="button"
            onClick={openRecharge}
            className="mt-2.5 block w-full rounded-chip border border-paper-gold py-[7px] text-center text-meta text-paper-gold hover:bg-paper-coalHover hover:text-paper-gold"
          >
            联系我充值
          </button>
        </div>

        <div className="flex items-center gap-2.5 rounded-card p-2">
          <NavLink to="/profile" className="flex flex-1 items-center gap-2.5 hover:text-paper-shadeDeep">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-gold text-lead font-bold text-paper-ink">
              {initial}
            </div>
            <div className="flex-1">
              <div className="text-copy font-medium">{nickname}</div>
              <div className="text-hint text-paper-mutedFaint">
                资料完善度 {me?.completeness ?? 0}%
              </div>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="text-[11.5px] text-paper-mutedFaint hover:text-paper-shadeDeep"
          >
            退出
          </button>
        </div>
      </div>
    </nav>
  );
}
