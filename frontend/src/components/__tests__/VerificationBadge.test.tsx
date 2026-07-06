import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerificationBadge from '../VerificationBadge';

describe('VerificationBadge', () => {
  it('renders verified state', () => {
    render(<VerificationBadge isVerified={true} />);
    expect(screen.getByText('verification.verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Verified')).toBeInTheDocument();
  });

  it('renders not verified state', () => {
    render(<VerificationBadge isVerified={false} />);
    expect(screen.getByText('verification.unverified')).toBeInTheDocument();
    expect(screen.getByLabelText('Not Verified')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<VerificationBadge isVerified={true} showLabel={false} />);
    expect(screen.queryByText('verification.verified')).not.toBeInTheDocument();
  });
});
