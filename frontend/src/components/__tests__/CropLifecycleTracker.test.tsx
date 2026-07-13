import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import { CropLifecycleTracker } from '../journey/CropLifecycleTracker';
import { apiClient } from '../../services/apiClient';
import React, { type HTMLAttributes, type ReactNode } from 'react';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock framer-motion to avoid animation timing in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const createAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe('CropLifecycleTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    const { container } = render(<CropLifecycleTracker batchId="BATCH123" />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/batches/BATCH123/lifecycle');
  });

  it('renders error state and friendly retry UI on failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Request failed'));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Lifecycle Progress')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry Loading' })).toBeInTheDocument();
    });
  });

  it('renders empty state banner for newly created batch', async () => {
    const lifecycleData = {
      currentStage: 'Registered',
      completionPercentage: 17,
      stageHistory: [
        {
          stage: 'Registered',
          timestamp: new Date().toISOString(),
          updatedBy: 'Farmer Bob',
          notes: 'Batch created'
        }
      ]
    };

    vi.mocked(apiClient.get).mockResolvedValue(createAxiosResponse({
      success: true,
      data: lifecycleData
    }));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/batches/BATCH123/lifecycle');
      expect(screen.getByText('Lifecycle has just started.')).toBeInTheDocument();
    });
  });

  it('renders completed, current, and upcoming stages from the response payload', async () => {
    const lifecycleData = {
      currentStage: 'Growing',
      completionPercentage: 33,
      stageHistory: [
        {
          stage: 'Registered',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          updatedBy: 'Farmer Bob',
          notes: 'Batch created'
        },
        {
          stage: 'Growing',
          timestamp: new Date().toISOString(),
          updatedBy: 'Farmer Bob',
          notes: 'Growing phase started'
        }
      ]
    };

    vi.mocked(apiClient.get).mockResolvedValue(createAxiosResponse({
      success: true,
      data: lifecycleData
    }));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(screen.getByText('Crop Lifecycle Progress Tracker')).toBeInTheDocument();
      expect(screen.getByText(/33%/)).toBeInTheDocument();
      expect(screen.getAllByText('Registered').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Growing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Harvested').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Quality Checked').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Transported').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
    });
  });
});
