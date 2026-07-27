import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  NotificationService,
  Notification,
} from "../../services/notification.service";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "alerts">("all");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await NotificationService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, []),
  );

  const markAsRead = async (id: string) => {
    try {
      await NotificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "alerts") return n.type === "alert" || n.type === "recall";
    return true;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case "alert":
        return "warning";
      case "recall":
        return "shield-half";
      case "sync":
        return "sync";
      case "approval":
        return "checkmark-circle";
      default:
        return "information-circle";
    }
  };

  const getIconColorForType = (type: string) => {
    switch (type) {
      case "alert":
        return "#f59e0b"; // amber-500
      case "recall":
        return "#f43f5e"; // rose-500
      case "sync":
        return "#3b82f6"; // blue-500
      case "approval":
        return "#10b981"; // emerald-500
      default:
        return "#6366f1"; // indigo-500
    }
  };

  const getBgColorForType = (type: string, read: boolean) => {
    if (read) return "#ffffff";
    switch (type) {
      case "alert":
        return "#fffbeb"; // amber-50
      case "recall":
        return "#fff1f2"; // rose-50
      default:
        return "#f0fdf4"; // primary-50 (emerald-50)
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: getBgColorForType(item.type, item.read) },
      ]}
      onPress={() => !item.read && markAsRead(item._id)}
      disabled={item.read}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getIconForType(item.type) as any}
          size={24}
          color={getIconColorForType(item.type)}
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, !item.read && styles.bold]}>
            {item.title}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.message, !item.read && styles.boldMessage]}>
          {item.message}
        </Text>
        {!item.read && (
          <Text style={styles.markReadText}>Tap to mark as read</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={markAllAsRead}
          disabled={!notifications.some((n) => !n.read)}
        >
          <Ionicons
            name="checkmark-done"
            size={24}
            color={notifications.some((n) => !n.read) ? "#10b981" : "#9ca3af"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "all" && styles.filterButtonActive,
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.filterTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "unread" && styles.filterButtonActive,
          ]}
          onPress={() => setFilter("unread")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "unread" && styles.filterTextActive,
            ]}
          >
            Unread
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "alerts" && styles.filterAlertActive,
          ]}
          onPress={() => setFilter("alerts")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "alerts" && styles.filterTextActive,
            ]}
          >
            Alerts
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchNotifications} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={64}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>No notifications found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  filterContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
  },
  filterButtonActive: {
    backgroundColor: "#10b981",
  },
  filterAlertActive: {
    backgroundColor: "#f43f5e",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
    marginRight: 8,
  },
  bold: {
    fontWeight: "bold",
    color: "#111827",
  },
  timestamp: {
    fontSize: 12,
    color: "#6b7280",
  },
  message: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  boldMessage: {
    color: "#374151",
    fontWeight: "500",
  },
  markReadText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#9ca3af",
    fontWeight: "500",
  },
});
