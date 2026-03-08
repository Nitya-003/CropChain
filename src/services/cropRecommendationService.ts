const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface RecommendationRequest {
  N: number;
  P: number;
  K: number;
  pH: number;
  temperature: number;
  humidity: number;
  rainfall: number;
}

export interface CropAlternative {
  crop: string;
  confidence: number;
}

export interface RecommendationResult {
  crop: string;
  confidence: number;
  alternatives: CropAlternative[];
  timestamp: string;
}

export async function getCropRecommendation(
  params: RecommendationRequest
): Promise<RecommendationResult> {
  const response = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.message || json?.error || 'Recommendation request failed');
  }

  // Server wraps in apiResponse.successResponse → { success, data, message }
  return (json.data ?? json) as RecommendationResult;
}
