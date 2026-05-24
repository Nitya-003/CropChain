
/**
 * Formats a date string to DD/MM/YYYY format.
 * @param dateString The date string to format.
 * @returns The formatted date string.
 */
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Calculates the total weight of multiple crop batches.
 * @param batches Array of objects with a quantity property.
 * @returns The total weight.
 */
export const calculateTotalWeight = (batches: { quantity: number }[]): number => {
    return batches.reduce((total, batch) => total + batch.quantity, 0);
};

/**
 * Validates if a batch ID is a valid hex string.
 * @param batchId The batch ID to validate.
 * @returns True if valid, false otherwise.
 */
export const validateBatchID = (batchId: string): boolean => {
    // Assuming a standard hex string format (e.g., Ethereum address or similar hash)
    // Adjust the regex based on specific requirements if needed. 
    // For now, checking for alphanumeric (hex) characters.
    // Example: 0x... or just hex. Let's assume a general hex string of some length.
    // Requirements say "valid hex strings".
    const hexRegex = /^[0-9a-fA-F]+$/;
    return hexRegex.test(batchId);
};

/**
 * Converts Kilograms to Quintals.
 * @param kg Weight in Kilograms.
 * @returns Weight in Quintals.
 */
export const convertKgToQuintal = (kg: number): number => {
    return kg / 100;
};
