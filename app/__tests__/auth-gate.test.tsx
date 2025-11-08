import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthGate } from '@/components/auth/AuthGate';
import { useSessionStore } from '@/stores/useSessionStore';

describe('AuthGate', () => {
  afterEach(() => {
    act(() => {
      useSessionStore.getState().reset();
    });
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

  it('shows placeholder login when unauthenticated', () => {
    useSessionStore.setState({ status: 'unauthenticated' });
    render(
      <AuthGate>
        <TestChild />
      </AuthGate>,
    );
    expect(screen.getByText(/Sign in to DailyDraw/i)).toBeTruthy();
    fireEvent.press(screen.getByText(/Bypass/i));
    expect(screen.getByText('Ready')).toBeTruthy();
  });
});

const TestChild = () => {
  return <Text>Ready</Text>;
};
