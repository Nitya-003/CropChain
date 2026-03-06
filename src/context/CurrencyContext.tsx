import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Currency = "CRYPTO" | "INR" | "USD";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(
    (localStorage.getItem("currency") as Currency) || "CRYPTO"
  );

  useEffect(() => {
    localStorage.setItem("currency", currency);
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }

  return context;
};
