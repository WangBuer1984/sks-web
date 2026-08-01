import { create } from 'zustand';

/**
 * 充值引导弹窗 store（Zustand）：任意组件（侧边栏「联系我充值」、工作台「查看二维码」、
 * 登录引导等）都能触发 open()，弹窗由 AppLayout 单实例挂载，避免每处各写一份。
 * 无 C 端自助充值 API（充值由管理端开通，见 sks-server RechargeOrderService），
 * 弹窗仅展示微信二维码 + 微信号 + 开通说明。
 */
interface RechargeState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useRechargeStore = create<RechargeState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
