import { act, render } from '@testing-library/react-native';

import LibraryScreen from '@/app/library';
import { useSessionStore } from '@/stores/useSessionStore';

const mockUseLibraryQuery = jest.fn();
const mockUseSignedImageUrl = jest.fn();
const mockUsePremiumStatusMutation = jest.fn();

jest.mock('@/lib/queries', () => ({
  useLibraryQuery: (...args: any[]) => mockUseLibraryQuery(...args),
  useSignedImageUrl: (...args: any[]) => mockUseSignedImageUrl(...args),
}));

jest.mock('@/lib/profile', () => ({
  fetchUserProfile: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/iap', () => ({
  initIapConnection: jest.fn(),
  endIapConnection: jest.fn(),
  purchasePremium: jest.fn().mockResolvedValue({
    productId: 'test',
    transactionId: 'txn',
    receiptData: 'mock-receipt',
  }),
  restorePremium: jest.fn().mockResolvedValue({
    productId: 'test',
    transactionId: 'txn',
    receiptData: 'mock-receipt',
  }),
  loadPremiumProductDetails: jest.fn().mockResolvedValue({
    id: 'test',
    title: 'Premium',
    description: 'Full access',
    displayPrice: '$4.99',
    currency: 'USD',
  }),
}));

jest.mock('@/lib/mutations/premium', () => ({
  usePremiumStatusMutation: (...args: any[]) => mockUsePremiumStatusMutation(...args),
}));

describe('LibraryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.getState().reset();
    mockUsePremiumStatusMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    });
  });

  it('shows premium upsell for non-premium users', async () => {
    mockUseLibraryQuery.mockReturnValue({});

    useSessionStore.setState({
      profile: { id: 'user-1', username: 'artist', isPremium: false },
    });

    const { getAllByText } = render(<LibraryScreen />);
    await act(async () => {});
    expect(getAllByText(/Go Premium/i).length).toBeGreaterThan(0);
  });

  it('renders library entries for premium users', async () => {
    mockUseLibraryQuery.mockReturnValue({
      data: {
        pages: [
          [
            {
              id: '123',
              dailyPromptId: 'prompt-1',
              userId: 'user-1',
              caption: 'Sketch',
              originalKey: 'orig/key.jpg',
              mimeType: 'image/jpeg',
              width: 1000,
              height: 800,
              isRemoved: false,
              createdAt: '2024-01-01T00:00:00Z',
              prompt: {
                id: 'prompt-1',
                promptText: 'Draw a lighthouse',
                promptDate: '2024-01-01T00:00:00Z',
                difficulty: 'easy',
              },
            },
          ],
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    mockUseSignedImageUrl.mockReturnValue({
      data: { url: 'https://example.com/image.jpg' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    useSessionStore.setState({
      profile: { id: 'user-1', username: 'artist', isPremium: true },
    });

    const { getByText } = render(<LibraryScreen />);
    await act(async () => {});
    expect(getByText(/Your library/i)).toBeTruthy();
    expect(getByText(/Draw a lighthouse/i)).toBeTruthy();
  });
});
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  },
}));
