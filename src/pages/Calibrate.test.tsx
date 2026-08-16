// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Calibrate from './Calibrate';
import * as profileApi from '../api/profile';

/**
 * 校准页确认生效（review M3）：**先精确失效 `['profile']` 与 `['profile','faqs']`，再导航**。
 *
 * <p>先导航的话，工作台/定位页会先渲染 cache 里的旧档案与旧 FAQ，一致性变成「靠下一次挂载碰巧重取」
 * ——而不是由写操作负责维护。这条只能用真实点击验证：断言点落在「invalidate 发生时还没导航」。
 */

vi.mock('../api/profile', async () => {
  const actual = await vi.importActual<typeof profileApi>('../api/profile');
  return {
    ...actual,
    interviewStep: vi.fn(),
    confirmProfile: vi.fn(),
    sampleOpening: vi.fn(),
  };
});

const api = vi.mocked(profileApi);

const DONE_STEP: profileApi.InterviewStepView = {
  stage: 'summarize',
  question: null,
  profileDraft: {
    profile: {
      persona: '工厂老板娘',
      targetAudience: '业主',
      differentiation: '敢报真价',
      conversionPath: '私信要模板',
      tone: '直白',
      redlines: ['不诋毁同行'],
      contentPillars: ['报价拆解'],
    },
    faq_candidates: [{ question: '报价为什么差一倍', answer: '看板材与五金' }],
  },
  done: true,
  blocked: false,
  banner: '定位校准已完成，待确认生效',
};

beforeEach(() => {
  api.interviewStep.mockResolvedValue(DONE_STEP);
  api.confirmProfile.mockResolvedValue(undefined);
  api.sampleOpening.mockRejectedValue(new Error('样例静默失败')); // 不影响 confirm
});

afterEach(() => {
  // vitest 未开 globals，testing-library 的自动 cleanup 不会注册——不手工卸载会串味
  cleanup();
  vi.clearAllMocks();
});

describe('校准确认生效', () => {
  it('confirm 成功后先精确失效 profile / faqs，再导航到工作台', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const seen: { key: unknown; exact: unknown; navigated: boolean }[] = [];
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters?: never) => {
      const f = filters as unknown as { queryKey?: unknown; exact?: boolean } | undefined;
      seen.push({
        key: f?.queryKey,
        exact: f?.exact,
        // 失效发生的那一刻，工作台还不该被渲染出来
        navigated: screen.queryByText('工作台占位') != null,
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/calibrate']}>
          <Routes>
            <Route path="/calibrate" element={<Calibrate />} />
            <Route path="/workbench" element={<div>工作台占位</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: '没有素材，直接聊' }));
    const confirmBtn = await screen.findByRole('button', { name: '确认档案，开始创作' });
    await user.click(confirmBtn);

    await waitFor(() => expect(api.confirmProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('工作台占位')).toBeTruthy());

    expect(seen.map((s) => [s.key, s.exact])).toEqual([
      [['profile'], true],
      [['profile', 'faqs'], true],
    ]);
    expect(seen.every((s) => !s.navigated)).toBe(true);
  });

  it('勾中的候选才进 confirm：默认一条不勾', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/calibrate']}>
          <Routes>
            <Route path="/calibrate" element={<Calibrate />} />
            <Route path="/workbench" element={<div>工作台占位</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: '没有素材，直接聊' }));
    await user.click(await screen.findByRole('button', { name: '确认档案，开始创作' }));

    await waitFor(() => expect(api.confirmProfile).toHaveBeenCalledTimes(1));
    expect(api.confirmProfile.mock.calls[0][2]).toEqual([]);
  });
});
