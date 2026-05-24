// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Compatibility stub used by local builds/tests.
// Replace with generated verifier when zero-knowledge proof verification is enabled.
contract Groth16Verifier {
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[] calldata
    ) external pure returns (bool) {
        return true;
    }
}
