const { ethers } = require('ethers');
const User = require('../models/User');

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
    async issueCredential(userId, verifierId, signature, walletAddress) {
        try {
            const user = await User.findById(userId);
            const verifier = await User.findById(verifierId);

            if (!user) {
                throw new Error('User not found');
            }

            if (!verifier || verifier.role !== 'admin') {
                throw new Error('Only Mandi officers (admins) can verify users');
            }

            if (user.verification?.isVerified) {
                throw new Error('User is already verified');
            }

            const linkedWalletAddress = user.walletAddress;

            if (!linkedWalletAddress) {
                throw new Error('User does not have a linked wallet address');
            }

            if (
                walletAddress &&
                walletAddress.toLowerCase() !== linkedWalletAddress.toLowerCase()
            ) {
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
            const message = `Verify user ${user.name} (${user.email}) with wallet ${linkedWalletAddress}`;

            if (!verifier.walletAddress) {
                throw new Error('Verifier wallet address not found');
            }

            const isValidSignature = this.verifySignature(
                message,
                signature,
                verifier.walletAddress
            );

            if (!isValidSignature) {
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

            return {
                success: true,
                message: 'Credential issued successfully',
                credentialHash,
                isVerified: true,
            };
        } catch (error) {
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
                throw new Error('User not found');
            }

            if (!admin || admin.role !== 'admin') {
                throw new Error('Only admins can revoke credentials');
            }

            if (!user.verification?.isVerified) {
                throw new Error('User is not verified');
            }

            user.verification.isVerified = false;
            user.verification.revokedAt = new Date();
            user.verification.revocationReason = reason;

            await user.save();

            return {
                success: true,
                message: 'Credential revoked successfully',
            };
        } catch (error) {
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
                throw new Error('User not found');
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
    async linkWallet(userId, walletAddress, signature) {
        try {
            const user = await User.findById(userId);

            if (!user) {
                throw new Error('User not found');
            }

            // Verify wallet ownership
            const message = `Link wallet ${walletAddress} to CropChain account`;
            const isValidSignature = this.verifySignature(message, signature, walletAddress);

            if (!isValidSignature) {
                throw new Error('Invalid signature');
            }

            user.walletAddress = walletAddress;
            await user.save();

            return {
                success: true,
                message: 'Wallet linked successfully',
                walletAddress,
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new DIDService();
