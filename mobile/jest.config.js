module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-screens|react-native-vision-camera|@react-native-async-storage/async-storage|@react-native-community/netinfo|nativewind|expo-router|expo-secure-store|expo-notifications|expo-local-authentication|expo-crypto|expo-auth-session|expo-web-browser|expo-constants)/",
  ],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  clearMocks: true,
};
