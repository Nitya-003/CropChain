
import { formatDate, calculateTotalWeight, validateBatchID, convertKgToQuintal } from './index';

describe('Utility Functions', () => {
    describe('formatDate', () => {
        it('should format a date string to DD/MM/YYYY', () => {
            const date = '2023-10-05T10:00:00Z'; // Oct 5, 2023
            expect(formatDate(date)).toBe('05/10/2023');
        });

        it('should handle single digit days and months correctly', () => {
            const date = '2023-01-02T10:00:00Z'; // Jan 2, 2023
            expect(formatDate(date)).toBe('02/01/2023');
        });
    });

    describe('calculateTotalWeight', () => {
        it('should correctly sum up multiple crop batches', () => {
            const batches = [
                { quantity: 100 },
                { quantity: 200 },
                { quantity: 50 },
            ];
            expect(calculateTotalWeight(batches)).toBe(350);
        });

        it('should return 0 for an empty array', () => {
            expect(calculateTotalWeight([])).toBe(0);
        });
    });

    describe('validateBatchID', () => {
        it('should return true for valid hex strings', () => {
            expect(validateBatchID('1a2b3c')).toBe(true);
            expect(validateBatchID('DEADBEEF')).toBe(true);
            expect(validateBatchID('0123456789')).toBe(true);
        });

        it('should return false for invalid hex strings', () => {
            expect(validateBatchID('xyz')).toBe(false); // Non-hex characters
            expect(validateBatchID('123g')).toBe(false);
            expect(validateBatchID('')).toBe(false); // Empty string - generally considered invalid ID
        });
    });

    describe('convertKgToQuintal', () => {
        it('should correctly convert Kg to Quintal', () => {
            expect(convertKgToQuintal(100)).toBe(1);
            expect(convertKgToQuintal(250)).toBe(2.5);
            expect(convertKgToQuintal(0)).toBe(0);
        })
    })
});
