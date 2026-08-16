import { apiClient } from "./apiClient";

export interface NFTMetadataAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: NFTMetadataAttribute[];
}

export interface CropNFTData {
  tokenId: number;
  metadataURI: string;
  currentStage: number;
  mintedAt: string;
  updatedAt: string;
  metadataJSON?: NFTMetadata;
  transactionHash?: string | null;
}

export interface CropNFTResponse {
  success: boolean;
  batchId: string;
  cropType?: string;
  nftData: CropNFTData;
  message?: string;
}

/**
 * Fetch dNFT data for a specific crop batch
 */
export async function getBatchNFT(batchId: string): Promise<CropNFTResponse> {
  const response = await apiClient.get<CropNFTResponse>(`/nft/${batchId}`);
  return response.data;
}

/**
 * Mint a new dynamic NFT for a crop batch
 */
export async function mintBatchNFT(batchId: string, recipientAddress?: string): Promise<CropNFTResponse> {
  const response = await apiClient.post<CropNFTResponse>("/nft/mint", {
    batchId,
    recipientAddress,
  });
  return response.data;
}

/**
 * Update dNFT metadata & stage
 */
export async function updateNFTMetadata(
  batchId: string,
  stage: number,
  actorName?: string,
): Promise<CropNFTResponse> {
  const response = await apiClient.patch<CropNFTResponse>(`/nft/${batchId}/metadata`, {
    stage,
    actorName,
  });
  return response.data;
}
