import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <View className="flex-1 justify-center items-center px-6">
      <ActivityIndicator size="large" color="#16a34a" />
      <Text className="text-gray-500 dark:text-gray-400 mt-3 text-sm">{message}</Text>
    </View>
  );
}
