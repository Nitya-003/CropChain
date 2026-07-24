"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { CurrencyProvider } from "../context/CurrencyContext";
import { Toaster } from "react-hot-toast";
import { NotificationProvider } from "../context/NotificationContext";
import "../i18n/config"; // Initialize i18n client-side

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <Toaster position="top-right" reverseOrder={false} />
              {children}
            </CurrencyProvider>
          </ThemeProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
