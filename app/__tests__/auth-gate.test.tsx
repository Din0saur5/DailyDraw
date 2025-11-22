import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthGate } from '@/components/auth/AuthGate';
import { useSessionStore } from '@/stores/useSessionStore';

const mockSignInWithPassword = jest.fn().mockResolvedValue({ data: {}, error: null });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

const TEST_EMAIL = process.env.TEST_AUTH_EMAIL;
const TEST_PASSWORD = process.env.TEST_AUTH_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error('Set TEST_AUTH_EMAIL and TEST_AUTH_PASSWORD in your .env file for tests.');
}

describe('AuthGate', () => {
  afterEach(() => {
    act(() => {
      useSessionStore.getState().reset();
    });
    mockSignInWithPassword.mockClear();
  });

  it('renders children when authenticated', () => {
    useSessionStore.setState({ status: 'authenticated' });
    render(
      <AuthGate>
        <TestChild />
      </AuthGate>,
    );
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('submits sign-in credentials when unauthenticated', async () => {
    useSessionStore.setState({ status: 'unauthenticated' });
    render(
      <AuthGate>
        <TestChild />
      </AuthGate>,
    );
    expect(screen.getByText(/Welcome to DailyDraw/i)).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), TEST_EMAIL);
    fireEvent.changeText(screen.getByPlaceholderText('Minimum 8 characters'), TEST_PASSWORD);
    const [, signInButton] = screen.getAllByText(/Sign In/i);
    fireEvent.press(signInButton);
    const normalizedEmail = TEST_EMAIL.trim().toLowerCase();
    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: normalizedEmail,
        password: TEST_PASSWORD,
      }),
    );
  });
});

const TestChild = () => {
  return <Text>Ready</Text>;
};
