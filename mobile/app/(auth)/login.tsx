import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";

export default function LoginScreen() {
  const { login, connectWallet, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    }
  };

  const handleWalletLogin = async () => {
    setError("");
    try {
      await connectWallet();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Wallet connection failed");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white dark:bg-zinc-900"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-10">
          <View className="bg-primary/10 p-4 rounded-2xl mb-4">
            <Ionicons name="leaf" size={40} color="#16a34a" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            CropChain
          </Text>
          <Text className="text-base text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your account
          </Text>
        </View>

        {error ? (
          <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl mb-4">
            <Text className="text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </Text>
          </View>
        ) : null}

        <View className="space-y-4 mb-6">
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </Text>
            <View className="flex-row items-center bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                className="flex-1 px-4 py-3 text-gray-900 dark:text-white"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="px-3"
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleEmailLogin}
            disabled={isLoading}
            className="bg-primary py-3.5 rounded-xl items-center"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-gray-300 dark:bg-zinc-700" />
          <Text className="mx-4 text-gray-500 dark:text-gray-400 text-sm">
            or
          </Text>
          <View className="flex-1 h-px bg-gray-300 dark:bg-zinc-700" />
        </View>

        <TouchableOpacity
          onPress={handleWalletLogin}
          disabled={isLoading}
          className="flex-row items-center justify-center py-3.5 rounded-xl border border-gray-300 dark:border-zinc-700"
        >
          <Ionicons name="wallet" size={20} color="#16a34a" />
          <Text className="text-gray-700 dark:text-gray-300 font-semibold ml-2">
            Connect Wallet
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-8">
          <Text className="text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text className="text-primary font-semibold">Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
