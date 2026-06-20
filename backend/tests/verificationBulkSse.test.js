jest.mock('../models/BulkVerificationJob', () => ({
    findById: jest.fn(),
}));

const BulkVerificationJob = require('../models/BulkVerificationJob');

const { streamBulkJobEvents } = require('../controllers/verificationController');

describe('bulk verification SSE stream', () => {
    jest.setTimeout(10000);

    test('emits jobStatus and done events with SSE framing', async () => {
        const jobId = '507f1f77bcf86cd799439011';

        const jobs = [
            {
                _id: jobId,
                status: 'processing',
                totalRows: 2,
                processedRows: 1,
                successCount: 1,
                failureCount: 0,
                results: [
                    {
                        rowNumber: 2,
                        userId: 'u1',
                        walletAddress: '0xaaaa',
                        action: 'ISSUE_CREDENTIAL',
                        status: 'success',
                        error: undefined,
                        details: { message: 'ok' },
                    },
                ],
            },
            {
                _id: jobId,
                status: 'completed',
                totalRows: 2,
                processedRows: 2,
                successCount: 1,
                failureCount: 1,
                results: [
                    {
                        rowNumber: 2,
                        userId: 'u1',
                        walletAddress: '0xaaaa',
                        action: 'ISSUE_CREDENTIAL',
                        status: 'success',
                        error: undefined,
                        details: { message: 'ok' },
                    },
                    {
                        rowNumber: 3,
                        userId: 'u2',
                        walletAddress: '0xbbbb',
                        action: 'ISSUE_CREDENTIAL',
                        status: 'failure',
                        error: 'boom',
                        details: { message: 'fail' },
                    },
                ],
            },
        ];

        let idx = 0;
        BulkVerificationJob.findById.mockImplementation(() => Promise.resolve(jobs[idx++]));

        // speed up loop
        process.env.BULK_JOB_SSE_POLL_INTERVAL_MS = '1';
        process.env.BULK_JOB_SSE_HEARTBEAT_INTERVAL_MS = '100000';

        const writes = [];
        const res = {
            headersSent: false,
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            write: (chunk) => writes.push(chunk),
            end: jest.fn(),
        };

        const req = {
            params: { jobId },
            on: (event, handler) => {
                // ignore in test
            },
        };

        await streamBulkJobEvents(req, res);

        const output = writes.join('');

        expect(output).toContain('event: jobStatus');
        expect(output).toContain('event: done');

        // SSE framing: each message ends with double newline.
        expect(output).toMatch(/event: jobStatus\n/);
        expect(output).toMatch(/data: \{".*?"\}\n\n/);
    });
});

