import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { biometricAuthService } from "../../src/services/biometricAuthService";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    biometricAuthService.getBiometricsEnabled().then(setBiometricEnabled);
  }, []);

  const toggleBiometrics = async () => {
    const nextState = !biometricEnabled;
    const success = await biometricAuthService.setBiometricsEnabled(nextState);
    if (success) {
      setBiometricEnabled(nextState);
      Alert.alert(
        "🔒 Biometric Authentication",
        nextState
          ? "Fingerprint / FaceID security lock enabled!"
          : "Biometric security lock disabled."
      );
    } else {
      Alert.alert("Authentication Failed", "Could not verify hardware biometrics.");
    }
  };

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const menuItems = [
    { icon: "notifications" as const, label: t("profile.notifications"), right: "Toggle" },
    {
      icon: "shield-checkmark" as const,
      label: t("profile.biometricLock"),
      right: "Toggle",
    },
    { icon: "information-circle" as const, label: t("profile.about"), right: "v1.0.0" },
  ];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-900">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("profile.title")}
        </Text>
      </View>

      {/* Profile Card */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-6 items-center shadow-sm">
        <View className="w-20 h-20 bg-primary/10 rounded-full items-center justify-center mb-4">
          <Ionicons name="person" size={40} color="#16a34a" />
        </View>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          {user?.name || t("roles.guest")}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-sm">
          {user?.email || "Not signed in"}
        </Text>
        {user?.role ? (
          <View className="mt-2 px-4 py-1 bg-primary/10 rounded-full">
            <Text className="text-primary text-sm font-semibold capitalize">
              {t(`roles.${user.role}`, user.role)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Language Switcher */}
      <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm">
        <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
          {t("profile.selectLanguage")}
        </Text>
        <View className="flex-row gap-2">
          {[
            { code: "en", name: t("common.english") },
            { code: "hi", name: t("common.hindi") },
            { code: "es", name: t("common.spanish") },
          ].map((lang) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => changeLanguage(lang.code)}
              className={`flex-1 py-2 px-1 rounded-xl items-center border ${
                i18n.language === lang.code
                  ? "bg-primary border-primary"
                  : "bg-gray-100 dark:bg-zinc-700 border-transparent"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  i18n.language === lang.code
                    ? "text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
              {t("profile.darkMode")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            className={`w-12 h-7 rounded-full ${isDark ? "bg-primary" : "bg-gray-300"} justify-center ${isDark ? "items-end" : "items-start"} px-1`}
          >
            <View className="w-5 h-5 bg-white rounded-full shadow-sm" />
          </TouchableOpacity>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleBiometrics}
          className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-700"
        >
          <View className="flex-row items-center">
            <Ionicons name="finger-print" size={22} color="#16a34a" />
            <Text className="ml-3 text-gray-900 dark:text-white font-medium">
              Biometric Lock (फ़िंगरप्रिंट अनलॉक)
            </Text>
          </View>
          <View
            className={`w-12 h-7 rounded-full ${biometricEnabled ? "bg-primary" : "bg-gray-300"} justify-center ${biometricEnabled ? "items-end" : "items-start"} px-1`}
          >
            <View className="w-5 h-5 bg-white rounded-full shadow-sm" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Wallet Info */}
      {user?.walletAddress ? (
        <View className="mx-5 mb-6 bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t("profile.connectedWallet")}
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
            <Text className="text-red-600 font-semibold ml-2">{t("auth.logout")}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="mx-5 bg-primary py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-semibold">{t("auth.signIn")}</Text>
        </TouchableOpacity>
      )}

      <View className="h-8" />
    </View>
  );
}

