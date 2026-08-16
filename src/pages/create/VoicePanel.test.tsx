// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VoicePanel from './VoicePanel';
import * as profileApi from '../../api/profile';

/**
 * 创作页「人设声音」面板（D19：档案是唯一真源，创作页只投影三字段）。
 *
 * <p>这些用例点的是真按钮、读的是真渲染结果——因为要证明的恰恰是「用户能看到、能改、改的是同一份档案」。
 * 只断言常量是三项、API 能发三项的测试，在 UI 完全缺失时照样绿。
 */

vi.mock('../../api/profile', async () => {
  const actual = await vi.importActual<typeof profileApi>('../../api/profile');
  return {
    ...actual,
    getActiveProfile: vi.fn(),
    updateProfileFields: vi.fn(),
  };
});

const getActiveProfile = vi.mocked(profileApi.getActiveProfile);
const updateProfileFields = vi.mocked(profileApi.updateProfileFields);

const PROFILE: profileApi.ActiveProfileView = {
  calibrated: true,
  version: 2,
  calibratedAt: '2026-08-01T00:00:00Z',
  content: {
    persona: '佛山做了 12 年全屋定制的工厂老板娘',
    targetAudience: '怕被装修公司坑的业主',
    differentiation: '敢把真实报价拆开摆出来',
    conversionPath: '私信要报价单模板',
    tone: '直白、爱举例、不端着',
    redlines: ['不诋毁同行', '不承诺最低价'],
    contentPillars: ['报价拆解', '工艺细节'],
  },
};

let queryClient: QueryClient;

function renderPanel() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    invalidateSpy: vi.spyOn(queryClient, 'invalidateQueries'),
    ...render(
      <QueryClientProvider client={queryClient}>
        {/* 未校准态里有「去校准定位」链接，需要 router 上下文（真实使用中创作页也在 router 内） */}
        <MemoryRouter>
          <VoicePanel />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  getActiveProfile.mockResolvedValue(PROFILE);
  updateProfileFields.mockResolvedValue(PROFILE);
});

afterEach(() => {
  // vitest 未开 globals，testing-library 的自动 cleanup 不会注册——不手工卸载会串味
  cleanup();
  vi.clearAllMocks();
});

describe('创作页人设声音面板', () => {
  it('只展示人设 / 口吻 / 红线三项，其余四个字段不出现在创作页', async () => {
    renderPanel();
    expect(await screen.findByText('佛山做了 12 年全屋定制的工厂老板娘')).toBeTruthy();
    expect(screen.getByText('直白、爱举例、不端着')).toBeTruthy();
    expect(screen.getByText('不诋毁同行')).toBeTruthy();

    // 创作页只关心「怎么说」，不该把整份档案搬过来——那是定位页的职责
    expect(screen.queryByText('怕被装修公司坑的业主')).toBeNull();
    expect(screen.queryByText('敢把真实报价拆开摆出来')).toBeNull();
    expect(screen.queryByText('私信要报价单模板')).toBeNull();
    expect(screen.queryByText('报价拆解')).toBeNull();
  });

  it('保存只提交改动的那一项，且只可能是三字段之一', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPanel();
    await user.click(await screen.findByRole('button', { name: '编辑' }));

    const toneBox = screen.getByLabelText('口吻');
    await user.clear(toneBox);
    await user.type(toneBox, '更直白一点');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(updateProfileFields).toHaveBeenCalledTimes(1));
    expect(updateProfileFields).toHaveBeenCalledWith({ tone: '更直白一点' });
    // 成功后精确失效档案本身：FAQ / 回放挂在 ['profile', …] 下，改口吻不该顺手重拉它们
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile'], exact: true });
  });

  it('编辑框只有三项，不给创作页塞进第四个字段', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: '编辑' }));

    expect(screen.getByLabelText('人设')).toBeTruthy();
    expect(screen.getByLabelText('口吻')).toBeTruthy();
    expect(screen.getByLabelText(/红线/)).toBeTruthy(); // 标签带「（一行一条）」提示
    expect(screen.queryByLabelText('目标人群')).toBeNull();
    expect(screen.queryByLabelText(/内容支柱/)).toBeNull();
  });

  it('取消不发请求、不动 Query cache，且改动被丢掉', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderPanel();
    await user.click(await screen.findByRole('button', { name: '编辑' }));

    const toneBox = screen.getByLabelText('口吻');
    await user.clear(toneBox);
    await user.type(toneBox, '改成另一种口吻');
    invalidateSpy.mockClear();
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(updateProfileFields).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(screen.getByText('直白、爱举例、不端着')).toBeTruthy(); // 回到原值
  });

  it('一处没改就点保存：不发请求，直接退出编辑', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: '编辑' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(updateProfileFields).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText('口吻')).toBeNull());
  });

  it('保存进行中：取消被禁用（点了也不会丢掉正在提交的改动）', async () => {
    const user = userEvent.setup();
    let release: (v: profileApi.ActiveProfileView) => void = () => {};
    updateProfileFields.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );

    renderPanel();
    await user.click(await screen.findByRole('button', { name: '编辑' }));
    const toneBox = screen.getByLabelText('口吻');
    await user.clear(toneBox);
    await user.type(toneBox, '更直白一点');
    await user.click(screen.getByRole('button', { name: '保存' }));

    const cancel = await screen.findByRole('button', { name: '取消' });
    await waitFor(() => expect((cancel as HTMLButtonElement).disabled).toBe(true));
    await user.click(cancel);
    expect(screen.getByLabelText('口吻')).toBeTruthy(); // 仍在编辑态，草稿没被丢

    release(PROFILE);
    await waitFor(() => expect(screen.queryByLabelText('口吻')).toBeNull());
  });

  it('未校准：给一句引导而不是空面板，也不提供编辑入口', async () => {
    getActiveProfile.mockResolvedValue({
      calibrated: false,
      version: null,
      calibratedAt: null,
      content: {},
    });
    renderPanel();
    expect(await screen.findByText(/还没有定位档案/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
  });

  it('旧中文键档案照样展示（老档案不迁移）', async () => {
    getActiveProfile.mockResolvedValue({
      calibrated: true,
      version: 1,
      calibratedAt: null,
      content: { 人设: '老档案人设', 口吻: '老档案口吻', 红线: '不夸大功效' },
    });
    renderPanel();
    expect(await screen.findByText('老档案人设')).toBeTruthy();
    expect(screen.getByText('老档案口吻')).toBeTruthy();
    expect(screen.getByText('不夸大功效')).toBeTruthy();
  });
});
