import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ActivityFeed from '../dashboard/ActivityFeed';
import { activityFeedService } from '../../services/activityFeedService';

// Mock the Auth Context
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'FARM123', name: 'Test Farmer', role: 'farmer' }
  })
}));

// Mock the activityFeedService
vi.mock('../../services/activityFeedService', () => ({
  activityFeedService: {
    getFeed: vi.fn(),
    getAllActivities: vi.fn()
  }
}));

describe('ActivityFeed Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    (activityFeedService.getFeed as any).mockReturnValue(new Promise(() => {}));
    render(<ActivityFeed />);
    expect(screen.getByText('Loading activity feed...')).toBeInTheDocument();
  });

  it('renders activities chronological timeline list', async () => {
    const mockActivities = [
      {
        _id: 'act1',
        eventType: 'crop_registered',
        timestamp: new Date().toISOString(),
        userId: 'FARM123',
        userRole: 'farmer',
        batchId: 'BATCH001',
        description: 'Crop registered description',
        metadata: {}
      }
    ];

    (activityFeedService.getFeed as any).mockResolvedValue({
      success: true,
      data: {
        activities: mockActivities,
        pagination: { totalItems: 1, currentPage: 1, totalPages: 1, limit: 10 }
      }
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Crop registered description')).toBeInTheDocument();
      expect(screen.getByText('Batch: BATCH001')).toBeInTheDocument();
    });
  });

  it('renders empty state when no activities returned', async () => {
    (activityFeedService.getFeed as any).mockResolvedValue({
      success: true,
      data: {
        activities: [],
        pagination: { totalItems: 0, currentPage: 1, totalPages: 1, limit: 10 }
      }
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('No activities found')).toBeInTheDocument();
    });
  });

  it('renders error state and retry works', async () => {
    (activityFeedService.getFeed as any)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        success: true,
        data: {
          activities: [],
          pagination: { totalItems: 0, currentPage: 1, totalPages: 1, limit: 10 }
        }
      });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('No activities found')).toBeInTheDocument();
    });
  });
});
