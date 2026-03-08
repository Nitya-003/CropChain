/**
 * Role-Based Access Control (RBAC) Permissions and Roles
 * 
 * This module defines granular permissions and role-based access control
 * for the CropChain platform. High-stakes actions require multi-signature
 * approval to prevent unauthorized operations.
 */

// ==================== PERMISSIONS ====================

/**
 * Granular permissions for all platform actions
 * Each permission follows the pattern: resource:action
 */
const PERMISSIONS = {
    // Batch permissions
    BATCH_CREATE: 'batch:create',
    BATCH_READ: 'batch:read',
    BATCH_UPDATE: 'batch:update',
    BATCH_DELETE: 'batch:delete',
    BATCH_VIEW_ALL: 'batch:view_all',
    
    // High-stakes batch actions (require multi-signature)
    BATCH_RECALL: 'batch:recall',
    BATCH_CONTAMINATED: 'batch:mark_contaminated',
    BATCH_FLAG: 'batch:flag',
    BATCH_DESTROY: 'batch:destroy',
    
    // Supply chain stage permissions
    STAGE_FARMER: 'stage:farmer',
    STAGE_MANDI: 'stage:mandi',
    STAGE_TRANSPORT: 'stage:transport',
    STAGE_RETAILER: 'stage:retailer',
    
    // User management permissions
    USER_CREATE: 'user:create',
    USER_READ: 'user:read',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user delete',
    USER_VERIFY: 'user:verify',
    USER_VIEW_ALL: 'user:view_all',
    
    // Inspector permissions
    INSPECTOR_APPROVE_RECALL: 'inspector:approve_recall',
    INSPECTOR_APPROVE_CONTAMINATED: 'inspector:approve_contaminated',
    INSPECTOR_APPROVE_FLAG: 'inspector:approve_flag',
    INSPECTOR_APPROVE_DESTROY: 'inspector:approve_destroy',
    
    // Admin permissions
    ADMIN_MANAGE_ROLES: 'admin:manage_roles',
    ADMIN_VIEW_AUDIT_LOGS: 'admin:view_audit_logs',
    ADMIN_MANAGE_INSPECTORS: 'admin:manage_inspectors',
    ADMIN_SYSTEM_CONFIG: 'admin:system_config',
    
    // Blockchain permissions
    BLOCKCHAIN_TRANSACTION: 'blockchain:transaction',
    BLOCKCHAIN_VIEW_PENDING: 'blockchain:view_pending',
    
    // Cross-chain permissions
    CROSSCHAIN_DISPATCH: 'crosschain:dispatch',
    CROSSCHAIN_VIEW: 'crosschain:view'
};

// ==================== ROLES ====================

/**
 * Role definitions with associated permissions
 */
const ROLES = {
    FARMER: 'farmer',
    MANDI: 'mandi',
    TRANSPORTER: 'transporter',
    RETAILER: 'retailer',
    QUALITY_INSPECTOR: 'quality_inspector',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin'
};

/**
 * All valid roles array
 */
const VALID_ROLES = Object.values(ROLES);

/**
 * Permission sets for each role
 */
const ROLE_PERMISSIONS = {
    [ROLES.FARMER]: [
        PERMISSIONS.BATCH_CREATE,
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_UPDATE,
        PERMISSIONS.STAGE_FARMER,
        PERMISSIONS.BLOCKCHAIN_TRANSACTION
    ],
    
    [ROLES.MANDI]: [
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_UPDATE,
        PERMISSIONS.STAGE_MANDI,
        PERMISSIONS.BLOCKCHAIN_TRANSACTION
    ],
    
    [ROLES.TRANSPORTER]: [
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_UPDATE,
        PERMISSIONS.STAGE_TRANSPORT,
        PERMISSIONS.BLOCKCHAIN_TRANSACTION
    ],
    
    [ROLES.RETAILER]: [
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_UPDATE,
        PERMISSIONS.STAGE_RETAILER,
        PERMISSIONS.BLOCKCHAIN_TRANSACTION,
        PERMISSIONS.CROSSCHAIN_DISPATCH
    ],
    
    [ROLES.QUALITY_INSPECTOR]: [
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_VIEW_ALL,
        PERMISSIONS.INSPECTOR_APPROVE_RECALL,
        PERMISSIONS.INSPECTOR_APPROVE_CONTAMINATED,
        PERMISSIONS.INSPECTOR_APPROVE_FLAG,
        PERMISSIONS.INSPECTOR_APPROVE_DESTROY,
        PERMISSIONS.USER_VERIFY
    ],
    
    [ROLES.ADMIN]: [
        // All batch permissions
        PERMISSIONS.BATCH_CREATE,
        PERMISSIONS.BATCH_READ,
        PERMISSIONS.BATCH_UPDATE,
        PERMISSIONS.BATCH_DELETE,
        PERMISSIONS.BATCH_VIEW_ALL,
        PERMISSIONS.BATCH_FLAG,
        
        // All stage permissions
        PERMISSIONS.STAGE_FARMER,
        PERMISSIONS.STAGE_MANDI,
        PERMISSIONS.STAGE_TRANSPORT,
        PERMISSIONS.STAGE_RETAILER,
        
        // User management
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_READ,
        PERMISSIONS.USER_UPDATE,
        PERMISSIONS.USER_DELETE,
        PERMISSIONS.USER_VIEW_ALL,
        PERMISSIONS.USER_VERIFY,
        
        // Admin permissions
        PERMISSIONS.ADMIN_VIEW_AUDIT_LOGS,
        PERMISSIONS.ADMIN_MANAGE_INSPECTORS,
        
        // Blockchain permissions
        PERMISSIONS.BLOCKCHAIN_TRANSACTION,
        PERMISSIONS.BLOCKCHAIN_VIEW_PENDING,
        
        // Cross-chain permissions
        PERMISSIONS.CROSSCHAIN_DISPATCH,
        PERMISSIONS.CROSSCHAIN_VIEW
    ],
    
    [ROLES.SUPER_ADMIN]: [
        // All permissions
        ...Object.values(PERMISSIONS)
    ]
};

