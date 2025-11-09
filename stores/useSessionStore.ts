import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { UserProfile } from '@/types/profile';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  profile: UserProfile | null;
  devBypass: boolean;
  setStatus: (status: SessionStatus) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setDevBypass: (enabled: boolean) => void;
  reset: () => void;
};

const initialState = {
  status: 'loading' as SessionStatus,
  session: null,
  profile: null,
  devBypass: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setDevBypass: (enabled) => set({ devBypass: enabled }),
  reset: () => set(initialState),
}));
