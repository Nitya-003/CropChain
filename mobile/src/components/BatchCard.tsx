import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Batch } from "../types";
import { STAGE_COLORS, STAGE_LABELS } from "../utils/constants";

interface BatchCardProps {
  batch: Batch;
}

export function BatchCard({ batch }: BatchCardProps) {
  return (
    <View className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              {batch.crop}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[batch.stage] + "20" }}
            >
              <Text
                style={{ color: STAGE_COLORS[batch.stage] }}
                className="text-xs font-semibold"
              >
                {STAGE_LABELS[batch.stage]}
              </Text>
            </View>
          </View>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            ID: {batch.id}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Farmer: {batch.farmer}
          </Text>
        </View>
        <View
          className={`px-2 py-0.5 rounded-full ${batch.status === "active" ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}
        >
          <Text
            className={`text-xs font-medium ${batch.status === "active" ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}
          >
            {batch.status}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {batch.weight}
        </Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {batch.price}
        </Text>
      </View>
    </View>
  );
}
