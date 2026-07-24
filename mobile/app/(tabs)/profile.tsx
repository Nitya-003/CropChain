import { View, Text, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const menuItems = [
    { icon: "notifications" as const, label: "Notifications", right: "Toggle" },
    {
      icon: "shield-checkmark" as const,
      label: "Biometric Lock",
      right: "Toggle",
    },
    { icon: "information-circle" as const, label: "About", right: "v1.0.0" },
  ];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-900">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Profile
        </Text>
      </View>

      {/* Profile Card */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-6 items-center shadow-sm">
        <View className="w-20 h-20 bg-primary/10 rounded-full items-center justify-center mb-4">
          <Ionicons name="person" size={40} color="#16a34a" />
        </View>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          {user?.name || "Guest"}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-sm">
          {user?.email || "Not signed in"}
        </Text>
        {user?.role ? (
          <View className="mt-2 px-4 py-1 bg-primary/10 rounded-full">
            <Text className="text-primary text-sm font-semibold capitalize">
              {user.role}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Menu */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm">
        <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-700">
          <View className="flex-row items-center">
            <Ionicons
              name={isDark ? "moon" : "sunny"}
              size={22}
              color="#16a34a"
            />
            <Text className="ml-3 text-gray-900 dark:text-white font-medium">
              Dark Mode
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            className={`w-12 h-7 rounded-full ${isDark ? "bg-primary" : "bg-gray-300"} justify-center ${isDark ? "items-end" : "items-start"} px-1`}
          >
            <View className="w-5 h-5 bg-white rounded-full shadow-sm" />
          </TouchableOpacity>
        </TouchableOpacity>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            className={`flex-row items-center justify-between px-5 py-4 ${index < menuItems.length - 1 ? "border-b border-gray-100 dark:border-zinc-700" : ""}`}
          >
            <View className="flex-row items-center">
              <Ionicons name={item.icon} size={22} color="#16a34a" />
              <Text className="ml-3 text-gray-900 dark:text-white font-medium">
                {item.label}
              </Text>
            </View>
            <Text className="text-gray-400 text-sm">{item.right}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Wallet Info */}
      {user?.walletAddress ? (
        <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Connected Wallet
          </Text>
          <Text className="text-gray-900 dark:text-white text-sm font-mono">
            {user.walletAddress}
          </Text>
        </View>
      ) : null}

      {/* Logout */}
      {user ? (
        <TouchableOpacity
          onPress={handleLogout}
          disabled={isLoading}
          className="mx-5 bg-white dark:bg-zinc-800 py-4 rounded-2xl items-center shadow-sm border border-red-100 dark:border-red-900/30"
        >
          <View className="flex-row items-center">
            <Ionicons name="log-out" size={20} color="#dc2626" />
            <Text className="text-red-600 font-semibold ml-2">Log Out</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="mx-5 bg-primary py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-semibold">Sign In</Text>
        </TouchableOpacity>
      )}

      <View className="h-8" />
    </View>
  );
}
