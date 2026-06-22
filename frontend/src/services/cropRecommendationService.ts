import { apiClient } from './apiClient';
import { AxiosError } from 'axios';

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

const MAX_RETRIES = 3;
const BASE_DELAY = 200;

const cache = new Map<string, { data: RecommendationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheKey(params: RecommendationRequest): string {
  return `${params.N}:${params.P}:${params.K}:${params.pH}:${params.temperature}:${params.humidity}:${params.rainfall}`;
}

function getCached(key: string): RecommendationResult | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: RecommendationResult): void {
  if (cache.size >= 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

export async function getCropRecommendation(
  params: RecommendationRequest
): Promise<RecommendationResult> {
  const key = cacheKey(params);
  const cached = getCached(key);
  if (cached) return cached;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await apiClient.post('/recommend', params);
      const result = (response.data?.data ?? response.data) as RecommendationResult;
      setCache(key, result);
      return result;
    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, attempt)));
      }
    }
  }
  const axiosError = lastError as AxiosError<{ message?: string }> | null;
  throw new Error(axiosError?.response?.data?.message || lastError?.message || 'Recommendation service unavailable');
}
