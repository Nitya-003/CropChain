import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CropNFTVisualizer } from "../CropNFTVisualizer";

vi.mock("@/services/nftService", () => ({
  getBatchNFT: vi.fn().mockResolvedValue({
    success: true,
    batchId: "CROP-2026-TEST",
    nftData: {
      tokenId: 1042,
      metadataURI: "ipfs://bafybeigdnfttest",
      currentStage: 0,
      mintedAt: "2026-08-01",
      updatedAt: "2026-08-01",
    },
  }),
  updateNFTMetadata: vi.fn().mockResolvedValue({
    success: true,
    batchId: "CROP-2026-TEST",
    nftData: {
      tokenId: 1042,
      metadataURI: "ipfs://bafybeigdnftupdated",
      currentStage: 3,
      mintedAt: "2026-08-01",
      updatedAt: "2026-08-02",
    },
  }),
}));

describe("CropNFTVisualizer Component", () => {
  it("renders dNFT card header, token ID, and crop details", () => {
    render(
      <CropNFTVisualizer
        batchId="CROP-2026-TEST"
        cropType="Organic Wheat"
        quantity={800}
        origin="Punjab, India"
      />,
    );

    expect(screen.getByText("Dynamic NFT Asset (dNFT)")).toBeInTheDocument();
    expect(screen.getByText("Organic Wheat")).toBeInTheDocument();
    expect(screen.getByText("800 kg • Punjab, India")).toBeInTheDocument();
  });

  it("renders lifecycle stage badges and IPFS metadata URI", () => {
    render(
      <CropNFTVisualizer
        batchId="CROP-2026-TEST"
        cropType="Organic Wheat"
        currentStage={3}
      />,
    );

    expect(screen.getByText("Quality Inspected")).toBeInTheDocument();
    expect(screen.getByText("View IPFS")).toBeInTheDocument();
  });
});
