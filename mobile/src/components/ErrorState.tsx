import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 justify-center items-center px-8 py-12">
      <View className="bg-red-100 dark:bg-red-900/30 p-5 rounded-full mb-4">
        <Ionicons name="alert-circle" size={40} color="#dc2626" />
      </View>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white text-center">{title}</Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} className="mt-6 flex-row items-center bg-gray-100 dark:bg-zinc-800 px-5 py-3 rounded-xl">
          <Ionicons name="refresh" size={18} color="#16a34a" />
          <Text className="text-primary font-semibold ml-2">Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
