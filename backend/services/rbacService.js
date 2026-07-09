/**
 * RBAC Service
 */

const {
    PERMISSIONS, ROLES, hasPermission, hasAnyPermission, hasAllPermissions,
    isMultisigAction, getMultisigConfig, canApproveMultisig, getRoleLevel, isRoleHigher
} = require('../constants/permissions');
const logger = require('../utils/logger');

class RBACService {
    static checkPermission(user, permission) {
        if (!user || !user.role) return false;
        if (hasPermission(user.role, permission)) return true;
        if (user.permissions && user.permissions.includes(permission)) return true;
        return false;
    }

    static checkAnyPermission(user, permissions) {
        if (!user || !user.role) return false;
        if (hasAnyPermission(user.role, permissions)) return true;
        if (user.permissions) return permissions.some(p => user.permissions.includes(p));
        return false;
    }

    static checkAllPermissions(user, permissions) {
        if (!user || !user.role) return false;
        const rolePerms = require('../constants/permissions').getRolePermissions(user.role);
        const userPerms = new Set([...rolePerms, ...(user.permissions || [])]);
        return permissions.every(p => userPerms.has(p));
    }

    static requiresMultisigApproval(action) {
        return isMultisigAction(action);
    }

    static getRequiredApprovals(action) {
        return getMultisigConfig(action);
    }

    static canUserApproveAction(user, action) {
        if (!user || !user.role) return { canApprove: false, reason: 'User not authenticated' };
        if (user.role !== ROLES.QUALITY_INSPECTOR && user.role !== ROLES.SUPER_ADMIN) {
            return { canApprove: false, reason: 'Only Quality Inspectors can approve this action' };
        }
        if (user.role === ROLES.QUALITY_INSPECTOR) {
            if (!user.inspectorCredentials) return { canApprove: false, reason: 'Inspector credentials not found' };
            if (!user.inspectorCredentials.isCertified) return { canApprove: false, reason: 'Inspector is not certified' };
            if (!user.inspectorCredentials.isActive) return { canApprove: false, reason: 'Inspector is not active' };
            if (user.inspectorCredentials.expiresAt && new Date() > user.inspectorCredentials.expiresAt) {
                return { canApprove: false, reason: 'Inspector certification has expired' };
            }
            if (user.status !== 'active') return { canApprove: false, reason: 'User account is not active' };
        }
        const config = getMultisigConfig(action);
        if (!config) return { canApprove: false, reason: 'Invalid action type' };
        return { canApprove: true, reason: 'Authorized' };
    }

    static canInitiateMultisigAction(user, action) {
        if (!user || !user.role) return { canInitiate: false, reason: 'User not authenticated' };
        if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
            return { canInitiate: true, reason: 'Authorized as admin' };
        }
        if (user.role === ROLES.QUALITY_INSPECTOR) {
            if (user.canApproveMultisig) return { canInitiate: true, reason: 'Authorized as inspector' };
            return { canInitiate: false, reason: 'Inspector not properly certified' };
        }
        return { canInitiate: false, reason: 'Not authorized to initiate this action' };
    }

    static canAccessBatch(user, batch, accessType = 'read') {
        if (!user || !user.role) return { canAccess: false, reason: 'User not authenticated' };
        if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) return { canAccess: true, reason: 'Admin access' };
        const permissionMap = { read: PERMISSIONS.BATCH_READ, update: PERMISSIONS.BATCH_UPDATE, delete: PERMISSIONS.BATCH_DELETE };
        const requiredPermission = permissionMap[accessType];
        if (!requiredPermission) return { canAccess: false, reason: 'Invalid access type' };
        if (!this.checkPermission(user, requiredPermission)) return { canAccess: false, reason: `Missing permission: ${requiredPermission}` };
        if (accessType === 'update' || accessType === 'delete') {
            const userId = user._id?.toString() || user.id;
            const userFarmerId = user.farmerId || userId;
            const batchFarmerId = batch.farmerId?.toString?.() || batch.farmerId;
            if (batchFarmerId !== userFarmerId && batchFarmerId !== userId) {
                return { canAccess: false, reason: 'Not authorized for this batch' };
            }
        }
        return { canAccess: true, reason: 'Authorized' };
    }

    static canUpdateStage(user, stage) {
        if (!user || !user.role) return { canUpdate: false, reason: 'User not authenticated' };
        if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) return { canUpdate: true, reason: 'Admin access' };
        const stagePermissionMap = { 'farmer': PERMISSIONS.STAGE_FARMER, 'mandi': PERMISSIONS.STAGE_MANDI, 'transport': PERMISSIONS.STAGE_TRANSPORT, 'retailer': PERMISSIONS.STAGE_RETAILER };
        const requiredPermission = stagePermissionMap[stage?.toLowerCase()];
        if (!requiredPermission) return { canUpdate: false, reason: 'Invalid stage' };
        if (!this.checkPermission(user, requiredPermission)) return { canUpdate: false, reason: `Not authorized for stage: ${stage}` };
        return { canUpdate: true, reason: 'Authorized' };
    }

    static getUserPermissions(user) {
        if (!user || !user.role) return [];
        const rolePerms = require('../constants/permissions').getRolePermissions(user.role);
        const userPerms = user.permissions || [];
        return [...new Set([...rolePerms, ...userPerms])];
    }

    static canManageUser(manager, target) {
        if (!manager || !target) return { canManage: false, reason: 'Invalid users' };
        if (manager._id?.toString() === target._id?.toString()) return { canManage: false, reason: 'Cannot manage yourself' };
        if (manager.role === ROLES.SUPER_ADMIN) {
            if (target.role === ROLES.SUPER_ADMIN) return { canManage: false, reason: 'Cannot manage other super admins' };
            return { canManage: true, reason: 'Super admin authority' };
        }
        if (manager.role === ROLES.ADMIN) {
            if (getRoleLevel(target.role) >= getRoleLevel(manager.role)) {
                return { canManage: false, reason: 'Cannot manage users with equal or higher role' };
            }
            return { canManage: true, reason: 'Admin authority' };
        }
        return { canManage: false, reason: 'Insufficient privileges' };
    }

    static requirePermissions(permissions, options = {}) {
        const permArray = Array.isArray(permissions) ? permissions : [permissions];
        const requireAll = options.requireAll || false;
        return (req, res, next) => {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
            const hasAuth = requireAll ? this.checkAllPermissions(req.user, permArray) : this.checkAnyPermission(req.user, permArray);
            if (!hasAuth) {
                logger.warn(`[RBAC] Permission denied for user ${req.user.email}: needs ${permArray.join(', ')}`);
                return res.status(403).json({ error: 'Forbidden', message: `Missing required permission(s): ${permArray.join(', ')}` });
            }
            next();
        };
    }
}

module.exports = RBACService;

