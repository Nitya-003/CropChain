import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { mockCreateBatch, mockUseRbac, mockPush } = vi.hoisted(() => ({
  mockCreateBatch: vi.fn(),
  mockUseRbac: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../../../services/realCropBatchService', () => ({
  realCropBatchService: { createBatch: mockCreateBatch },
}));

vi.mock('../../../hooks/useRbac', () => ({
  useRbac: () => mockUseRbac(),
}));

const AddBatch = (await import('../page')).default;

function renderAddBatch(role: string = 'farmer') {
  mockUseRbac.mockReturnValue({
    permissions: {
      canCreateBatch: role === 'farmer',
      canUpdateToMandi: false,
      canUpdateToTransport: false,
      canUpdateToRetailer: false,
      canViewAdminDashboard: false,
      canRecallBatch: false,
    },
    getRoleDisplayName: () => role.charAt(0).toUpperCase() + role.slice(1),
    userRole: role,
    canUpdateToStage: vi.fn(),
    getNextAllowedStage: vi.fn(),
    hasAnyRole: vi.fn(),
    hasRole: vi.fn(),
  });
  return render(<AddBatch />);
}

function fillRequiredFields() {
  const cropSelect = screen.getAllByRole('combobox')[0];
  fireEvent.change(cropSelect, { target: { name: 'cropType', value: 'rice' } });
  const quantityInput = screen.getByRole('spinbutton');
  fireEvent.change(quantityInput, { target: { name: 'quantity', value: '100' } });
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const harvestDateInput = document.querySelector('input[name="harvestDate"]')!;
  fireEvent.change(harvestDateInput, { target: { name: 'harvestDate', value: yesterday } });
}

function submitForm() {
  const btn = screen.getByRole('button', { name: /createBatch/i });
  const form = btn.closest('form')!;
  fireEvent.submit(form);
}

describe('AddBatch Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Access Denied for non-farmer users', () => {
    renderAddBatch('retailer');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/Only farmers can create batches/)).toBeInTheDocument();
  });

  it('shows Access Denied for admin (no createBatch permission)', () => {
    renderAddBatch('admin');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders the batch creation form for farmer', async () => {
    renderAddBatch('farmer');
    await waitFor(() => {
      expect(screen.getByText(/batch\.createBatch/)).toBeInTheDocument();
    });
  });

  it('renders all form fields for farmer', async () => {
    renderAddBatch('farmer');
    await waitFor(() => {
      expect(screen.getByText(/batch\.farmerName/)).toBeInTheDocument();
      expect(screen.getByText(/batch\.farmerAddress/)).toBeInTheDocument();
      expect(screen.getByText(/batch\.cropType/)).toBeInTheDocument();
      expect(screen.getByText(/batch\.quantity/)).toBeInTheDocument();
      expect(screen.getByText(/batch\.harvestDate/)).toBeInTheDocument();
      expect(screen.getByText(/batch\.origin/)).toBeInTheDocument();
    });
  });

  it('calls createBatch on form submission', async () => {
    mockCreateBatch.mockResolvedValue({ batchId: 'BATCH-001' });
    renderAddBatch('farmer');
    await waitFor(() => expect(screen.getByText(/batch\.createBatch/)).toBeInTheDocument());
    fillRequiredFields();
    submitForm();
    await waitFor(() => {
      expect(mockCreateBatch).toHaveBeenCalled();
    });
  });

  it('shows success view after batch creation', async () => {
    mockCreateBatch.mockResolvedValue({ batchId: 'BATCH-001' });
    renderAddBatch('farmer');
    await waitFor(() => expect(screen.getByText(/batch\.createBatch/)).toBeInTheDocument());
    fillRequiredFields();
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/batch\.batchCreatedSuccess/)).toBeInTheDocument();
      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
    });
  });

  it('navigates to create another batch after success', async () => {
    mockCreateBatch.mockResolvedValue({ batchId: 'BATCH-001' });
    renderAddBatch('farmer');
    await waitFor(() => expect(screen.getByText(/batch\.createBatch/)).toBeInTheDocument());
    fillRequiredFields();
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/batch\.createAnother/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/batch\.createAnother/));
    await waitFor(() => {
      expect(screen.getByText(/batch\.createBatch/)).toBeInTheDocument();
    });
  });

  it('does not submit when cropType is empty', () => {
    const form = renderAddBatch('farmer').container.querySelector('form')!;
    fireEvent.submit(form);
    expect(mockCreateBatch).not.toHaveBeenCalled();
  });
});
