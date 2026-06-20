import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';

const { mockGetCropRecommendation, mockToast, mockPush } = vi.hoisted(() => ({
  mockGetCropRecommendation: vi.fn(),
  mockPush: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/crop-recommendation',
}));

vi.mock('../../../services/cropRecommendationService', () => ({
  getCropRecommendation: mockGetCropRecommendation,
}));

vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
}));

const CropRecommendationPage = (await import('../page')).default;

describe('CropRecommendation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default input values and forms correctly', () => {
    render(<CropRecommendationPage />);
    expect(screen.getByText('Smart Planting')).toBeInTheDocument();
  });

  it('submits form successfully and displays recommendation result', async () => {
    const mockResult = {
      crop: 'rice',
      confidence: 85,
      alternatives: [
        { crop: 'maize', confidence: 75 },
      ],
      timestamp: new Date().toISOString(),
    };
    mockGetCropRecommendation.mockResolvedValue(mockResult);

    const { container } = render(<CropRecommendationPage />);
    
    // Find form and submit it
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockGetCropRecommendation).toHaveBeenCalled();
      expect(screen.getByText('Recommendation Ready')).toBeInTheDocument();
      expect(screen.getByText('Rice')).toBeInTheDocument();
      expect(screen.getByText(/85% confidence/i)).toBeInTheDocument();
    });
  });

  it('handles submission error and shows toast error', async () => {
    mockGetCropRecommendation.mockRejectedValue(new Error('API failure'));

    const { container } = render(<CropRecommendationPage />);
    
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockGetCropRecommendation).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('API failure');
    });
  });
});
