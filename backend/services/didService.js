const { ethers } = require('ethers');
const User = require('../models/User');
const { isAdminRole } = require('../constants/permissions');
const { buildVerificationMessage, CHALLENGE_ACTIONS } = require('./verificationSecurityService');
const { NotFoundError } = require('../utils/errorHandler');
const VerificationEvent = require('../models/VerificationEvent');

/**
 * DID Service for Verifiable Credentials
 * Implements zero-knowledge proof concepts for privacy-preserving verification
 */

class DIDService {
    /**
     * Verify MetaMask signature
     * @param {string} message - Original message
     * @param {string} signature - Signed message
     * @param {string} expectedAddress - Expected signer address
     * @returns {boolean} - Whether signature is valid
     */
    verifySignature(message, signature, expectedAddress) {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Generate credential hash (for zero-knowledge proof)
     * @param {Object} userData - User data to hash
     * @returns {string} - Credential hash
     */
    generateCredentialHash(userData) {
        const { userId, walletAddress, role, timestamp } = userData;
        const dataString = `${userId}:${walletAddress}:${role}:${timestamp}`;
        return ethers.keccak256(ethers.toUtf8Bytes(dataString));
    }

    /**
     * Issue verifiable credential
     * @param {string} userId - User ID to verify
     * @param {string} verifierId - Verifier (Mandi officer) ID
     * @param {string} signature - Verifier's signature
     * @param {string} walletAddress - User's wallet address
     * @returns {Object} - Verification result
     */
    async issueCredential(userId, verifierId, signature, walletAddress, challenge) {
        try {
            const user = await User.findById(userId);
            const verifier = await User.findById(verifierId);

            if (!user) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'User not found' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User not found');
            }

            if (!verifier || !isAdminRole(verifier.role)) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'Only Mandi officers (admins) can verify users' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Only Mandi officers (admins) can verify users');
            }

            if (!challenge || challenge.action !== CHALLENGE_ACTIONS.ISSUE_CREDENTIAL) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'A valid issuance challenge is required' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('A valid issuance challenge is required');
            }

