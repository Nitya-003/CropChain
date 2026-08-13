import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications().then(setExpoPushToken);
    .catch(err => console.error(err))