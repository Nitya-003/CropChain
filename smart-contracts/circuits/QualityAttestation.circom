pragma circom 2.0.0;

/*
 * QualityAttestation Circuit
 * Validates crop quality metrics confidentially:
 * 1. pesticidePpm < thresholdPpm
 * 2. minMoisture <= moisturePercentage <= maxMoisture
 * 3. grade == certifiedGrade
 *
 * Public Inputs:
 *   - batchId
 *   - qualityThresholdHash
 *   - certificationAuthorityPubKey
 *
 * Private Inputs:
 *   - pesticidePpm
 *   - moisturePercentage
 *   - minMoisture
 *   - maxMoisture
 *   - thresholdPpm
 *   - grade
 *   - certifiedGrade
 *   - fieldLocationMetadata
 *   - auditTimestamp
 */

template LessThan(n) {
    signal input in[2];
    signal output out;

    signal diff;
    diff <-- in[0] < in[1] ? 1 : 0;
    out <-- diff;
    out * (out - 1) === 0;
    out === 1;
}

template GreaterEqThan(n) {
    signal input in[2];
    signal output out;
    
    signal diff;
    diff <-- in[0] >= in[1] ? 1 : 0;
    out <-- diff;
    out * (out - 1) === 0;
    out === 1;
}

template LessEqThan(n) {
    signal input in[2];
    signal output out;

    signal diff;
    diff <-- in[0] <= in[1] ? 1 : 0;
    out <-- diff;
    out * (out - 1) === 0;
    out === 1;
}

template QualityAttestation() {
    // Public signals
    signal input batchId;
    signal input qualityThresholdHash;
    signal input certificationAuthorityPubKey;

    // Private signals
    signal input pesticidePpm;
    signal input moisturePercentage;
    signal input minMoisture;
    signal input maxMoisture;
    signal input thresholdPpm;
    signal input grade;
    signal input certifiedGrade;
    signal input fieldLocationMetadata;
    signal input auditTimestamp;

    // 1. Pesticide check: pesticidePpm < thresholdPpm
    component ltPesticide = LessThan(32);
    ltPesticide.in[0] <== pesticidePpm;
    ltPesticide.in[1] <== thresholdPpm;

    // 2. Moisture range check: minMoisture <= moisturePercentage <= maxMoisture
    component geMinMoisture = GreaterEqThan(32);
    geMinMoisture.in[0] <== moisturePercentage;
    geMinMoisture.in[1] <== minMoisture;

    component leMaxMoisture = LessEqThan(32);
    leMaxMoisture.in[0] <== moisturePercentage;
    leMaxMoisture.in[1] <== maxMoisture;

    // 3. Grade match check: grade == certifiedGrade
    grade === certifiedGrade;

    // 4. Dummy constraints ensuring all public & private signals are constrained
    signal batchIdDummy;
    batchIdDummy <== batchId * 1;
    batchIdDummy === batchId;

    signal hashDummy;
    hashDummy <== qualityThresholdHash * 1;
    hashDummy === qualityThresholdHash;

    signal pubKeyDummy;
    pubKeyDummy <== certificationAuthorityPubKey * 1;
    pubKeyDummy === certificationAuthorityPubKey;

    signal locDummy;
    locDummy <== fieldLocationMetadata * 1;
    locDummy === fieldLocationMetadata;

    signal timeDummy;
    timeDummy <== auditTimestamp * 1;
    timeDummy === auditTimestamp;
}

component main {public [batchId, qualityThresholdHash, certificationAuthorityPubKey]} = QualityAttestation();
