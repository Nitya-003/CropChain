import { Stack } from "expo-router";

export default function BatchesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[batchId]" />
    </Stack>
  );
}
