import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  bleSensorService,
  BLEDiscoveredDevice,
  SoilReading,
} from "../services/bleSensorService";

interface BLESoilScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectReading: (reading: SoilReading) => void;
}

export const BLESoilScanModal: React.FC<BLESoilScanModalProps> = ({
  visible,
  onClose,
  onSelectReading,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDiscoveredDevice[]>([]);
  const [selectedReading, setSelectedReading] = useState<SoilReading | null>(null);

  const handleStartScan = async () => {
    setIsScanning(true);
    setDevices([]);
    setSelectedReading(null);
    const discovered = await bleSensorService.scanDevices();
    setDevices(discovered);
    setIsScanning(false);
  };

  const handleConnect = async (device: BLEDiscoveredDevice) => {
    setIsScanning(true);
    const reading = await bleSensorService.readProbeData(device.id);
    setSelectedReading(reading);
    setIsScanning(false);
  };

  const handleImport = () => {
    if (selectedReading) {
      onSelectReading(selectedReading);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>📡 BLE / NFC Soil Probe Scanner</Text>
          <Text style={styles.subtitle}>
            Tap or connect your agricultural IoT probe to read soil NPK metrics.
          </Text>

          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleStartScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.scanBtnText}>🔍 Scan Nearby Probes</Text>
            )}
          </TouchableOpacity>

          <ScrollView style={styles.deviceList}>
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceCard}
                onPress={() => handleConnect(device)}
              >
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceInfo}>
                  Signal: {device.rssi} dBm | Battery: {device.batteryLevel}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedReading && (
            <View style={styles.readingCard}>
              <Text style={styles.readingTitle}>✅ Sensor Reading Captured</Text>
              <Text style={styles.readingText}>
                N: {selectedReading.nitrogen} mg/kg | P: {selectedReading.phosphorus} mg/kg | K: {selectedReading.potassium} mg/kg
              </Text>
              <Text style={styles.readingText}>
                pH: {selectedReading.ph} | Moisture: {selectedReading.moisture}% | Temp: {selectedReading.temperature}°C
              </Text>
              <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
                <Text style={styles.importBtnText}>📥 Import into Form</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxHeight: "85%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#4b5563",
    marginBottom: 16,
  },
  scanBtn: {
    backgroundColor: "#16a34a",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  scanBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  deviceList: {
    maxHeight: 160,
    marginBottom: 16,
  },
  deviceCard: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  deviceName: {
    fontWeight: "bold",
    color: "#15803d",
    fontSize: 14,
  },
  deviceInfo: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  readingCard: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  readingTitle: {
    fontWeight: "bold",
    color: "#047857",
    fontSize: 15,
    marginBottom: 6,
  },
  readingText: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 4,
  },
  importBtn: {
    backgroundColor: "#059669",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  importBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  closeBtn: {
    alignItems: "center",
    padding: 10,
  },
  closeBtnText: {
    color: "#6b7280",
    fontWeight: "600",
  },
});
