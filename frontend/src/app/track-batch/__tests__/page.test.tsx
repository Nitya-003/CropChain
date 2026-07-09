import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockBatchData = {
  batchId: 'BATCH-001',
  cropType: 'rice',
  farmerName: 'John Farmer',
  quantity: 500,
  origin: 'Punjab',
  currentStage: 'farmer',
  updates: [
    { stage: 'farmer', timestamp: '2024-01-15', location: 'Farm A', notes: 'Harvested', actor: 'John' },
  ],
  currentTemperature: 72,
  currentHumidity: 65,
  isSpoiled: false,
  qrCode: '/qr/batch-001.png',
};

const { mockGetPublicBatch, mockUseBatchSocket, mockPush } = vi.hoisted(() => ({
  mockGetPublicBatch: vi.fn(),
  mockUseBatchSocket: vi.fn().mockReturnValue({ isConnected: false, lastUpdate: null }),
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../../../services/realCropBatchService', () => ({
  realCropBatchService: { getPublicBatch: mockGetPublicBatch },
}));

vi.mock('../../../hooks/useBatchSocket', () => ({
  useBatchSocket: () => mockUseBatchSocket(),
}));

const TrackBatch = (await import('../page')).default;

function renderTrackBatch() {
  return render(<TrackBatch />);
}

describe('TrackBatch Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBatchSocket.mockReturnValue({ isConnected: false, lastUpdate: null });
  });

  it('renders the search form', () => {
    renderTrackBatch();
    expect(screen.getByText('nav.trackBatch')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Batch ID/)).toBeInTheDocument();
    expect(screen.getByText('Track')).toBeInTheDocument();
  });

  it('shows searching state while searching', async () => {
    mockGetPublicBatch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderTrackBatch();
    const input = screen.getByPlaceholderText(/Enter Batch ID/);
    await user.type(input, 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });

  it('displays batch details on successful search', async () => {
    mockGetPublicBatch.mockResolvedValue(mockBatchData);
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      expect(screen.getByText('rice')).toBeInTheDocument();
      expect(screen.getByText('John Farmer')).toBeInTheDocument();
      expect(screen.getByText('500 kg')).toBeInTheDocument();
      expect(screen.getByText('Punjab')).toBeInTheDocument();
    });
  });

  it('displays IoT sensor data when available', async () => {
    mockGetPublicBatch.mockResolvedValue(mockBatchData);
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText('IoT Sensor Data')).toBeInTheDocument();
    });
  });

  it('shows spoilage alert when batch is spoiled', async () => {
    const spoiledBatch = { ...mockBatchData, isSpoiled: true, currentTemperature: 95 };
    mockGetPublicBatch.mockResolvedValue(spoiledBatch);
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText(/WARNING/)).toBeInTheDocument();
    });
  });

  it('shows EmptyState when batch is not found', async () => {
    mockGetPublicBatch.mockRejectedValue(new Error('not found'));
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'INVALID-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText('batch.batchNotFound')).toBeInTheDocument();
    });
  });

  it('shows ErrorState on search error', async () => {
    mockGetPublicBatch.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText(/We faced an issue/)).toBeInTheDocument();
    });
  });

  it('allows retry from ErrorState', async () => {
    mockGetPublicBatch.mockRejectedValueOnce(new Error('Network error'));
    mockGetPublicBatch.mockResolvedValueOnce(mockBatchData);
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText(/We faced an issue/)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Try Again'));
    await waitFor(() => {
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });
  });

  it('shows LIVE indicator when WebSocket is connected', async () => {
    mockGetPublicBatch.mockResolvedValue(mockBatchData);
    mockUseBatchSocket.mockReturnValue({ isConnected: true, lastUpdate: new Date() });
    const user = userEvent.setup();
    renderTrackBatch();
    await user.type(screen.getByPlaceholderText(/Enter Batch ID/), 'BATCH-001');
    await user.click(screen.getByText('Track'));
    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });
  });

  it('does not search when batchId is empty', async () => {
    const user = userEvent.setup();
    renderTrackBatch();
    await user.click(screen.getByText('Track'));
    expect(mockGetPublicBatch).not.toHaveBeenCalled();
  });
});
