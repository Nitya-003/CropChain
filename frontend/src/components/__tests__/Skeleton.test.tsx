import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Skeleton from '../Skeleton';

describe('Skeleton', () => {
  it('renders with default classes', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('animate-pulse');
    expect(div.className).toContain('bg-gray-200');
    expect(div.className).toContain('rounded-md');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('h-10');
    expect(div.className).toContain('w-full');
  });
});
