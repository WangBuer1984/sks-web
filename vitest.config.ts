import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * 默认 `node` 环境：绝大多数用例测的是纯函数（api 形状、pure helpers），不需要 DOM，也不该为它付启动成本。
 *
 * <p>组件用例（`*.test.tsx`）在文件顶部用 `// @vitest-environment jsdom` 单独声明——
 * 「保存中不能取消」「取消不发请求」这类行为只有真实点击顺序才能证伪，纯函数替身证明不了。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
