const { initializeBlockchain } = require('../services/blockchainWorker');

describe('Blockchain Worker Initialization', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('returns false and enables simulation mode without throwing ReferenceError when env vars are missing', async () => {
        delete process.env.PROVIDER_URL;
        delete process.env.INFURA_URL;
        delete process.env.SEPOLIA_URL;
        delete process.env.CONTRACT_ADDRESS;
        delete process.env.PRIVATE_KEY;
        delete process.env.ETH_PRIVATE_KEY;

        const isConfigured = await initializeBlockchain();
        expect(isConfigured).toBe(false);
    });
});
