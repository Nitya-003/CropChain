/**
 * Shared Stage Enum Constants
 * 
 * ⚠️ CRITICAL: This MUST match the Stage enum in contracts/CropChain.sol
 * Any changes here require corresponding changes in:
 * - contracts/CropChain.sol (Solidity enum)
 * - blockchainWorker.js mapStageToNumber() function
 * - Frontend components using stages
 * 
 * Current mapping:
 * - farmer: 0 (Farmer in Solidity)
 * - mandi: 1 (Mandi in Solidity)
 * - transport: 2 (Transport in Solidity)
 * - retailer: 3 (Retailer in Solidity)
 * 
 * Used by:
 * - Mongoose models (Batch.js)
 * - Joi validations (batchSchema.js)
 * - Blockchain worker (blockchainWorker.js)
 * - Any other stage-related logic
 * 
 * All stages are lowercase to ensure consistency.
 * Mongoose models should use lowercase: true to normalize input.
 */

const STAGES = ['farmer', 'mandi', 'transport', 'retailer'];

/**
 * Stage to number mapping for blockchain contract compatibility
 * MUST match the order in CropChain.sol Stage enum
 */
const STAGE_TO_NUMBER = {
    'farmer': 0,
    'mandi': 1,
    'transport': 2,
    'retailer': 3
};

/**
 * Get stages as a comma-separated string for error messages
 * @returns {string}
 */
const getStagesString = () => STAGES.join(', ');

/**
 * Check if a value is a valid stage
 * @param {string} value 
 * @returns {boolean}
 */
const isValidStage = (value) => STAGES.includes(value?.toLowerCase());

/**
 * Normalize a stage value to lowercase
 * @param {string} value 
 * @returns {string}
 */
const normalizeStage = (value) => value?.toLowerCase();

/**
 * Convert stage string to blockchain enum number
 * @param {string} stage - Stage name
 * @returns {number} Stage enum value (0-3)
 * @throws {Error} If stage is invalid
 */
const getStageNumber = (stage) => {
    const normalizedStage = stage?.toLowerCase();
    if (!isValidStage(normalizedStage)) {
        throw new Error(`Invalid stage: ${stage}. Must be one of: ${STAGES.join(', ')}`);
    }
    return STAGE_TO_NUMBER[normalizedStage];
};

/**
 * Validate that stage mapping is consistent with blockchain contract
 * Call this during application startup to catch configuration errors early
 * @returns {boolean} True if validation passes
 * @throws {Error} If validation fails
 */
const validateStageMapping = () => {
    const expectedStages = ['farmer', 'mandi', 'transport', 'retailer'];
    const expectedNumbers = [0, 1, 2, 3];
    
    // Check STAGES array
    if (JSON.stringify(STAGES) !== JSON.stringify(expectedStages)) {
        throw new Error(
            `Stage mismatch detected!\n` +
            `Expected: [${expectedStages.join(', ')}]\n` +
            `Got: [${STAGES.join(', ')}]\n` +
            `This will cause blockchain sync failures. Please verify contracts/CropChain.sol`
        );
    }
    
    // Check STAGE_TO_NUMBER mapping
    for (const [stage, number] of Object.entries(STAGE_TO_NUMBER)) {
        const expectedIndex = expectedStages.indexOf(stage);
        if (expectedIndex === -1) {
            throw new Error(`Unexpected stage in STAGE_TO_NUMBER: ${stage}`);
        }
        if (number !== expectedNumbers[expectedIndex]) {
            throw new Error(
                `Stage number mismatch for ${stage}!\n` +
                `Expected: ${expectedNumbers[expectedIndex]}\n` +
                `Got: ${number}\n` +
                `This will cause incorrect blockchain transactions.`
            );
        }
    }
    
    console.log('✅ Stage mapping validation passed - blockchain sync will work correctly');
    return true;
};

module.exports = STAGES;
module.exports.STAGES = STAGES;
module.exports.STAGE_TO_NUMBER = STAGE_TO_NUMBER;
module.exports.getStagesString = getStagesString;
module.exports.isValidStage = isValidStage;
module.exports.normalizeStage = normalizeStage;
module.exports.getStageNumber = getStageNumber;
module.exports.validateStageMapping = validateStageMapping;
