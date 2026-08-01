import { Outlet } from 'react-router-dom';
import RechargeDialog from './RechargeDialog';
import Sidebar from './Sidebar';

/**
 * App 外壳——对齐原型 `{{ isApp }}` 那层容器：
 * {@code display:flex; height:100vh; overflow:hidden} + 216px 侧边栏 + 主区域
 * （{@code flex:1; overflow-y:auto; padding:32px 40px}，见 sections/07-主区域.html）。
 *
 * <p>滚动只发生在主区域内，侧边栏固定不动——这是原型 {@code overflow:hidden} 的用意。
 * 由路由以 layout route 形式挂载，子页只写自己的内容，不再各自造壳。
 */
export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <Outlet />
      </main>
      <RechargeDialog />
    </div>
  );
}
