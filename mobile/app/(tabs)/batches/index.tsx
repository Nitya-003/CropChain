import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const MOCK_BATCHES = [
  { id: 'CROP-2024-001', crop: 'Rice', stage: 'mandi', farmer: 'Rajesh Kumar', date: '2024-03-15', status: 'active' },
  { id: 'CROP-2024-002', crop: 'Wheat', stage: 'transport', farmer: 'Amit Singh', date: '2024-03-10', status: 'active' },
  { id: 'CROP-2024-003', crop: 'Sugarcane', stage: 'farmer', farmer: 'Priya Sharma', date: '2024-03-20', status: 'pending' },
  { id: 'CROP-BENGAL-004', crop: 'Rice (Basmati)', stage: 'retailer', farmer: 'S K Verma', date: '2024-02-28', status: 'active' },
];

const stageColors: Record<string, string> = {
  farmer: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  mandi: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  transport: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  retailer: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
};

export default function BatchesScreen() {
  const [batches] = useState(MOCK_BATCHES);

  const renderBatch = ({ item }: { item: typeof MOCK_BATCHES[0] }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/batches/${item.id}`)}
      className="bg-white dark:bg-zinc-800 mx-5 mb-3 p-4 rounded-2xl shadow-sm"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{item.crop}</Text>
            <View className={`px-2 py-0.5 rounded-full ${stageColors[item.stage] || ''}`}>
              <Text className="text-xs font-semibold capitalize">{item.stage}</Text>
            </View>
          </View>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">Batch: {item.id}</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">Farmer: {item.farmer}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
        <Text className="text-xs text-gray-400 dark:text-gray-500">{item.date}</Text>
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-1 ${item.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
          <Text className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-900">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">Batches</Text>
        <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">{batches.length} batches</Text>
      </View>

      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        renderItem={renderBatch}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center pt-20">
            <Ionicons name="cube-outline" size={64} color="#9ca3af" />
            <Text className="text-gray-500 dark:text-gray-400 mt-4">No batches found. Scan a QR code to get started.</Text>
          </View>
        }
      />
    </View>
  );
}
