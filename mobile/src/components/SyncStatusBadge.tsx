import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SyncStatusBadgeProps {
  status: "idle" | "syncing" | "error";
  pendingCount: number;
}

export function SyncStatusBadge({
  status,
  pendingCount,
}: SyncStatusBadgeProps) {
  if (status === "idle" && pendingCount === 0) return null;

  const config = {
    syncing: {
      icon: "sync" as const,
      text: "Syncing...",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-700 dark:text-blue-300",
      iconColor: "#2563eb",
    },
    error: {
      icon: "alert-circle" as const,
      text: "Sync Error",
      bg: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-700 dark:text-red-300",
      iconColor: "#dc2626",
    },
    idle: {
      icon: "cloud-upload" as const,
      text: `${pendingCount} pending`,
      bg: "bg-amber-50 dark:bg-amber-900/20",
      textColor: "text-amber-700 dark:text-amber-300",
      iconColor: "#d97706",
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <View className={`flex-row items-center px-3 py-2 rounded-xl ${c.bg}`}>
      <Ionicons name={c.icon} size={16} color={c.iconColor} />
      <Text className={`text-xs font-medium ml-1.5 ${c.textColor}`}>
        {c.text}
      </Text>
    </View>
  );
}
