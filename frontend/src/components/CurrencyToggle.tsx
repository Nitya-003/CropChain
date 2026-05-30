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
    <div className="flex items-center space-x-2">
      {(isFetching || showUpdated) && (
        <span className={`text-xs animate-pulse ${isFetching ? 'text-yellow-500 dark:text-yellow-400' : 'text-green-500 dark:text-green-400'}`}>
          {isFetching ? 'Updating...' : 'Price Updated'}
        </span>
      )}
      <select
        value={currency}
        onChange={handleChange}
        className="border border-border rounded-lg px-3 py-1.5 text-xs font-semibold bg-background dark:bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 h-9"
      >
        <option value="CRYPTO">Crypto</option>
        <option value="INR">INR (₹)</option>
        <option value="USD">USD ($)</option>
      </select>
    </div>
  );
};
