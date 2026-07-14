import { ethers } from 'ethers';

// CropChain contract ABI matching CropChain.sol
export const cropChainABI = [
  "event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator)",
  "event BatchUpdated(bytes32 indexed batchId, uint8 stage, string actorName, string location, address indexed updatedBy)",
  "event CustodianApproved(bytes32 indexed batchId, address indexed approver, address indexed nextCustodian)",
  
  "function getBatch(bytes32 batchId) view returns (tuple(bytes32 batchId, bytes32 cropTypeHash, string ipfsCID, uint256 quantity, uint256 createdAt, address creator, bool exists, bool isRecalled, int256 currentTemperature, int256 currentHumidity, bool isSpoiled))",
  "function getBatchUpdates(bytes32 batchId) view returns (tuple(uint8 stage, string actorName, string location, uint256 timestamp, string notes, address updatedBy)[])",
  "function nextCustodianApproval(bytes32) view returns (address)",
  
  "function createBatch(bytes32 batchId, bytes32 cropTypeHash, string calldata ipfsCID, uint256 quantity, string calldata actorName, string calldata location, string calldata notes) external",
  "function updateBatch(bytes32 batchId, uint8 stage, string calldata actorName, string calldata location, string calldata notes) external",
  "function approveCustodian(bytes32 batchId, address nextCustodian) external"
];

export const getContractAddress = (): string => {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x2c79F3f6b448270ADF667CA5d23d23feC4d15Fa4';
};

export const hasMetaMask = (): boolean => {
  return typeof window !== 'undefined' && (window as any).ethereum !== undefined;
};

export const getWeb3Provider = (): ethers.BrowserProvider | null => {
  if (!hasMetaMask()) return null;
  return new ethers.BrowserProvider((window as any).ethereum);
};

export const getSigner = async (): Promise<ethers.Signer | null> => {
  const provider = getWeb3Provider();
  if (!provider) return null;
  try {
    return await provider.getSigner();
  } catch (error) {
    console.error("Failed to get signer:", error);
    return null;
  }
};

export const getContract = async (): Promise<ethers.Contract | null> => {
  const signer = await getSigner();
  if (!signer) return null;
  return new ethers.Contract(getContractAddress(), cropChainABI, signer);
};
