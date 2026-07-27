import React, { useEffect, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { useCryptoPrices } from "../hooks/useCryptoPrices";

export const CurrencyToggle = () => {
  const { currency, setCurrency } = useCurrency();
  const { isFetching, dataUpdatedAt } = useCryptoPrices();
  const [showUpdated, setShowUpdated] = useState(false);

  useEffect(() => {
    if (dataUpdatedAt) {
      setShowUpdated(true);
      const timer = setTimeout(() => setShowUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [dataUpdatedAt]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrency(e.target.value as "CRYPTO" | "INR" | "USD");
  };

  return (
    <div className="flex shrink-0 items-center space-x-2">
      {(isFetching || showUpdated) && (
        <span
          className={`hidden text-xs animate-pulse sm:inline ${isFetching ? "text-yellow-500 dark:text-yellow-400" : "text-green-500 dark:text-green-400"}`}
        >
          {isFetching ? "Updating..." : "Price Updated"}
        </span>
      )}
      <select
        value={currency}
        onChange={handleChange}
        className="h-9 max-w-[5.75rem] rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-card sm:max-w-none sm:px-3"
      >
        <option value="CRYPTO">Crypto</option>
        <option value="INR">INR (₹)</option>
        <option value="USD">USD ($)</option>
      </select>
    </div>
  );
};
