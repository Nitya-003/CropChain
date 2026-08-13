import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCameraPermission } from "react-native-vision-camera";
import { useScanStore } from "../../src/services/scanStore";

export default function ScanScreen() {
  const { t } = useTranslation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [flash, setFlash] = useState(false);
  const [scanned, setScanned] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  const handleScan = useCallback(
    (data: string) => {
      if (isScanning) return;
      setIsScanning(true);
      setScanned(data);

      useScanStore.getState().setLastScanned(data);

      Alert.alert(t("batch.found"), `${t("batch.id")}: ${data}`, [
        {
          text: t("batch.title"),
          onPress: () => router.push(`/(tabs)/batches/${data}`),
        },
        {
          text: t("scan.title"),
          onPress: () => {
            setScanned("");
            setIsScanning(false);
          },
        },
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => setIsScanning(false),
        },
      ]);
    },
    [isScanning, t],
  );

  const simulateScan = () => {
    const sampleIds = [
      "CROP-2024-001",
      "CROP-2024-002",
      "CROP-2024-003",
      "CROP-BENGAL-004",
    ];
    const id = sampleIds[Math.floor(Math.random() * sampleIds.length)];
    handleScan(id);
  };

  if (!hasPermission) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-900 justify-center items-center px-6">
        <Ionicons name="camera" size={64} color="#9ca3af" />
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
          {t("scan.permissionRequired")}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
          {t("scan.permissionDescription")}
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="mt-6 bg-primary py-3 px-8 rounded-xl"
        >
          <Text className="text-white font-semibold">{t("scan.grantPermission")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Scanner placeholder - real camera view needs physical device */}
      <View className="flex-1 justify-center items-center bg-zinc-900">
        <View className="w-64 h-64 border-2 border-primary/60 rounded-2xl justify-center items-center">
          <Ionicons name="qr-code" size={80} color="rgba(22,163,74,0.3)" />
          <Text className="text-zinc-500 mt-4 text-sm text-center px-8">
            {t("scan.instructions")}
          </Text>
        </View>
      </View>

      {/* Controls overlay */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-900/90 px-6 pb-10 pt-6">
        <TouchableOpacity
          onPress={simulateScan}
          className="bg-primary/20 border border-primary py-3 rounded-xl items-center mb-4"
        >
          <Text className="text-primary font-bold">{t("scan.simulate")}</Text>
        </TouchableOpacity>
        <View className="flex-row justify-around">
          <TouchableOpacity
            onPress={() => setFlash(!flash)}
            className="items-center"
          >
            <Ionicons
              name={flash ? "flash" : "flash-off"}
              size={28}
              color="white"
            />
            <Text className="text-zinc-400 text-xs mt-1">{t("scan.flash")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center"
          >
            <Ionicons name="close-circle" size={28} color="white" />
            <Text className="text-zinc-400 text-xs mt-1">{t("scan.cancel")}</Text>
          </TouchableOpacity>
        </View>

        {scanned ? (
          <View className="mt-4 bg-zinc-800 p-3 rounded-xl">
            <Text className="text-white text-center text-sm font-mono">
              {scanned}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