// ==================== HIGH-STAKES ACTIONS ====================

/**
 * Actions that require multi-signature approval
 * These cannot be performed by a single user, even an admin
 */
const MULTISIG_ACTIONS = {
    BATCH_RECALL: {
        action: 'batch_recall',
        description: 'Recall a batch from the supply chain',
        requiredApprovals: parseInt(process.env.MULTISIG_RECALL_APPROVALS, 10) || 2,
        requiredRole: ROLES.QUALITY_INSPECTOR,
        expiresInHours: parseInt(process.env.MULTISIG_RECALL_EXPIRY, 10) || 24
    },
    BATCH_CONTAMINATED: {
        action: 'batch_contaminated',
        description: 'Mark a batch as contaminated',
        requiredApprovals: parseInt(process.env.MULTISIG_CONTAMINATED_APPROVALS, 10) || 3,
        requiredRole: ROLES.QUALITY_INSPECTOR,
        expiresInHours: parseInt(process.env.MULTISIG_CONTAMINATED_EXPIRY, 10) || 12
    },
    BATCH_DESTROY: {
        action: 'batch_destroy',
        description: 'Authorize batch destruction',
        requiredApprovals: parseInt(process.env.MULTISIG_DESTROY_APPROVALS, 10) || 3,
        requiredRole: ROLES.QUALITY_INSPECTOR,
        expiresInHours: parseInt(process.env.MULTISIG_DESTROY_EXPIRY, 10) || 24
    }
};

/**
 * Check if an action requires multi-signature approval
 */
function isMultisigAction(action) {
    return Object.keys(MULTISIG_ACTIONS).includes(action);
}

/**
 * Get multisig action configuration
 */
function getMultisigConfig(action) {
    return MULTISIG_ACTIONS[action] || null;
}

/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
    const permissions = getRolePermissions(role);
    return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
function hasAnyPermission(role, permissions) {
    const rolePermissions = getRolePermissions(role);
    return permissions.some(p => rolePermissions.includes(p));
}

/**
 * Check if a role has all of the specified permissions
 */
function hasAllPermissions(role, permissions) {
    const rolePermissions = getRolePermissions(role);
    return permissions.every(p => rolePermissions.includes(p));
}

/**
 * Check if user is an inspector
 */
function isInspector(role) {
    return role === ROLES.QUALITY_INSPECTOR;
}

/**
 * Check if user can approve multisig actions
 */
function canApproveMultisig(role, action) {
    const config = getMultisigConfig(action);
    if (!config) return false;
    
    if (role === ROLES.QUALITY_INSPECTOR) return true;
    if (role === ROLES.SUPER_ADMIN) return true;
    
    return false;
}

/**
 * Get role hierarchy level (higher = more privileged)
 */
function getRoleLevel(role) {
    const hierarchy = {
        [ROLES.FARMER]: 1,
        [ROLES.MANDI]: 2,
        [ROLES.TRANSPORTER]: 2,
        [ROLES.RETAILER]: 2,
        [ROLES.QUALITY_INSPECTOR]: 3,
        [ROLES.ADMIN]: 4,
        [ROLES.SUPER_ADMIN]: 5
    };
    return hierarchy[role] || 0;
}

/**
 * Check if role A is higher than role B
 */
function isRoleHigher(roleA, roleB) {
    return getRoleLevel(roleA) > getRoleLevel(roleB);
}

module.exports = {
    PERMISSIONS,
    ROLES,
    VALID_ROLES,
    ROLE_PERMISSIONS,
    MULTISIG_ACTIONS,
    isMultisigAction,
    getMultisigConfig,
    getRolePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isInspector,
    canApproveMultisig,
    getRoleLevel,
    isRoleHigher
};
