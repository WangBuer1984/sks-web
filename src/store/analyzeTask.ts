import { create } from 'zustand';

/**
 * 拆解任务 store（Zustand）：持久化「最后一次拆解任务的 taskId」到 localStorage。
 *
 * 解决「切到别的功能模块再切回来 / 刷新，拆解页面空白无进度」：原实现 taskId 仅存
 * 在 ``Analyze.tsx`` 的 ``useState`` 里，组件 unmount 即丢。本 store 把 taskId 落
 * localStorage（键 ``sks_analyze_task``），与 ``store/auth.ts`` 的 token bootstrap
 * 同模式——init 读、action 写、clear 删。
 *
 * 恢复靠后端既有 ``GET /api/analyze/tasks/{id}``（轮询同接口）：mount 时 taskId
 * 非空 → ``useQuery`` 自动 fire → 拉回 status/progress/result/videos → 页面恢复。
 * 不存表单内容，避免误触重复扣费（拆账号扣 10 条）。
 *
 * 不在终态（done/partial/failed）自动 clear：让「最后一次操作的数据」一直留着，
 * 用户开新任务或切 tab 时覆写。恢复 fetch 彻底失败（404/换号）由 ``Analyze.tsx``
 * 的 effect 调 ``clear()``。
 */
const ANALYZE_TASK_KEY = 'sks_analyze_task';

function loadTaskId(): number | null {
  const raw = localStorage.getItem(ANALYZE_TASK_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface AnalyzeTaskState {
  taskId: number | null;
  setTaskId: (id: number) => void;
  clear: () => void;
}

export const useAnalyzeTaskStore = create<AnalyzeTaskState>((set) => ({
  taskId: loadTaskId(),
  setTaskId: (id) => {
    localStorage.setItem(ANALYZE_TASK_KEY, String(id));
    set({ taskId: id });
  },
  clear: () => {
    localStorage.removeItem(ANALYZE_TASK_KEY);
    set({ taskId: null });
  },
}));
