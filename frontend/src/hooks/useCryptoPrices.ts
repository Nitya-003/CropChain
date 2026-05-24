import { useQuery } from "@tanstack/react-query";
import { fetchCryptoPrices } from "../services/priceService";

interface useCryptoPrices {
  "polygon-pos"?: {
    inr?: number;
    usd?: number;
  };
  ethereum?: {
    inr?: number;
    usd?: number;
  };
}


export const useCryptoPrices = () => {
  return useQuery({
    queryKey: ["crypto-prices"],
    queryFn: fetchCryptoPrices,
    refetchInterval: 60000, // 60 seconds
    staleTime: 60000,
  });
};
