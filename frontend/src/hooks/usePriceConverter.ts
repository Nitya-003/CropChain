import { useCryptoPrices } from "./useCryptoPrices";
import { useCurrency } from "../context/CurrencyContext";


export const usePriceConverter = () => {
  const { data, isError, isLoading } = useCryptoPrices();
  const { currency } = useCurrency();

  const convert = (amount: number, token: "MATIC" | "ETH") => {
    if (currency === "CRYPTO" || isError || isLoading || !data) {
      return `${amount} ${token}`;
    }

    const maticData = data["polygon-pos"];
    const ethData = data["ethereum"];

    let rate: number | undefined;

    if (token === "MATIC") {
      if (currency === "INR") {
        rate = maticData?.inr ?? maticData?.usd;
      } else {
        rate = maticData?.usd;
      }
    } else {
      if (currency === "INR") {
        rate = ethData?.inr ?? ethData?.usd;
      } else {
        rate = ethData?.usd;
      }
    }

    if (!rate) return `${amount} ${token}`;

    const value = (amount * rate).toFixed(2);
    const symbol = currency === "INR" ? "₹" : "$";

    return `${symbol}${value}`;
  };

  return { convert, isLoading };
};
