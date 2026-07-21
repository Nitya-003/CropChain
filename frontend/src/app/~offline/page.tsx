import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline - CropChain",
};

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <WifiOff className="w-24 h-24 text-gray-400 mb-6" />
      <h1 className="text-3xl font-bold mb-4">You are offline</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md">
        It seems you've lost your internet connection. Don't worry, you can
        still view pages you've previously visited.
      </p>
      <a
        href="/"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
      >
        Return to Home
      </a>
    </div>
  );
}
