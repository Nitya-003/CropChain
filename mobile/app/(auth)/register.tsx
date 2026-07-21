import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";

const ROLES = [
  { key: "farmer", label: "Farmer", icon: "tractor" },
  { key: "mandi", label: "Mandi (Market)", icon: "storefront" },
  { key: "transporter", label: "Transporter", icon: "car" },
  { key: "retailer", label: "Retailer", icon: "basket" },
] as const;

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("farmer");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    try {
      await register(name, email, password, role);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white dark:bg-zinc-900"
    >
      <ScrollView className="flex-1 px-6 pt-12">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Ionicons name="arrow-back" size={24} color="#16a34a" />
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          Create Account
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-400 mb-8">
          Join the CropChain network
        </Text>

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
              Full Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
            />
          </View>
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
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Your Role
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  className={`flex-row items-center px-4 py-2.5 rounded-xl border ${
                    role === r.key
                      ? "bg-primary/10 border-primary"
                      : "bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700"
                  }`}
                >
                  <Ionicons
                    name={r.icon as any}
                    size={18}
                    color={role === r.key ? "#16a34a" : "#9ca3af"}
                  />
                  <Text
                    className={`ml-2 text-sm font-medium ${role === r.key ? "text-primary" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          disabled={isLoading}
          className="bg-primary py-3.5 rounded-xl items-center mb-4"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Create Account
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center pb-8">
          <Text className="text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text className="text-primary font-semibold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
