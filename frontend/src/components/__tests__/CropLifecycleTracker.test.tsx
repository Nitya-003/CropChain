import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CropLifecycleTracker } from '../journey/CropLifecycleTracker';
import React from 'react';

// Mock framer-motion to avoid animation timing in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('CropLifecycleTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    // Mock fetch that remains pending
    const pendingFetch = new Promise(() => {});
    vi.stubGlobal('fetch', () => pendingFetch);

    const { container } = render(<CropLifecycleTracker batchId="BATCH123" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders error state and friendly retry UI on failure', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: false,
      status: 500
    }));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Lifecycle Progress')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry Loading' })).toBeInTheDocument();
    });
  });

  it('renders empty state banner for newly created batch', async () => {
    const mockData = {
      success: true,
      data: {
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
      }
    };

    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData)
    }));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(screen.getByText('Lifecycle has just started.')).toBeInTheDocument();
    });
  });

  it('renders completed, current, and upcoming stages correctly', async () => {
    const mockData = {
      success: true,
      data: {
        currentStage: 'Growing',
        completionPercentage: 33,
        stageHistory: [
          {
            stage: 'Registered',
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
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
      }
    };

    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData)
    }));

    render(<CropLifecycleTracker batchId="BATCH123" />);

    await waitFor(() => {
      expect(screen.getByText('Crop Lifecycle Progress Tracker')).toBeInTheDocument();
      // Progress bar percentage check
      expect(screen.getByText(/33%/)).toBeInTheDocument();
      // Stage labels checking
      expect(screen.getAllByText('Registered').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Growing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Harvested').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Quality Checked').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Transported').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
    });
  });
});
