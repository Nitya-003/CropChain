jest.mock("../utils/logger", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const oracleService = require("../services/oracleService");

const makeContract = () => {
  const call = jest.fn().mockResolvedValue({
    hash: "0xabc",
    wait: jest.fn().mockResolvedValue({ blockNumber: 1, gasUsed: 90000n }),
  });
  call.estimateGas = jest.fn().mockResolvedValue(100000n);
  return { fulfillIoTData: call };
};

describe("OracleService.fulfillIoTData (ethers v6 bigint handling)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses a bigint gasLimit with 20% buffer and EIP-1559 fee bigints", async () => {
    const contract = makeContract();
    oracleService.contract = contract;
    oracleService.provider = {
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: 25000000000n,
        maxPriorityFeePerGas: 2000000000n,
        gasPrice: 25000000000n,
      }),
    };

    const receipt = await oracleService.fulfillIoTData("0x1234", {
      temperature: 24.5,
      humidity: 60,
    });

    const overrides = contract.fulfillIoTData.mock.calls[0][3];
    expect(overrides.gasLimit).toBe(120000n);
    expect(overrides.maxFeePerGas).toBe(25000000000n);
    expect(overrides.maxPriorityFeePerGas).toBe(2000000000n);
    expect(overrides.gasPrice).toBeUndefined();
    expect(receipt.blockNumber).toBe(1);
  });

  it("falls back to legacy gasPrice when no EIP-1559 fields are present", async () => {
    const contract = makeContract();
    oracleService.contract = contract;
    oracleService.provider = {
      getFeeData: jest.fn().mockResolvedValue({ gasPrice: 15000000000n }),
    };

    await oracleService.fulfillIoTData("0x1234", {
      temperature: 24.5,
      humidity: 60,
    });

    const overrides = contract.fulfillIoTData.mock.calls[0][3];
    expect(overrides.gasLimit).toBe(120000n);
    expect(overrides.gasPrice).toBe(15000000000n);
    expect(overrides.maxFeePerGas).toBeUndefined();
  });
});
