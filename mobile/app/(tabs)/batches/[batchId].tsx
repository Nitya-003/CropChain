import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSync } from "../../../src/contexts/SyncContext";
import { useAuth } from "../../../src/contexts/AuthContext";
import { batchService } from "../../../src/services/batch.service";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { ErrorState } from "../../../src/components/ErrorState";
import type { Batch, BatchStage } from "../../../src/types";

const stageFlow: BatchStage[] = ["farmer", "mandi", "transport", "retailer"];

const stageDetails: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  farmer: { label: "Farm", icon: "tractor", color: "#6366f1" },
  mandi: { label: "Mandi Market", icon: "storefront", color: "#d97706" },
  transport: { label: "In Transit", icon: "car", color: "#2563eb" },
  retailer: { label: "Retail", icon: "basket", color: "#9333ea" },
};

export default function BatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const { addToQueue } = useSync();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [updateLocation, setUpdateLocation] = useState("");

  useEffect(() => {
    if (!batchId) return;

    const fetchBatch = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await batchService.getBatchById(batchId);
        setBatch(data);
      } catch (err: any) {
        setError(err.message || "Failed to load batch");
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [batchId]);

  const currentStageIndex = batch ? stageFlow.indexOf(batch.stage) : -1;

  const handleStageUpdate = async (newStage: BatchStage) => {
    if (!batch?.id) return;
    const actor = user?.name.trim();
    const location = updateLocation.trim();
    if (!actor || actor.length < 2 || location.length < 2) {
      alert(
        "A signed-in user and an update location of at least 2 characters are required",
      );
      return;
    }
    try {
      await addToQueue({
        batchId: batch.id,
        action: "stage_update",
        data: { stage: newStage, actor, location },
      });
      setUpdateLocation("");
      alert("Update queued for sync");
    } catch {
      alert("Failed to queue update");
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading batch details..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-900">
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
          }}
        />
      </View>
    );
  }

  if (!batch) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-900 justify-center items-center px-6">
        <Ionicons name="alert-circle" size={64} color="#9ca3af" />
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
          Batch Not Found
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
          No batch found with ID "{batchId}"
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-primary py-3 px-8 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-zinc-900">
      <View className="px-5 pt-14 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#16a34a" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 dark:text-white flex-1">
            Batch Details
          </Text>
        </View>
        <Text className="text-gray-500 dark:text-gray-400 text-sm font-mono">
          {batch.id}
        </Text>
      </View>

      {/* Journey Timeline */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm">
        <Text className="text-base font-bold text-gray-900 dark:text-white mb-4">
          Journey
        </Text>
        {stageFlow.map((stage, index) => {
          const detail = stageDetails[stage];
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isUpcoming = index > currentStageIndex;

          return (
            <View key={stage} className="flex-row items-start mb-1">
              <View className="items-center mr-3">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isCompleted
                      ? "bg-green-100 dark:bg-green-900/30"
                      : isCurrent
                        ? "bg-primary/10"
                        : "bg-gray-100 dark:bg-zinc-700"
                  }`}
                >
                  <Ionicons
                    name={detail.icon as any}
                    size={16}
                    color={
                      isCompleted
                        ? "#16a34a"
                        : isCurrent
                          ? "#16a34a"
                          : "#9ca3af"
                    }
                  />
                </View>
                {index < stageFlow.length - 1 && (
                  <View
                    className={`w-0.5 h-8 ${isCompleted ? "bg-green-400" : "bg-gray-200 dark:bg-zinc-700"}`}
                  />
                )}
              </View>
              <View className="flex-1 pb-4">
                <Text
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {detail.label}
                </Text>
                {isCurrent && (
                  <Text className="text-xs text-primary mt-0.5 font-medium">
                    Current Stage
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Batch Info */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm">
        <Text className="text-base font-bold text-gray-900 dark:text-white mb-4">
          Information
        </Text>
        <View className="space-y-3">
          {[
            { label: "Crop", value: batch.crop },
            { label: "Farmer", value: batch.farmer },
            { label: "Location", value: batch.location },
            { label: "Weight", value: batch.weight },
            { label: "Price", value: batch.price },
            { label: "Status", value: batch.status },
          ].map((item) => (
            <View key={item.label} className="flex-row justify-between">
              <Text className="text-gray-500 dark:text-gray-400 text-sm">
                {item.label}
              </Text>
              <Text className="text-gray-900 dark:text-white text-sm font-medium capitalize">
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stage Update */}
      {currentStageIndex >= 0 && currentStageIndex < stageFlow.length - 1 && (
        <View className="mx-5 mb-8">
          <Text className="text-base font-bold text-gray-900 dark:text-white mb-3">
            Update Stage
          </Text>
          <TextInput
            value={updateLocation}
            onChangeText={setUpdateLocation}
            placeholder="Current update location"
            maxLength={200}
            className="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <View className="flex-row gap-2">
            {stageFlow
              .slice(currentStageIndex + 1, currentStageIndex + 2)
              .map((stage) => {
                const detail = stageDetails[stage];
                return (
                  <TouchableOpacity
                    key={stage}
                    onPress={() => handleStageUpdate(stage)}
                    className={`flex-1 p-3 rounded-xl items-center border ${
                      stage === "mandi"
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                        : stage === "transport"
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                    }`}
                  >
                    <Ionicons
                      name={detail.icon as any}
                      size={20}
                      color={detail.color}
                    />
                    <Text className="text-xs font-semibold mt-1 text-gray-700 dark:text-gray-300">
                      {detail.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}
