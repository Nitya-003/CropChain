import { apiClient } from './apiClient';

export interface Auction {
  _id: string;
  cropId: string;
  batchId: string;
  farmerId: string;
  startPrice: number;
  currentHighestBid: number;
  highestBidder: string | null;
  startTime: string;
  endTime: string;
  status: 'active' | 'ended' | 'cancelled';
  batchDetails?: {
    cropType: string;
    quantity: number;
    farmerName: string;
    origin: string;
    certifications?: string;
    description?: string;
  };
  farmerName?: string;
  highestBidderName?: string | null;
}

export interface Bid {
  _id: string;
  auctionId: string;
  userId: string;
  userName: string;
  cropId: string;
  bidAmount: number;
  timestamp: string;
}

export const auctionService = {
  createAuction: async (batchId: string, startPrice: number, duration: number): Promise<Auction> => {
    const response = await apiClient.post<{ data: { auction: Auction } }>('/auctions', { batchId, startPrice, duration });
    return response.data.data.auction;
  },

  getAllAuctions: async (params?: any): Promise<Auction[]> => {
    const response = await apiClient.get<{ data: { auctions: Auction[] } }>('/auctions', { params });
    return response.data.data.auctions;
  },

  getAuction: async (id: string): Promise<Auction> => {
    const response = await apiClient.get<{ data: { auction: Auction } }>(`/auctions/${id}`);
    return response.data.data.auction;
  },

  getBids: async (auctionId: string): Promise<Bid[]> => {
    const response = await apiClient.get<{ data: { bids: Bid[] } }>(`/auctions/${auctionId}/bids`);
    return response.data.data.bids;
  }
};
