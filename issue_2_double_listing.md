# Issue: Double-Listing (Infinite Supply) Vulnerability in Smart Contract

**Description**:
In `contracts/CropChain.sol`, the `createListing` function allows sellers to list crops for sale on the marketplace. The function checks whether the listed quantity is within bounds using `require(quantity > 0 && quantity <= batch.quantity, "Invalid quantity")`. However, it never subtracts the listed quantity from `batch.quantity`, nor does it track the amount of the batch that has already been listed. 

Because the available `batch.quantity` remains unchanged after a listing is created, a malicious seller can repeatedly call `createListing` on the same `batchId`, creating an infinite number of listings from a single batch.

**Impact**:
A malicious actor could register a batch of 100 kg, and then create 10 separate listings of 100 kg each, allowing them to sell 1,000 kg to unsuspecting buyers. This completely compromises the physical supply-chain integrity the smart contract is meant to guarantee, leading to financial fraud.

**Solution**:
1. Update the `CropBatch` struct in `CropChain.sol` to include a new property, e.g., `uint256 quantityListed`.
2. In the `createListing` function, modify the require statement to ensure the new listing doesn't exceed the unlisted remainder: `require(quantity > 0 && (batch.quantityListed + quantity) <= batch.quantity, "Invalid quantity")`.
3. Increment `batch.quantityListed += quantity` when a new listing is successfully created.
4. If a listing is cancelled, decrement `batch.quantityListed -= quantity` to allow the seller to relist the items.

I would like to work on this under gssoc26.
