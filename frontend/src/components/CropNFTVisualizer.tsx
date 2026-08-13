"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  FileCode,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  Sprout,
  Wheat,
  Copy,
} from "lucide-react";
import { CropNFTData, getBatchNFT, updateNFTMetadata } from "@/services/nftService";

interface CropNFTVisualizerProps {
  batchId: string;
  cropType?: string;
  quantity?: number;
  origin?: string;
  currentStage?: number;
  initialNFTData?: CropNFTData;
}

const STAGE_CONFIG: Record<
  number,
  {
    name: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
    description: string;
  }
> = {
  0: {
    name: "Planted",
    icon: <Sprout className="w-8 h-8 text-emerald-400" />,
    color: "text-emerald-400",
    bgColor: "from-emerald-950/60 to-emerald-900/30",
    borderColor: "border-emerald-500/40",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    description: "Registered & planted in certified organic farmland.",
  },
  1: {
    name: "Growing",
    icon: <Sprout className="w-8 h-8 text-green-400" />,
    color: "text-green-400",
    bgColor: "from-green-950/60 to-emerald-900/30",
    borderColor: "border-green-500/40",
    badgeBg: "bg-green-500/20",
    badgeText: "text-green-300",
    description: "Actively cultivated with monitored soil moisture & IoT sensors.",
  },
  2: {
    name: "Harvested",
    icon: <Wheat className="w-8 h-8 text-amber-400" />,
    color: "text-amber-400",
    bgColor: "from-amber-950/60 to-yellow-900/30",
    borderColor: "border-amber-500/40",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    description: "Harvested and sorted for distribution & inspection.",
  },
  3: {
    name: "Quality Inspected",
    icon: <ShieldCheck className="w-8 h-8 text-blue-400" />,
    color: "text-blue-400",
    bgColor: "from-blue-950/60 to-indigo-900/30",
    borderColor: "border-blue-500/40",
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-300",
    description: "Certified safe and premium quality by authorized inspectors.",
  },
  4: {
    name: "Transported",
    icon: <Truck className="w-8 h-8 text-purple-400" />,
    color: "text-purple-400",
    bgColor: "from-purple-950/60 to-indigo-900/30",
    borderColor: "border-purple-500/40",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-300",
    description: "In-transit with temperature & GPS location logging.",
  },
  5: {
    name: "Delivered",
    icon: <Building2 className="w-8 h-8 text-teal-400" />,
    color: "text-teal-400",
    bgColor: "from-teal-950/60 to-cyan-900/30",
    borderColor: "border-teal-500/40",
    badgeBg: "bg-teal-500/20",
    badgeText: "text-teal-300",
    description: "Stocked and ready for consumer purchase at retail outlet.",
  },
};

