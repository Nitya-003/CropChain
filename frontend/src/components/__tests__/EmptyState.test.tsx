import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../common/EmptyState';
import { AlertCircle } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No items found" description="There are no items to display." />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display.')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        actionLabel="Add Item"
        onAction={handleAction}
      />
    );
    const button = screen.getByText('Add Item');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel is missing', () => {
    render(<EmptyState title="Empty" description="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        icon={AlertCircle}
      />
    );
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState title="Title" description="Desc" className="custom-class" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-class');
  });
});
