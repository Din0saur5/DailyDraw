import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import FeedList from '@/components/feed/FeedList';

jest.mock('@/lib/queries/feed', () => ({
  useFeedQuery: jest.fn(),
}));

jest.mock('@/lib/queries/images', () => ({
  useSignedImageUrl: jest.fn(),
}));

jest.mock('@/lib/mutations/reports', () => ({
  useReportSubmissionMutation: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockUseFeedQuery = require('@/lib/queries/feed').useFeedQuery as jest.Mock;
const mockUseSignedImageUrl = require('@/lib/queries/images').useSignedImageUrl as jest.Mock;
const mockUseReportSubmissionMutation =
  require('@/lib/mutations/reports').useReportSubmissionMutation as jest.Mock;

let mutateAsyncMock: jest.Mock;
let alertSpy: jest.SpyInstance;

describe('FeedList', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseFeedQuery.mockReturnValue({
      data: {
        pages: [
          [
            {
              id: '123',
              userId: 'user-456',
              caption: 'Great art!',
              originalKey: 'orig/key.jpg',
              mimeType: 'image/jpeg',
              width: 1000,
              height: 800,
              isRemoved: false,
              createdAt: '2024-01-01T00:00:00Z',
              dailyPromptId: 'prompt-1',
              user: {
                id: 'user-456',
                username: 'artist',
                isPremium: false,
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

    mutateAsyncMock = jest.fn().mockResolvedValue(null);
    mockUseReportSubmissionMutation.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });

    alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy?.mockRestore();
  });

  it('optimistically hides a card after submitting a report', async () => {
    const { getByText, queryByText } = render(
      <FeedList dailyPromptId="prompt-1" currentUserId="me" header={<></>} />,
    );

    fireEvent.press(getByText('Report'));

    const submitButton = getByText('Submit report');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(queryByText('@artist')).toBeNull();
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      submissionId: '123',
      reason: 'Inappropriate or NSFW',
    });
  });
});
