// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Landing from './Landing';

describe('Landing footer', () => {
  it('shows the ICP filing link under the existing credit line', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    expect(screen.getByText(/微信：suikoushuo-wang/)).toBeTruthy();

    const icp = screen.getByRole('link', { name: '鲁ICP备2026038792号' });
    expect(icp.getAttribute('href')).toBe('https://beian.miit.gov.cn/');
    expect(icp.getAttribute('target')).toBe('_blank');
    expect(icp.getAttribute('rel')).toBe('noreferrer');
    expect(icp.className).toMatch(/text-paper-mutedLight/);
    expect(icp.className).not.toMatch(/bg-paper-primary/);
  });
});
