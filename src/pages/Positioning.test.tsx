// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Positioning from './Positioning';
import * as profileApi from '../api/profile';

/**
 * 定位页的两处竞态 / 精确性要求（review M3 / M4）——只有真实点击顺序能证伪：
 *
 * <ul>
 *   <li>保存进行中点「取消」：纯函数测不出来。前端能丢掉本地草稿，但已发出的 PUT 拦不住，
 *       成功回调照样写服务端并 invalidate，于是「取消不发请求、不改 cache」在最容易出现的
 *       异步竞态下不成立。
 *   <li>失效必须 `exact`：FAQ 与回放都挂在 `['profile', …]` 下，不带 exact 会顺手重拉整棵子树。
 * </ul>
 */

vi.mock('../api/profile', async () => {
  const actual = await vi.importActual<typeof profileApi>('../api/profile');
  return {
    ...actual,
    getActiveProfile: vi.fn(),
    interviewHistory: vi.fn(),
    listFaqs: vi.fn(),
    createFaq: vi.fn(),
    updateFaq: vi.fn(),
    deleteFaq: vi.fn(),
    reorderFaqs: vi.fn(),
    createTopicFromFaq: vi.fn(),
    updateProfileFields: vi.fn(),
    acceptVoiceSuggestion: vi.fn(),
    dismissVoiceSuggestion: vi.fn(),
  };
});

const api = vi.mocked(profileApi);

const PROFILE: profileApi.ActiveProfileView = {
  calibrated: true,
  version: 1,
  calibratedAt: '2026-08-01T00:00:00Z',
  content: {
    persona: '工厂老板娘',
    targetAudience: '业主',
    differentiation: '敢报真价',
    conversionPath: '私信要模板',
    tone: '直白',
    redlines: ['不诋毁同行', '不承诺零甲醛'],
    contentPillars: ['报价拆解 40%', '工艺科普 30%', '客户案例 20%', '产品种草 10%'],
  },
};

const FAQS: profileApi.FaqView[] = [
  { id: 11, question: '报价为什么差一倍', answer: '看板材与五金', sortOrder: 0, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 12, question: '工期一般多久', answer: null, sortOrder: 1, updatedAt: '2026-08-01T00:00:00Z' },
];

let queryClient: QueryClient;

function renderPage() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Positioning />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

beforeEach(() => {
  api.getActiveProfile.mockResolvedValue(PROFILE);
  api.interviewHistory.mockResolvedValue({ found: false, turns: [] });
  api.listFaqs.mockResolvedValue(FAQS);
  api.updateProfileFields.mockResolvedValue(PROFILE);
  api.createFaq.mockResolvedValue(99);
  api.deleteFaq.mockResolvedValue(undefined);
  api.createTopicFromFaq.mockResolvedValue(77);
});

afterEach(() => {
  // vitest 未开 globals，testing-library 的自动 cleanup 不会注册——不手工卸载会串味
  cleanup();
  vi.clearAllMocks();
});

describe('定位页：保存竞态与精确失效', () => {
  it('红线中点连写，内容支柱独立成配比条', async () => {
    renderPage();
    expect(await screen.findByText('不诋毁同行 · 不承诺零甲醛')).toBeTruthy();
    expect(screen.getByText('选题库按此配比推荐')).toBeTruthy();
    expect(screen.getByText('报价拆解')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.queryByText('观众常问的问题——每条都能一键变成选题')).toBeNull();
  });

  it('字段保存进行中，取消按钮被禁用', async () => {
    const user = userEvent.setup();
    let release: (v: profileApi.ActiveProfileView) => void = () => {};
    api.updateProfileFields.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: '编辑档案' }));
    const toneBox = screen.getByLabelText(/口吻/);
    await user.clear(toneBox);
    await user.type(toneBox, '更直白');
    await user.click(screen.getByRole('button', { name: '保存' }));

    const cancel = screen.getByRole('button', { name: '取消' });
    await waitFor(() => expect((cancel as HTMLButtonElement).disabled).toBe(true));
    await user.click(cancel);
    expect(screen.getByLabelText(/口吻/)).toBeTruthy(); // 还在编辑态：草稿没被悄悄丢掉

    release(PROFILE);
    await waitFor(() => expect(screen.queryByLabelText(/口吻/)).toBeNull());
  });

  it('新增 FAQ 成功后精确失效 ["profile","faqs"]', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage();
    await screen.findByText('报价为什么差一倍');

    await user.type(screen.getByPlaceholderText(/再加一句/), '订金能退吗');
    invalidateSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '添加问答' }));

    await waitFor(() => expect(api.createFaq).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile', 'faqs'], exact: true });
  });

  it('删除 FAQ 成功后精确失效 ["profile","faqs"]', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage();
    await screen.findByText('报价为什么差一倍');
    invalidateSpy.mockClear();

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    expect(api.deleteFaq).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(api.deleteFaq).toHaveBeenCalledWith(11));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile', 'faqs'], exact: true });
  });

  it('FAQ 生成选题成功后精确失效 ["topics"]，并渲染刚生成链接', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage();
    await screen.findByText('报价为什么差一倍');
    invalidateSpy.mockClear();

    await user.click(screen.getAllByRole('button', { name: '生成选题' })[0]);

    await waitFor(() => expect(api.createTopicFromFaq).toHaveBeenCalledWith(11));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['topics'], exact: true });
    const link = await screen.findByRole('link', { name: '去选题库看刚生成的那条' });
    expect(link.getAttribute('href')).toBe('/topics?fresh=77');

    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(api.deleteFaq).toHaveBeenCalledWith(11));
    expect(screen.getByRole('link', { name: '去选题库看刚生成的那条' }).getAttribute('href')).toBe(
      '/topics?fresh=77',
    );
  });

  it('普通「编辑后取消」仍然不发请求、不动 cache', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPage();
    await user.click(await screen.findByRole('button', { name: '编辑档案' }));
    const toneBox = screen.getByLabelText(/口吻/);
    await user.clear(toneBox);
    await user.type(toneBox, '换个口吻');
    invalidateSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(api.updateProfileFields).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
