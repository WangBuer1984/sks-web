// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandMark from './BrandMark';

describe('BrandMark', () => {
  it('renders the 口 seal with an accessible name', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toBe('随口说');
    expect(svg?.querySelectorAll('path')).toHaveLength(2);
    expect(svg?.querySelector('circle')).toBeNull();
  });
});
