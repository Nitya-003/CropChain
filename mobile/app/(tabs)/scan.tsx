import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCameraPermission } from "react-native-vision-camera";
import { useScanStore } from "../../src/services/scanStore";
import { batchService } from "../../src/services/batch.service";
import { BLESoilScanModal } from "../../src/components/BLESoilScanModal";
import type { SoilReading } from "../../src/services/bleSensorService";

export default function ScanScreen() {
  const { t } = useTranslation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [flash, setFlash] = useState(false);
  const [scanned, setScanned] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // Bulk Mode State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [scannedBatches, setScannedBatches] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Submit Form State
  const [stage, setStage] = useState("IN_TRANSIT");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [bleModalVisible, setBleModalVisible] = useState(false);

  const handleBleReading = (reading: SoilReading) => {
    Alert.alert(
      "🌱 BLE Soil Sensor Reading Captured",
      `N: ${reading.nitrogen} | P: ${reading.phosphorus} | K: ${reading.potassium}\npH: ${reading.ph} | Moisture: ${reading.moisture}%`,
      [{ text: "OK" }]
    );
  };

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  const handleScan = useCallback(
    (data: string) => {
      if (isScanning && !isBulkMode) return;
      
      if (!isBulkMode) {
        setIsScanning(true);
        setScanned(data);
        useScanStore.getState().setLastScanned(data);

        Alert.alert("Batch Found", `Batch ID: ${data}`, [
          {
            text: "View Details",
            onPress: () => router.push(`/(tabs)/batches/${data}`),
          },
          {
            text: "Scan Again",
            onPress: () => {
              setScanned("");
              setIsScanning(false);
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsScanning(false),
          },
        ]);
      } else {
        // Bulk Mode processing
        if (!scannedBatches.includes(data)) {
            setScannedBatches(prev => [...prev, data]);
            setScanned(data);
            // Visual feedback briefly
            setTimeout(() => setScanned(""), 1500);
        }
      }
    },
    [isScanning, isBulkMode, scannedBatches],
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
      "CROP-2024-005",
      "CROP-2024-006",
    ];
    const id = sampleIds[Math.floor(Math.random() * sampleIds.length)];
    handleScan(id);
  };

  const submitBulkUpdate = async () => {
    if (!location.trim()) {
        Alert.alert("Validation Error", "Please provide a location.");
        return;
    }
    setIsSubmitting(true);
    try {
        await batchService.bulkUpdateStage(scannedBatches, {
            stage: stage as any,
            location,
            notes,
            actorName: "Transporter",
        });
        
        setShowBulkModal(false);
        setScannedBatches([]);
        setLocation("");
        setNotes("");
        Alert.alert("Success", `Successfully updated ${scannedBatches.length} batches.`);
    } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to bulk update batches.");
    } finally {
        setIsSubmitting(false);
    }
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
      {/* Top Header with Bulk Mode Toggle */}
      <View className="absolute top-12 left-0 right-0 z-10 px-6 flex-row justify-between items-center">
        <View className="bg-zinc-900/80 px-4 py-2 rounded-full flex-row items-center gap-3">
          <Text className="text-white font-semibold">Bulk Mode</Text>
          <Switch
            value={isBulkMode}
            onValueChange={setIsBulkMode}
            trackColor={{ false: "#3f3f46", true: "#16a34a" }}
            thumbColor="#ffffff"
          />
        </View>
        
        {isBulkMode && (
          <View className="bg-primary/90 px-4 py-2 rounded-full">
            <Text className="text-white font-bold">{scannedBatches.length} Scanned</Text>
          </View>
        )}
      </View>

      {/* Scanner placeholder */}
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
        {isBulkMode && scannedBatches.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowBulkModal(true)}
              className="bg-green-600 py-4 rounded-xl items-center mb-4 shadow-lg shadow-green-900"
            >
              <Text className="text-white font-bold text-lg">
                Process {scannedBatches.length} Batches
              </Text>
            </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => setBleModalVisible(true)}
          className="bg-emerald-600/30 border border-emerald-500 py-3 rounded-xl items-center mb-4"
        >
          <Text className="text-emerald-400 font-bold">📡 Pair BLE Soil Sensor Probe</Text>
        </TouchableOpacity>
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

        <BLESoilScanModal
          visible={bleModalVisible}
          onClose={() => setBleModalVisible(false)}
          onSelectReading={handleBleReading}
        />

        {scanned ? (
          <View className="mt-4 bg-zinc-800 p-3 rounded-xl">
            <Text className="text-green-400 text-center text-sm font-mono font-bold">
              + {scanned} added
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bulk Submit Modal */}
      <Modal
        visible={showBulkModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBulkModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-white dark:bg-zinc-900 rounded-t-3xl p-6 h-[70%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                Bulk Update ({scannedBatches.length})
              </Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                <Ionicons name="close-circle" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="space-y-4 mb-8">
                <View>
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Target Stage
                  </Text>
                  <View className="bg-gray-100 dark:bg-zinc-800 rounded-xl p-3 border border-gray-200 dark:border-zinc-700">
                    <Text className="text-gray-900 dark:text-white font-medium">{stage}</Text>
                  </View>
                </View>

                <View>
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Location *
                  </Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Enter current location (e.g. Warehouse A)"
                    placeholderTextColor="#9ca3af"
                    className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-4 border border-gray-200 dark:border-zinc-700"
                  />
                </View>

                <View>
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional details"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-4 border border-gray-200 dark:border-zinc-700 h-24"
                  />
                </View>
                
                <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mt-4">
                  <Text className="text-blue-800 dark:text-blue-300 text-sm">
                    This will update {scannedBatches.length} batches simultaneously. This action cannot be undone.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={submitBulkUpdate}
              disabled={isSubmitting}
              className={`py-4 rounded-xl items-center shadow-lg ${
                isSubmitting ? 'bg-green-800' : 'bg-green-600'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Confirm Bulk Update</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
