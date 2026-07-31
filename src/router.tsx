import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Workbench from './pages/Workbench';
import KB from './pages/KB';
import Create from './pages/Create';
import Calibrate from './pages/Calibrate';
import Analyze from './pages/Analyze';
import Review from './pages/Review';
import AdminLogin from './pages/admin/AdminLogin';
import AdminConsole from './pages/admin/AdminConsole';
import AppLayout from './components/AppLayout';
import { useAuthStore } from './store/auth';

/**
 * 路由表 + 守卫。
 *
 * <p>结构对齐原型的两支顶层显隐：`{{ isLanding }}`（公开落地页）与 `{{ isApp }}`（登录后外壳）。
 * <ul>
 *   <li>C 端公开：`/` 落地页、`/login` 登录
 *   <li>C 端应用：`/workbench` 等挂在 {@link AppLayout} 下（共享侧边栏），需 user token
 *   <li>管理端：`/admin/login` 登录，`/admin` 后台，需 admin token
 * </ul>
 *
 * <p><b>`/` 语义已变</b>：原先是工作台（无 token 直接被甩到 `/login`，等于没有前门），
 * 现在是落地页，工作台移到 `/workbench`。{@link Login} 登录成功后也跟着跳 `/workbench`。
 *
 * <p>401 拦截器也会清 token + 跳登录（双重保险：守卫拦前端导航，拦截器拦后端 401）。
 */
function RequireUser({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.userToken);
  const location = useLocation();
  if (!token) {
    // 存下原目标，交给 Login 的 sks_return_to 逻辑回跳——否则深链接进受保护页会丢目标。
    localStorage.setItem('sks_return_to', location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.adminToken);
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireUser>
            <AppLayout />
          </RequireUser>
        }
      >
        <Route path="/workbench" element={<Workbench />} />
        {/* 校准对话原型里不在侧边栏（从工作台/账号定位进），但保留独立路由 */}
        <Route path="/calibrate" element={<Calibrate />} />
        <Route path="/create" element={<Create />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/kb" element={<KB />} />
        <Route path="/review" element={<Review />} />
      </Route>

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireAdmin><AdminConsole /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
