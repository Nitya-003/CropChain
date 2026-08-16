"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { realCropBatchService } from "../../services/realCropBatchService";
import { useRbac } from "../../hooks/useRbac";
import { sanitizeObject } from "../../lib/sanitize";
import { batchFormSchema } from "../../lib/schemas";
import { InlineAlert } from "../../components/InlineAlert";
import { ethers } from "ethers";
import { getContract, getSigner, hasMetaMask, signMetaTransaction, getContractAddress } from "../../utils/web3";

const AddBatchContent: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions, getRoleDisplayName } = useRbac();

  const cropTypeQuery = searchParams.get("cropType") || "";

  const [formData, setFormData] = useState({
    farmerName: "",
    farmerAddress: "",
    cropType: "",
    quantity: "",
    harvestDate: "",
    origin: "",
    certifications: "",
    description: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formAlert, setFormAlert] = useState<{ title?: string; message?: string; details?: string[] } | null>(null);

  // Set crop type from query param if available
  useEffect(() => {
    if (cropTypeQuery) {
      setFormData((prev) => ({
        ...prev,
        cropType: cropTypeQuery.toLowerCase(),
      }));
    }
  }, [cropTypeQuery]);

  // Get today's date for max date constraint
  const today = new Date().toISOString().split("T")[0];

  const validateField = (name: string, data: typeof formData): string => {
    const result = batchFormSchema.safeParse(data);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === name);
      return issue ? issue.message : "";
    }
    return "";
  };

  const validateForm = (): boolean => {
    const result = batchFormSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      const detailsList: string[] = [];
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[String(issue.path[0])] = issue.message;
          detailsList.push(issue.message);
        }
      });
      setFieldErrors(errors);
      setFormAlert({
        title: "Validation Error",
        message: "Please correct the following errors before submitting:",
        details: detailsList,
      });
      return false;
    }
    setFieldErrors({});
    setFormAlert(null);
    return true;
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name } = e.target;
    const message = validateField(name, formData);

    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (message) {
        // Field is still invalid — keep (or update) the error instead
        // of silently clearing it.
        copy[name] = message;
      } else {
        delete copy[name];
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const sanitizedData = sanitizeObject(formData);

      // Step 1: Register crop in database
      const createBatchPromise =
        realCropBatchService.createBatch(sanitizedData);
      const batch = await toast.promise(createBatchPromise, {
        loading: "Registering crop in database...",
        success: (data) => `Crop registered! ID: ${data.batchId}`,
        error: (err) =>
          `Registration failed: ${err.message || "Unknown error"}`,
      });

      // Step 2: Mint provenance record on-chain using connected wallet
      if (hasMetaMask()) {
        try {
          const signer = await getSigner();
          if (signer) {
            const contract = await getContract();
            if (contract) {
              toast.loading("Signing meta-transaction...", {
                id: "web3-sync",
              });

              // Prepare the function call data
              const functionData = contract.interface.encodeFunctionData("createBatch", [
                ethers.encodeBytes32String(batch.batchId),
                ethers.encodeBytes32String(batch.cropType.toUpperCase()),
                "QmYwAPJhy5n2aBhajbN7yXq3TqK6Lj5ee2ov3333333333",
                BigInt(batch.quantity),
                batch.farmerName,
                batch.origin,
                batch.description || "Initial harvest recorded"
              ]);

              const signerAddress = await signer.getAddress();
              const targetContract = getContractAddress();
              
              // Get nonce from relayer
              const nonceRes = await fetch(`http://localhost:3001/api/relayer/nonce/${signerAddress}`);
              const nonceData = await nonceRes.json();
              const nonce = parseInt(nonceData.data.nonce);

              // Sign meta transaction (gasless)
              const { request, signature } = await signMetaTransaction(
                signerAddress,
                targetContract,
                functionData,
                nonce
              );

              toast.loading("Relaying meta-transaction...", {
                id: "web3-sync",
              });

              // Send to relayer
              const relayRes = await fetch("http://localhost:3001/api/relayer/forward", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ request, signature })
              });

              const relayData = await relayRes.json();
              
              if (!relayRes.ok) {
                throw new Error(relayData.error || "Meta-transaction relay failed");
              }

              const txHash = relayData.data.transactionHash;

              // Step 3: Update backend with actual transaction hash
              const updated = await realCropBatchService.updateBatch(
                batch.batchId,
                {
                  blockchainHash: txHash,
                },
              );

              batch.blockchainHash = txHash;
              toast.success("Successfully minted on-chain!", {
                id: "web3-sync",
              });
            }
          }
        } catch (web3Err: any) {
          console.error("Web3 sync failed:", web3Err);
          toast.error(
            `Web3 minting failed, queued for background sync: ${web3Err.message || web3Err}`,
            { id: "web3-sync" },
          );
        }
      }

      setGeneratedBatch(batch);
      setSuccess(true);

      setFormData({
        farmerName: "",
        farmerAddress: "",
        cropType: "",
        quantity: "",
        harvestDate: "",
        origin: "",
        certifications: "",
        description: "",
      });
    } catch (error) {
      console.error("Failed to create batch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[e.target.name];
      return copy;
    });
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setGeneratedBatch(null);
  };

  // Build select crop type options dynamically to accommodate advice
  const defaultCrops = ["rice", "wheat", "corn"];
  const cropOptions = [...defaultCrops];
  if (
    formData.cropType &&
    !cropOptions.includes(formData.cropType.toLowerCase())
  ) {
    cropOptions.push(formData.cropType.toLowerCase());
  }

  if (!permissions.canCreateBatch) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-xl p-6 text-center">
          <Shield className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">
            Access Denied
          </h2>
          <p className="text-red-700 dark:text-red-300">
            Only farmers can create batches. Your current role does not have permission.
          </p>
        </div>
      </div>
    );
  }

  if (success && generatedBatch) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              {t("batch.batchCreatedSuccess")}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              {t("batch.batchCreatedMessage")}
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t("batch.batchId")}
              </p>
              <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400">
                {generatedBatch.batchId}
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleCreateAnother}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
              >
                {t("batch.createAnother")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6 relative">
          {formAlert && (
            <InlineAlert
              variant="error"
              title={formAlert.title}
              message={formAlert.message}
              details={formAlert.details}
              onDismiss={() => setFormAlert(null)}
              className="mb-6"
            />
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.farmerName")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="farmerName"
                  value={formData.farmerName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.farmerName ? "border-red-500 dark:border-red-400 pr-10" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.farmerName && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              {fieldErrors.farmerName && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.farmerName}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.farmerAddress")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="farmerAddress"
                  value={formData.farmerAddress}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.farmerAddress ? "border-red-500 dark:border-red-400 pr-10" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.farmerAddress && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              {fieldErrors.farmerAddress && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.farmerAddress}
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.cropType")}
              </label>
              <div className="relative">
                <select
                  name="cropType"
                  value={formData.cropType}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 capitalize ${fieldErrors.cropType ? "border-red-500 dark:border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                >
                  <option value="">{t("batch.selectCropType")}</option>
                  {cropOptions.map((crop) => (
                    <option key={crop} value={crop}>
                      {crop}
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.cropType && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.cropType}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.quantity")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.quantity ? "border-red-500 dark:border-red-400 pr-10" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.quantity && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              {fieldErrors.quantity && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.quantity}
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.harvestDate")}
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="harvestDate"
                  value={formData.harvestDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  max={today}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.harvestDate ? "border-red-500 dark:border-red-400 pr-10" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.harvestDate && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              {fieldErrors.harvestDate && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.harvestDate}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
                {t("batch.origin")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.origin ? "border-red-500 dark:border-red-400 pr-10" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.origin && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              {fieldErrors.origin && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  {fieldErrors.origin}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">
              {t("batch.description")}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={4}
              className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors.description ? "border-red-500 dark:border-red-400" : "border-gray-300 dark:border-gray-600"}`}
            />
          </div>

          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-green-650 text-white rounded-lg font-semibold shadow-md transition-colors"
            >
              {isLoading ? "Creating..." : t("batch.createBatch")}
            </button>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 rounded-xl flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Submitting to blockchain...
                </p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default function AddBatch() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <AddBatchContent />
    </Suspense>
  );
}
