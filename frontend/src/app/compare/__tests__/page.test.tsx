import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ComparePage from '../page';

// Mock values
const mockBatches = {
  'BATCH-001': {
    batchId: 'BATCH-001',
    cropType: 'rice',
    quantity: 500,
    harvestDate: '2024-01-15',
    origin: 'Punjab',
    farmerName: 'John Farmer',
    farmerAddress: 'Punjab Farm',
    currentStage: 'farmer',
    certifications: 'Organic',
    description: 'High-quality Basmati',
    createdAt: '2024-01-15T00:00:00.000Z',
    updates: [],
    qrCode: '/qr/1.png',
    isSpoiled: false,
  },
  'BATCH-002': {
    batchId: 'BATCH-002',
    cropType: 'wheat',
    quantity: 800,
    harvestDate: '2024-01-10',
    origin: 'Haryana',
    farmerName: 'Alice Farmer',
    farmerAddress: 'Haryana Farm',
    currentStage: 'mandi',
    certifications: 'None',
    description: 'Wheat description',
    createdAt: '2024-01-10T00:00:00.000Z',
    updates: [],
    qrCode: '/qr/2.png',
    isSpoiled: true,
  }
};

const { mockGetBatch, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockGetBatch: vi.fn(),
  mockPush: vi.fn(),
  mockSearchParams: vi.fn().mockReturnValue(new URLSearchParams('ids=BATCH-001,BATCH-002')),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock('@/services/realCropBatchService', () => ({
  realCropBatchService: { getBatch: mockGetBatch },
}));

vi.mock('@/components/Header', () => ({
  default: () => <header data-testid="mock-header">Header</header>,
}));

describe('ComparePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams('ids=BATCH-001,BATCH-002'));
  });

  it('renders loading state initially', () => {
    mockGetBatch.mockImplementation(() => new Promise(() => {}));
    render(<ComparePage />);
    const elements = document.getElementsByClassName('animate-pulse');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays comparison matrix for loaded batches', async () => {
    mockGetBatch.mockImplementation(async (id: keyof typeof mockBatches) => {
      return mockBatches[id];
    });

    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getByText('Batch Comparison')).toBeInTheDocument();
    });
  });

  it('shows error state when no batches are selected', async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams(''));
    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getByText('No batches selected for comparison')).toBeInTheDocument();
    });
  });
});
