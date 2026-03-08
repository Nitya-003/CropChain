import { useAuth } from '../context/AuthContext';

export type UserRole = 'farmer' | 'mandi' | 'transporter' | 'retailer' | 'admin' | '';

export interface RBACPermissions {
  canCreateBatch: boolean;
  canUpdateToMandi: boolean;
  canUpdateToTransport: boolean;
  canUpdateToRetailer: boolean;
  canViewAdminDashboard: boolean;
  canRecallBatch: boolean;
}

/**
 * Custom hook for Role-Based Access Control (RBAC)
 * Returns permissions based on the current user's role
 */
export const useRbac = () => {
  const { user } = useAuth();
  const userRole = user?.role || '';

  const permissions: RBACPermissions = {
    // Batch creation permissions
    canCreateBatch: userRole === 'farmer',
    
    // Stage update permissions
    canUpdateToMandi: userRole === 'mandi' || userRole === 'admin',
    canUpdateToTransport: userRole === 'transporter' || userRole === 'admin',
    canUpdateToRetailer: userRole === 'retailer' || userRole === 'admin',
    
    // Admin permissions
    canViewAdminDashboard: userRole === 'admin',
    canRecallBatch: userRole === 'admin',
  };

  /**
   * Check if user can update to a specific stage
   */
  const canUpdateToStage = (stage: string): boolean => {
    switch (stage.toLowerCase()) {
      case 'farmer':
        return userRole === 'farmer' || userRole === 'admin';
      case 'mandi':
        return userRole === 'mandi' || userRole === 'admin';
      case 'transport':
        return userRole === 'transporter' || userRole === 'admin';
      case 'retailer':
        return userRole === 'retailer' || userRole === 'admin';
      default:
        return false;
    }
  };

  /**
   * Get the next allowed stage for the current user
   */
  const getNextAllowedStage = (currentStage: string): string | null => {
    const stageFlow = {
      'farmer': 'mandi',
      'mandi': 'transport',
      'transport': 'retailer',
      'retailer': null // Final stage
    };

    const nextStage = stageFlow[currentStage as keyof typeof stageFlow];
    return nextStage && canUpdateToStage(nextStage) ? nextStage : null;
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.includes(userRole as UserRole);
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return userRole === role;
  };

  /**
   * Get user-friendly role name
   */
  const getRoleDisplayName = (): string => {
    const roleNames = {
      'farmer': 'Farmer',
      'mandi': 'Market',
      'transporter': 'Transporter',
      'retailer': 'Retailer',
      'admin': 'Administrator',
      '': 'Guest'
    };
    return roleNames[userRole as keyof typeof roleNames] || 'Unknown';
  };

  return {
    userRole,
    permissions,
    canUpdateToStage,
    getNextAllowedStage,
    hasAnyRole,
    hasRole,
    getRoleDisplayName,
  };
};
