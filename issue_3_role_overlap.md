# Issue: Role Overlap and Access Control Flaw in Smart Contract

**Description**:
The smart contract `contracts/CropChain.sol` manages access via both a custom `roles` mapping and OpenZeppelin's `AccessControl` roles. In the `grantStakeholderRole` function, when an admin assigns a new role to an existing user, it updates the single `roles[account]` enum, but it fails to revoke any previously held OpenZeppelin roles using `_revokeRole()`. 

For example, if a user originally had `FARMER_ROLE` and an admin subsequently grants them `MANDI_ROLE`, the `grantStakeholderRole` function calls `_grantRole(MANDI_ROLE, account)` without stripping the old `FARMER_ROLE`. As a result, OpenZeppelin's `hasRole` function will return `true` for both roles for that user.

**Impact**:
The `_canUpdateStage` logic relies directly on the OpenZeppelin `hasRole` modifier to enforce strict stage-by-stage progression (e.g., a Farmer cannot act as a Mandi). Because a user can silently accumulate multiple valid roles in the OpenZeppelin `AccessControl` registry, a single user could unilaterally update a batch's status across multiple supply chain stages, bypassing the intended cryptographic separation of duties.

**Solution**:
1. In the `grantStakeholderRole` function of `CropChain.sol`, check if the user already has an existing role assigned in the `roles[account]` mapping.
2. If they have a previous role, call `_revokeRole(PREVIOUS_ROLE, account)` to remove it before granting the new one.
3. This mirrors the proper revocation logic that is already correctly implemented in the `setRole` function, ensuring consistency across role assignments.

I would like to work on this under gssoc26.