            if (user.verification?.isVerified) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'User is already verified' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User is already verified');
            }

            const linkedWalletAddress = user.walletAddress;

            if (!linkedWalletAddress) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'User does not have a linked wallet address' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User does not have a linked wallet address');
            }

            if (
                walletAddress &&
                walletAddress.toLowerCase() !== linkedWalletAddress.toLowerCase()
            ) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'Provided wallet address does not match linked wallet address' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Provided wallet address does not match linked wallet address');
            }

            // Generate credential hash
            const credentialHash = this.generateCredentialHash({
                userId: user._id.toString(),
                walletAddress: linkedWalletAddress,
                role: user.role,
                timestamp: Date.now(),
            });

            // Verify signature
            const message = buildVerificationMessage({
                action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
                actorId: verifierId,
                userId: user._id.toString(),
                walletAddress: linkedWalletAddress,
                nonce: challenge.nonce,
                expiresAt: challenge.expiresAt,
            });

            if (!verifier.walletAddress) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'Verifier wallet address not found' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Verifier wallet address not found');
            }

            const isValidSignature = this.verifySignature(
                message,
                signature,
                verifier.walletAddress
            );

            // Log signature validated event
            try {
                await VerificationEvent.create({
                    action: 'signature_validated',
                    actorId: verifierId,
                    userId: user._id.toString(),
                    walletAddress: linkedWalletAddress,
                    status: isValidSignature ? 'success' : 'failure',
                    metadata: { message, signature, isValid: isValidSignature }
                });
            } catch (e) { console.error(e); }

            if (!isValidSignature) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_issued',
                        actorId: verifierId,
                        userId: user._id.toString(),
                        walletAddress: linkedWalletAddress,
                        status: 'failure',
                        metadata: { error: 'Invalid verifier signature' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Invalid verifier signature');
            }

            // Update user with verification
            user.verification = {
                isVerified: true,
                verifiedBy: verifierId,
                verifiedAt: new Date(),
                credentialHash,
                signature,
            };

            await user.save();

            // Log success credential_issued and verification_status_changed events
            try {
                await VerificationEvent.create({
                    action: 'credential_issued',
                    actorId: verifierId,
                    userId: user._id.toString(),
                    walletAddress: linkedWalletAddress,
                    status: 'success',
                    metadata: {
                        credentialHash,
                        signature,
                        verificationState: user.verification
                    }
                });

                await VerificationEvent.create({
                    action: 'verification_status_changed',
                    actorId: verifierId,
                    userId: user._id.toString(),
                    walletAddress: linkedWalletAddress,
                    status: 'success',
                    metadata: {
                        isVerified: true,
                        verifiedBy: verifierId,
                        verifiedAt: user.verification.verifiedAt
                    }
                });
            } catch (e) { console.error(e); }

            // Sync user role to blockchain
            const blockchainService = require('./blockchainService');
            if (user.walletAddress) {
                try {
                    await blockchainService.syncUserRole(user.walletAddress, user.role);
                } catch (bcError) {
                    console.error(`Failed to sync user role on blockchain for ${user.email} during credential issue:`, bcError.message);
                }
            }

            return {
                success: true,
                message: 'Credential issued successfully',
                credentialHash,
                isVerified: true,
            };
        } catch (error) {
            try {
                await VerificationEvent.create({
                    action: 'credential_issued',
                    actorId: verifierId,
                    userId,
                    walletAddress,
                    status: 'failure',
                    metadata: { error: error.message || error.toString() }
                });
            } catch (e) { console.error(e); }
            throw error;
        }
    }

    /**
     * Revoke credential
     * @param {string} userId - User ID to revoke
     * @param {string} adminId - Admin ID performing revocation
     * @param {string} reason - Revocation reason
     * @returns {Object} - Revocation result
     */
    async revokeCredential(userId, adminId, reason) {
        try {
            const user = await User.findById(userId);
            const admin = await User.findById(adminId);

            if (!user) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_revoked',
                        actorId: adminId,
                        userId,
                        status: 'failure',
                        metadata: { error: 'User not found' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User not found');
            }

            if (!admin || !isAdminRole(admin.role)) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_revoked',
                        actorId: adminId,
                        userId,
                        walletAddress: user.walletAddress,
                        status: 'failure',
                        metadata: { error: 'Only admins can revoke credentials' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Only admins can revoke credentials');
            }

            if (!user.verification?.isVerified) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_revoked',
                        actorId: adminId,
                        userId,
                        walletAddress: user.walletAddress,
                        status: 'failure',
                        metadata: { error: 'User is not verified' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User is not verified');
            }

            user.verification.isVerified = false;
            user.verification.revokedAt = new Date();
            user.verification.revocationReason = reason;

            await user.save();

            // Log success credential_revoked and verification_status_changed events
            try {
                await VerificationEvent.create({
                    action: 'credential_revoked',
                    actorId: adminId,
                    userId,
                    walletAddress: user.walletAddress,
                    status: 'success',
                    metadata: {
                        reason,
                        verificationState: user.verification
                    }
                });

                await VerificationEvent.create({
                    action: 'verification_status_changed',
                    actorId: adminId,
                    userId,
                    walletAddress: user.walletAddress,
                    status: 'success',
                    metadata: {
                        isVerified: false,
                        revokedAt: user.verification.revokedAt,
                        reason
                    }
                });
            } catch (e) { console.error(e); }

            // Revoke user role on blockchain (sync to ActorRole.None)
            const blockchainService = require('./blockchainService');
            if (user.walletAddress) {
                try {
                    await blockchainService.syncUserRole(user.walletAddress, 'none');
                } catch (bcError) {
                    console.error(`Failed to revoke user role on blockchain for ${user.email}:`, bcError.message);
                }
            }

            return {
                success: true,
                message: 'Credential revoked successfully',
            };
        } catch (error) {
            try {
                await VerificationEvent.create({
                    action: 'credential_revoked',
                    actorId: adminId,
                    userId,
                    status: 'failure',
                    metadata: { error: error.message || error.toString() }
                });
            } catch (e) { console.error(e); }
            throw error;
        }
    }

    /**
     * Check verification status (zero-knowledge proof)
     * Returns only verification status without exposing personal data
     * @param {string} userId - User ID to check
     * @returns {Object} - Verification status
     */
    async checkVerificationStatus(userId) {
        try {
            const user = await User.findById(userId).select('verification role');

            if (!user) {
                throw new NotFoundError('User', userId);
            }

            // Zero-knowledge proof: Only return verification status
            return {
                isVerified: user.verification?.isVerified || false,
                role: user.role,
                verifiedAt: user.verification?.verifiedAt,
                credentialHash: user.verification?.isVerified ? user.verification?.credentialHash : null,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Link wallet address to user
     * @param {string} userId - User ID
     * @param {string} walletAddress - Wallet address
     * @param {string} signature - Signature proving ownership
     * @returns {Object} - Link result
     */
    async linkWallet(userId, walletAddress, signature, challenge) {
        try {
            const user = await User.findById(userId);

            if (!user) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_linked',
                        actorId: userId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'User not found' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('User not found');
            }

            if (!challenge || challenge.action !== CHALLENGE_ACTIONS.LINK_WALLET) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_linked',
                        actorId: userId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'A valid wallet linking challenge is required' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('A valid wallet linking challenge is required');
            }

            // Verify wallet ownership
            const message = buildVerificationMessage({
                action: CHALLENGE_ACTIONS.LINK_WALLET,
                actorId: userId,
                userId,
                walletAddress,
                nonce: challenge.nonce,
                expiresAt: challenge.expiresAt,
            });
            const isValidSignature = this.verifySignature(message, signature, walletAddress);

            // Log signature validation result
            try {
                await VerificationEvent.create({
                    action: 'signature_validated',
                    actorId: userId,
                    userId,
                    walletAddress,
                    status: isValidSignature ? 'success' : 'failure',
                    metadata: { message, signature, isValid: isValidSignature }
                });
            } catch (e) { console.error(e); }

            if (!isValidSignature) {
                try {
                    await VerificationEvent.create({
                        action: 'credential_linked',
                        actorId: userId,
                        userId,
                        walletAddress,
                        status: 'failure',
                        metadata: { error: 'Invalid signature' }
                    });
                } catch (e) { console.error(e); }
                throw new Error('Invalid signature');
            }

            user.walletAddress = walletAddress;
            await user.save();

            // Log credential linked success
            try {
                await VerificationEvent.create({
                    action: 'credential_linked',
                    actorId: userId,
                    userId,
                    walletAddress,
                    status: 'success',
                    metadata: {
                        walletAddress,
                        verificationState: user.verification
                    }
                });
            } catch (e) { console.error(e); }

            return {
                success: true,
                message: 'Wallet linked successfully',
                walletAddress,
            };
        } catch (error) {
            try {
                await VerificationEvent.create({
                    action: 'credential_linked',
                    actorId: userId,
                    userId,
                    walletAddress,
                    status: 'failure',
                    metadata: { error: error.message || error.toString() }
                });
            } catch (e) { console.error(e); }
            throw error;
        }
    }
}

module.exports = new DIDService();
