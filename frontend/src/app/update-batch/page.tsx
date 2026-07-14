"use client";
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Search,
  Package,
  Clock,
  User,
  MapPin,
  Shield,
  Lock,
  Thermometer,
  Copy,
  Check
} from "lucide-react";
import Timeline from '../../components/Timeline';
import { realCropBatchService } from '../../services/realCropBatchService';
import toast from 'react-hot-toast';
import { FormSkeleton, BatchInfoSkeleton } from '../../components/skeletons';
import { useRbac } from '../../hooks/useRbac';
import { ethers } from 'ethers';
import { getContract, getSigner, hasMetaMask } from '../../utils/web3';

const UpdateBatch: React.FC = () => {
  const { t } = useTranslation();
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { canUpdateToStage, getNextAllowedStage, getRoleDisplayName } = useRbac();
  const [updateData, setUpdateData] = useState({
    actor: '',
    stage: '',
    location: '',
    notes: '',
    timestamp: new Date().toISOString().split('T')[0]
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRequestingIoT, setIsRequestingIoT] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [transactionLocked, setTransactionLocked] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<{
    
  hash: string;
  status: 'Confirmed' | 'Pending';
} | null>(null);
const [transactionStage, setTransactionStage] = useState<
  'idle' | 'wallet' | 'confirming'
>('idle');
const [copied, setCopied] = useState(false);


  const stages = [
    { value: 'farmer', label: t('updateBatch.farmerStage') },
    { value: 'mandi', label: t('updateBatch.mandiStage') },
    { value: 'transport', label: t('updateBatch.transportStage') },
    { value: 'retailer', label: t('updateBatch.retailerStage') }
  ];

  // Filter stages based on user permissions
  const allowedStages = stages.filter(stage => canUpdateToStage(stage.value));
  
  // Get next allowed stage for current batch
  const nextAllowedStage = batch ? getNextAllowedStage(batch.currentStage) : null;

  const handleSearch = async () => {
    if (!batchId.trim()) return;

    setIsSearching(true);
    setBatch(null); 

    try {
      const foundBatch = await realCropBatchService.getBatch(batchId);
      setBatch(foundBatch);
      toast.success(`Batch ${batchId} found successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch not found. Please check the ID and try again.';
      toast.error(errorMessage);
      console.error('Batch not found:', error);
      setBatch(null);
    } finally {
      setIsSearching(false);
    }
  };

  const stageMap: Record<string, number> = {
    'farmer': 0,
    'mandi': 1,
    'transport': 2,
    'retailer': 3
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!batch) {
      setTransactionLocked(false);
      return;
    }
    
    // RBAC Check: Verify user can update to this stage
    if (!canUpdateToStage(updateData.stage)) {
      toast.error(`You are not authorized to update to stage: ${updateData.stage}`);
      return;
    }

    setIsUpdating(true);
    let txHash = '';

    try {
      // Direct Web3 MetaMask updateBatch if wallet is connected and MetaMask is available
      if (hasMetaMask()) {
        try {
          const signer = await getSigner();
          if (signer) {
            const contract = await getContract();
            if (contract) {
              toast.loading('Minting supply chain update on-chain...', { id: 'web3-update' });
              
              const stageNum = stageMap[updateData.stage.toLowerCase()] ?? 0;
              const tx = await contract.updateBatch(
                ethers.encodeBytes32String(batch.batchId),
                stageNum,
                updateData.actor,
                updateData.location,
                updateData.notes || 'Stage update recorded'
              );
              
              const receipt = await tx.wait();
              txHash = receipt.hash || tx.hash;
              toast.success('Successfully updated on-chain!', { id: 'web3-update' });
            }
          }
        } catch (web3Err: any) {
          console.error("Web3 update failed:", web3Err);
          toast.error(`Web3 update failed, queueing for background sync: ${web3Err.message || web3Err}`, { id: 'web3-update' });
        }
      }

      // Submit update to backend API
      const updatedBatch = await realCropBatchService.updateBatch(batch.batchId, {
        stage: updateData.stage,
        actor: updateData.actor,
        location: updateData.location,
        notes: updateData.notes,
        timestamp: new Date(updateData.timestamp).toISOString(),
        blockchainHash: txHash || undefined
      });
      
      setBatch(updatedBatch);
      toast.success(`Batch updated successfully! New stage: ${updateData.stage}`);
      setUpdateData({
        actor: '',
        stage: '',
        location: '',
        notes: '',
        timestamp: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update batch. Please try again.';
      toast.error(errorMessage);
      console.error('Failed to update batch:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setUpdateData({
      ...updateData,
      [e.target.name]: e.target.value
    });
  };

  const handleRequestIoTVerification = async () => {
    if (transactionLocked) {
       toast.error("Transaction already in progress.");
  return;
}

setTransactionLocked(true);
    if (!batch || !batch.batchId) {
      toast.error('Please search for a batch first');
      return;
    }

    // Check if user has permission to request IoT verification
    const userRole = getRoleDisplayName();
    const canRequestIoT = userRole === 'Transporter' || userRole === 'Market';
    
    if (!canRequestIoT) {
      toast.error('Only Transporters and Mandi operators can request IoT verification');
      return;
    }

   setIsRequestingIoT(true);
setTransactionStage('wallet');
    
    try {
      // Call smart contract to request IoT verification
      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
      const contractABI = [
        "function requestIoTVerification(bytes32 batchId) external"
      ];
      
      const { ethereum } = window as any;
      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, contractABI, signer);
        
        // Convert batch ID to bytes32
        const batchIdBytes32 = ethers.encodeBytes32String(batch.batchId);
        
        const tx = await contract.requestIoTVerification(batchIdBytes32);
        
        setTransactionStage('confirming');
const loadingToast = toast.loading("Waiting for blockchain confirmation...");
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        toast.dismiss(loadingToast);
        setTransactionDetails({
          hash: receipt.transactionHash,
          status: 'Confirmed'
        });
        
        toast.success(`IoT verification requested! Transaction: ${receipt.transactionHash}`);
        
        // Refresh batch data to show updated status
        setTimeout(async () => {
          try {
            const updatedBatch = await realCropBatchService.getBatch(batch.batchId);
            setBatch(updatedBatch);
          } catch (error) {
            console.error('Error refreshing batch data:', error);
            toast.dismiss(loadingToast);
          }
        }, 2000);
        
      } else {
        toast.error('Please install MetaMask to use this feature');
      }
    } catch (error) {
  toast.dismiss();

  console.error('Error requesting IoT verification:', error);
  toast.error('Failed to request IoT verification. Please try again.');
}finally {
     setIsRequestingIoT(false);
setTransactionStage('idle');
      setIsRequestingIoT(false);
      setTransactionLocked(false);
    }
  };

  const getTimelineEvents = (batchData: any) => {
    if (!batchData || !batchData.updates) return [];

    return batchData.updates.map((update: any) => ({
      title: update.stage.charAt(0).toUpperCase() + update.stage.slice(1),
      date: update.timestamp,
      location: update.location || t('updateBatch.unknownLocation'),
      description: update.notes || `${t('updateBatch.processedBy', 'Processed by')} ${update.actor}`
    }));
  };

  const getStageIndex = (stage: string) => {
    const stagesList = ['farmer', 'mandi', 'transport', 'retailer'];
    const idx = stagesList.indexOf(stage?.toLowerCase());
    return idx >= 0 ? idx : 0;
  };
const handleCopyTransactionHash = async () => {
  if (!transactionDetails) return;

  try {
    await navigator.clipboard.writeText(transactionDetails.hash);

    setCopied(true);

    toast.success("Transaction hash copied!");

    setTimeout(() => {
      setCopied(false);
    }, 2000);

  } catch {
    toast.error("Failed to copy transaction hash.");
  }
};

useEffect(() => {
  const checkWalletConnection = async () => {
    const { ethereum } = window as any;

    if (!ethereum) {
      setWalletConnected(false);
      setWalletAddress('');
      return;
    }

    try {
      const accounts = await ethereum.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        setWalletConnected(true);
        setWalletAddress(accounts[0]);
      } else {
        setWalletConnected(false);
        setWalletAddress('');
      }
    } catch {
      setWalletConnected(false);
      setWalletAddress('');
    }
  };

  checkWalletConnection();

  const { ethereum } = window as any;

  if (ethereum) {
    ethereum.on('accountsChanged', checkWalletConnection);
    ethereum.on('connect', checkWalletConnection);

    return () => {
      ethereum.removeListener('accountsChanged', checkWalletConnection);
       ethereum.removeListener('connect', checkWalletConnection);
    };
  }
}, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-end mb-4">
  {walletConnected ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
      <span className="w-2 h-2 rounded-full bg-green-500"></span>
      Connected
      <span className="font-mono">
        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
      </span>
    </div>
  ) : (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
      <span className="w-2 h-2 rounded-full bg-red-500"></span>
      Disconnected
    </div>
  )}
</div>
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">{t('updateBatch.title')}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">{t('updateBatch.subtitle')}</p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
          <Search className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
          {t('updateBatch.findBatch')}
        </h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder={t('updateBatch.enterBatchIdPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !batchId.trim()}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${isSearching || !batchId.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
              } text-white`}
          >
            {isSearching ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{isSearching ? t('updateBatch.searching') : t('filters.search')}</span>
          </button>
        </div>
      </div>

      {/* LOADING STATE 1: Searching for batch */}
      {isSearching && (
        <div className="space-y-6">
          <BatchInfoSkeleton />
          <FormSkeleton />
        </div>
      )}

      {/* LOADING STATE 2: Updating batch (show real batch info + form skeleton) */}
      {!isSearching && isUpdating && batch && (
        <>
          {/* Show the ACTUAL batch information (not skeleton) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
              <Package className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
              {t('updateBatch.batchInformation')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('updateBatch.cropType')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white capitalize">{batch.cropType}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('updateBatch.quantity')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.quantity} kg</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('batch.farmer')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.farmerName}</p>
              </div>
            </div>
          </div>

          <FormSkeleton />
          </>
      )}

      {/* NORMAL STATE: Show everything (not searching, not updating) */}
      {!isSearching && !isUpdating && batch && (
        <>
          {/* Batch Info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
              <Package className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
              {t('updateBatch.batchInformation')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('updateBatch.cropType')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white capitalize">{batch.cropType}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('updateBatch.quantity')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.quantity} kg</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('batch.farmer')}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.farmerName}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
              <Clock className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
              {t('updateBatch.supplyChainTimeline')}
            </h2>
            <Timeline events={getTimelineEvents(batch)} currentStep={getStageIndex(batch.currentStage)} />
          </div>

          {/* Custodian Handover Card (Web3) */}
          {hasMetaMask() && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
                <Shield className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
                Decentralized Handover (Web3)
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  To hand custody of this batch over to the next actor, authorize their wallet address below.
                </p>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Next Custodian Wallet Address (e.g. 0x...)"
                    id="nextCustodianAddress"
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const input = document.getElementById('nextCustodianAddress') as HTMLInputElement;
                      const address = input?.value?.trim();
                      if (!ethers.isAddress(address)) {
                        toast.error('Invalid Ethereum address');
                        return;
                      }
                      
                      const loadingToast = toast.loading('Authorizing next custodian on-chain...');
                      try {
                        const contract = await getContract();
                        if (contract) {
                          const tx = await contract.approveCustodian(
                            ethers.encodeBytes32String(batch.batchId),
                            address
                          );
                          await tx.wait();
                          toast.success('Successfully authorized next custodian!', { id: loadingToast });
                          if (input) input.value = '';
                        } else {
                          toast.error('Could not connect to contract', { id: loadingToast });
                        }
                      } catch (err: any) {
                        console.error('Handover authorization failed:', err);
                        toast.error(`Handover failed: ${err.message || err}`, { id: loadingToast });
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all cursor-pointer font-medium"
                  >
                    Approve Custodian
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Update Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
              <RefreshCw className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
              {t('updateBatch.addNewUpdate')}
            </h2>
            
            {/* RBAC Permission Notice */}
            {nextAllowedStage ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">
                      {t('updateBatch.nextAllowedStage')}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      {t('updateBatch.nextStageDescription', { stage: nextAllowedStage })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                      {t('updateBatch.accessRestricted')}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {t('updateBatch.roleNotAuthorized', { role: getRoleDisplayName() })}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    <User className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    {t('updateBatch.actorName')}
                  </label>
                  <input
                    type="text"
                    name="actor"
                    value={updateData.actor}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder={t('updateBatch.actorPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    {t('updateBatch.stage')}
                  </label>
                  <select
                    name="stage"
                    value={updateData.stage}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">{t('updateBatch.selectStage')}</option>
                    {allowedStages.map(stage => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    <MapPin className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    {t('updateBatch.location')}
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={updateData.location}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder={t('updateBatch.locationPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    <Clock className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    {t('updateBatch.date')}
                  </label>
                  <input
                    type="date"
                    name="timestamp"
                    value={updateData.timestamp}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                  {t('updateBatch.notes')}
                </label>
                <textarea
                  name="notes"
                  value={updateData.notes}
                  onChange={handleUpdateChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder={t('updateBatch.notesPlaceholder')}
                />
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isUpdating || !nextAllowedStage}
                  className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center space-x-2 ${
                    isUpdating || !nextAllowedStage
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 transform hover:scale-105 shadow-lg'
                    } text-white`}
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>{t('updateBatch.addingUpdate')}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>{t('updateBatch.addUpdate')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* IoT Verification Button */}
              {batch && (getRoleDisplayName() === 'Transporter' || getRoleDisplayName() === 'Market') && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleRequestIoTVerification}
                     disabled={isRequestingIoT || transactionLocked}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        isRequestingIoT || !batch.batchId
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105 shadow-lg'
                        } text-white`}
                    >
                      {isRequestingIoT ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          <span>
                            {transactionStage === 'wallet'
                              ? 'Confirm in Wallet...'
                              : t('updateBatch.requesting')}
                          </span>
                        </>
                      ) : (
                        <>
                          <Thermometer className="h-4 w-4" />
                          <span>{t('updateBatch.requestIoTVerification')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    {t('updateBatch.iotDescription')}
                  </p>
                  {transactionDetails && (
  <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
    <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-4">
      ✅ Transaction Confirmed
    </h3>

    <div className="flex justify-between items-center">
  <span className="font-medium">Status</span>

  <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold">
    {transactionDetails.status}
  </span>
</div>

      <div>
        <p className="font-medium mb-2">Transaction Hash</p>

        <div className="flex items-center gap-2 flex-wrap">
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs break-all">
            {`${transactionDetails.hash.slice(0, 10)}...${transactionDetails.hash.slice(-8)}`}
          </code>

          <button
  onClick={handleCopyTransactionHash}
  className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-all ${
    copied
      ? "bg-green-600 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white"
  }`}
>
  {copied ? (
    <>
      <Check className="h-3 w-3" />
      Copied!
    </>
  ) : (
    <>
      <Copy className="h-3 w-3" />
      Copy
    </>
  )}
</button>

          
          <a
            href={`https://sepolia.etherscan.io/tx/${transactionDetails.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs text-center"
          >
            View on Etherscan
          </a>
        </div>
      </div>
    </div>
  
)}
              </div>               
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default UpdateBatch;