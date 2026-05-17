export const fetchCryptoPrices = async () => {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=polygon-pos,ethereum&vs_currencies=inr,usd"
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch prices: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn("CoinGecko API failed, using static fallback data for demonstration.", error);
    // Fallback data
    return {
      "polygon-pos": {
        inr: 85.50,
        usd: 1.05
      },
      "ethereum": {
        inr: 250450.00,
        usd: 3050.00
      }
    };
  }
};
