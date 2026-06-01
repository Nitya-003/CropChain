import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

export function EmptyState({ icon = 'cube-outline', title, description }: EmptyStateProps) {
  return (
    <View className="flex-1 justify-center items-center px-8 py-12">
      <View className="bg-gray-100 dark:bg-zinc-800 p-5 rounded-full mb-4">
        <Ionicons name={icon} size={40} color="#9ca3af" />
      </View>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white text-center">{title}</Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">{description}</Text>
    </View>
  );
}
