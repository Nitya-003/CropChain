import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSync } from '../../src/contexts/SyncContext';
import { useState } from 'react';

const quickActions = [
  { label: 'Scan QR', icon: 'qr-code' as const, route: '/(tabs)/scan', color: '#16a34a' },
  { label: 'Add Batch', icon: 'add-circle' as const, route: '/(tabs)/batches', color: '#2563eb' },
  { label: 'Track', icon: 'locate' as const, route: '/(tabs)/batches', color: '#d97706' },
];

const statsCards = [
  { label: 'Active Batches', value: '12', icon: 'layers' as const, color: '#16a34a' },
  { label: 'Pending Sync', value: '3', icon: 'cloud-upload' as const, color: '#d97706' },
  { label: 'Alerts', value: '1', icon: 'notifications' as const, color: '#dc2626' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { pendingCount } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  const roleColors: Record<string, string> = {
    farmer: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    mandi: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    transporter: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    retailer: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    admin: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-zinc-900"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(false); }} />}>
      <View className="px-5 pt-14 pb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Hello, {user?.name || 'Guest'}
        </Text>
        {user?.role ? (
          <View className={`self-start mt-1 px-3 py-0.5 rounded-full ${roleColors[user.role] || ''}`}>
            <Text className="text-xs font-semibold capitalize">{user.role}</Text>
          </View>
        ) : null}
      </View>

      {pendingCount > 0 && (
        <View className="mx-5 mb-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl flex-row items-center">
          <Ionicons name="cloud-upload" size={20} color="#d97706" />
          <Text className="text-amber-700 dark:text-amber-300 ml-2 text-sm font-medium">
            {pendingCount} item{pendingCount > 1 ? 's' : ''} pending sync
          </Text>
        </View>
      )}

      <View className="flex-row px-5 gap-3 mb-6">
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={() => router.push(action.route as any)}
            className="flex-1 bg-white dark:bg-zinc-800 p-4 rounded-2xl items-center shadow-sm"
          >
            <View style={{ backgroundColor: action.color + '15' }} className="p-3 rounded-xl mb-2">
              <Ionicons name={action.icon} size={24} color={action.color} />
            </View>
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-5 mb-6">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">Overview</Text>
        <View className="flex-row gap-3">
          {statsCards.map((stat) => (
            <View key={stat.label} className="flex-1 bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm">
              <Ionicons name={stat.icon} size={20} color={stat.color} />
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="px-5 pb-8">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">Recent Batches</Text>
        <View className="bg-white dark:bg-zinc-800 rounded-2xl p-8 items-center shadow-sm">
          <Ionicons name="cube-outline" size={48} color="#9ca3af" />
          <Text className="text-gray-500 dark:text-gray-400 mt-3 text-center">Scan a QR code or add a batch to get started</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/scan')}
            className="mt-4 bg-primary px-6 py-2.5 rounded-xl"
          >
            <Text className="text-white font-semibold">Scan Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
