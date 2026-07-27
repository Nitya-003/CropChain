import { useState, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";

export function useBiometrics() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useState(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsAvailable(compatible && enrolled);
    })();
  });

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access CropChain",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
      });
      const success = result.success;
      setIsAuthenticated(success);
      return success;
    } catch {
      return false;
    }
  }, []);

  return { isAvailable, isAuthenticated, authenticate };
}