export const CropNFTVisualizer: React.FC<CropNFTVisualizerProps> = ({
  batchId,
  cropType = "Wheat",
  quantity = 500,
  origin = "Punjab",
  currentStage: initialStage = 0,
  initialNFTData,
}) => {
  const [nftData, setNftData] = useState<CropNFTData | undefined>(initialNFTData);
  const [activeStage, setActiveStage] = useState<number>(initialStage);
  const [loading, setLoading] = useState<boolean>(!initialNFTData);
  const [updating, setUpdating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadNFT() {
      try {
        setLoading(true);
        const data = await getBatchNFT(batchId);
        if (isMounted && data.success && data.nftData) {
          setNftData(data.nftData);
          setActiveStage(data.nftData.currentStage);
        }
      } catch (err) {
        console.warn("Could not fetch NFT data, using fallback visualization", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (!initialNFTData) {
      loadNFT();
    }
    return () => {
      isMounted = false;
    };
  }, [batchId, initialNFTData]);

  const handleStageUpdate = async (stageNum: number) => {
    try {
      setUpdating(true);
      const updated = await updateNFTMetadata(batchId, stageNum, "Inspector/Transporter");
      if (updated.success && updated.nftData) {
        setNftData(updated.nftData);
        setActiveStage(stageNum);
      }
    } catch (err) {
      console.error("Failed to update dNFT stage metadata", err);
    } finally {
      setUpdating(false);
    }
  };

  const copyIPFSLink = () => {
    const uri = nftData?.metadataURI || `ipfs://bafybeigdnft${batchId.toLowerCase()}`;
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stageCfg = STAGE_CONFIG[activeStage] || STAGE_CONFIG[0];
  const metadataURI = nftData?.metadataURI || `ipfs://bafybeigdnft${batchId.toLowerCase()}`;
  const tokenId = nftData?.tokenId || 1042;

  return (
    <div className="w-full max-w-4xl mx-auto my-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white tracking-wide">
                Dynamic NFT Asset (dNFT)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ERC-1155 / ERC-721
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              On-chain dynamic visual asset representation for Batch ID:{" "}
              <span className="font-mono text-slate-200">{batchId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Token ID #{tokenId}</span>
          <button
            onClick={copyIPFSLink}
            className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
            title="Copy IPFS URI"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? "Copied!" : "IPFS URI"}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
        {/* Visual Artwork Card (Left 5 Cols) */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div
            className={`w-full aspect-square rounded-2xl bg-gradient-to-br ${stageCfg.bgColor} border ${stageCfg.borderColor} p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group transition-all duration-500`}
          >
            {/* Background Glow Overlay */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />

            {/* Card Top Row */}
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
                CropChain dNFT
              </span>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${stageCfg.badgeBg} ${stageCfg.badgeText} border border-current`}
              >
                {stageCfg.name}
              </span>
            </div>

            {/* Center Dynamic Artwork & Stage Icon */}
            <div className="my-auto text-center flex flex-col items-center justify-center z-10 py-6">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-700/50 shadow-inner mb-3 transform group-hover:scale-110 transition-transform duration-300">
                {stageCfg.icon}
              </div>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">
                {cropType}
              </h3>
              <p className="text-sm text-slate-300 font-medium mt-1">
                {quantity} kg • {origin}
              </p>
            </div>

            {/* Card Bottom Row */}
            <div className="flex justify-between items-end text-xs text-slate-400 font-mono z-10 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] text-slate-500">STAGE</p>
                <p className="font-bold text-slate-200">{activeStage} / 5</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500">UPDATED</p>
                <p className="text-slate-200">Just Now</p>
              </div>
            </div>
          </div>
        </div>

        {/* NFT Attributes & Stage Evolution Control (Right 7 Cols) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-6">
          {/* Metadata Overview */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Dynamic IPFS Metadata</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CROP TYPE</span>
                <span className="font-semibold text-slate-200">{cropType}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">QUANTITY</span>
                <span className="font-semibold text-slate-200">{quantity} kg</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ORIGIN</span>
                <span className="font-semibold text-slate-200">{origin}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">IPFS PROTOCOL</span>
                <span className="font-semibold text-emerald-400">Filecoin / IPFS</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              {stageCfg.description}
            </p>
          </div>

          {/* Interactive Stage Evolution Selector */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${updating ? "animate-spin" : ""}`} />
              <span>Visual Evolution Lifecycle</span>
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((stg) => {
                const isSelected = activeStage === stg;
                const cfg = STAGE_CONFIG[stg];
                return (
                  <button
                    key={stg}
                    onClick={() => handleStageUpdate(stg)}
                    disabled={updating}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 font-bold"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <span className="mb-1">{cfg.icon}</span>
                    <span className="text-[10px] truncate max-w-full">{cfg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Metadata & IPFS CID Link */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-1.5 text-slate-400">
              <FileCode className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-[11px] truncate max-w-[200px] sm:max-w-[280px]">
                {metadataURI}
              </span>
            </div>
            <a
              href={`https://ipfs.io/ipfs/${metadataURI.replace("ipfs://", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
            >
              <span>View IPFS</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropNFTVisualizer;
