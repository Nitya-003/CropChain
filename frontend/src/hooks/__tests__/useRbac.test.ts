import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRbac } from '../useRbac';

const mockUseAuth = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useRbac', () => {
  it('returns empty role and all false permissions when no user', () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useRbac());

    expect(result.current.userRole).toBe('');
    expect(result.current.permissions.canCreateBatch).toBe(false);
    expect(result.current.permissions.canViewAdminDashboard).toBe(false);
    expect(result.current.permissions.canRecallBatch).toBe(false);
  });

  it('farmer can create batches', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'farmer' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.permissions.canCreateBatch).toBe(true);
    expect(result.current.permissions.canUpdateToMandi).toBe(false);
  });

  it('mandi can update to mandi', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'mandi' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.permissions.canUpdateToMandi).toBe(true);
    expect(result.current.permissions.canUpdateToTransport).toBe(false);
  });

  it('transporter can update to transport', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'transporter' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.permissions.canUpdateToTransport).toBe(true);
    expect(result.current.permissions.canUpdateToRetailer).toBe(false);
  });

  it('retailer can update to retailer', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'retailer' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.permissions.canUpdateToRetailer).toBe(true);
  });

  it('admin has all permissions', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.permissions.canViewAdminDashboard).toBe(true);
    expect(result.current.permissions.canRecallBatch).toBe(true);
    expect(result.current.permissions.canUpdateToMandi).toBe(true);
    expect(result.current.permissions.canUpdateToTransport).toBe(true);
    expect(result.current.permissions.canUpdateToRetailer).toBe(true);
  });

  it('canUpdateToStage returns correct results', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'farmer' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.canUpdateToStage('farmer')).toBe(true);
    expect(result.current.canUpdateToStage('mandi')).toBe(false);
  });

  it('canUpdateToStage returns true for admin regardless of stage', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.canUpdateToStage('farmer')).toBe(true);
    expect(result.current.canUpdateToStage('mandi')).toBe(true);
    expect(result.current.canUpdateToStage('transport')).toBe(true);
    expect(result.current.canUpdateToStage('retailer')).toBe(true);
  });

  it('getNextAllowedStage returns correct next stage', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'mandi' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.getNextAllowedStage('farmer')).toBe('mandi');
    expect(result.current.getNextAllowedStage('mandi')).toBeNull();
  });

  it('getNextAllowedStage returns null for retailer (final stage)', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.getNextAllowedStage('retailer')).toBeNull();
  });

  it('hasRole checks specific role', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'farmer' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.hasRole('farmer')).toBe(true);
    expect(result.current.hasRole('admin')).toBe(false);
  });

  it('hasAnyRole returns true if user has any of the specified roles', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'transporter' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.hasAnyRole(['farmer', 'transporter', 'admin'])).toBe(true);
    expect(result.current.hasAnyRole(['farmer', 'mandi'])).toBe(false);
  });

  it('getRoleDisplayName returns correct display name', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'farmer' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.getRoleDisplayName()).toBe('Farmer');
  });

  it('getRoleDisplayName returns Guest for empty role', () => {
    mockUseAuth.mockReturnValue({ user: { role: '' } });

    const { result } = renderHook(() => useRbac());

    expect(result.current.getRoleDisplayName()).toBe('Guest');
  });
});
