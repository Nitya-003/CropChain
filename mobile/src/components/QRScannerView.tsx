import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QRScannerViewProps {
  onScan: (data: string) => void;
  hasPermission: boolean;
  flashEnabled: boolean;
  onToggleFlash: () => void;
  torchEnabled?: boolean;
}

export function QRScannerView({ onScan, hasPermission, flashEnabled, onToggleFlash }: QRScannerViewProps) {
  if (!hasPermission) {
    return (
      <View className="flex-1 justify-center items-center px-6">
        <Ionicons name="camera" size={64} color="#9ca3af" />
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Camera Permission Required</Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">Camera access is needed to scan QR codes.</Text>
      </View>
    );
  }

  const simulateScan = () => {
    const sampleIds = ['CROP-2024-001', 'CROP-2024-002', 'CROP-2024-003', 'CROP-BENGAL-004'];
    const id = sampleIds[Math.floor(Math.random() * sampleIds.length)];
    onScan(id);
  };

  return (
    <View className="flex-1">
      <View className="flex-1 justify-center items-center">
        <View className="w-64 h-64 border-2 border-primary/60 rounded-2xl justify-center items-center bg-zinc-900">
          <Ionicons name="qr-code" size={80} color="rgba(22,163,74,0.3)" />
          <Text className="text-zinc-500 mt-4 text-sm text-center px-8">Point camera at QR code</Text>
        </View>
      </View>

      <View className="px-6 pb-8">
        <TouchableOpacity onPress={simulateScan} className="bg-primary py-3.5 rounded-xl items-center mb-4">
          <View className="flex-row items-center">
            <Ionicons name="scan" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Simulate Scan (Demo)</Text>
          </View>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <TouchableOpacity onPress={onToggleFlash} className="items-center px-6">
            <Ionicons name={flashEnabled ? 'flash' : 'flash-off'} size={24} color="white" />
            <Text className="text-zinc-400 text-xs mt-1">Flash</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
