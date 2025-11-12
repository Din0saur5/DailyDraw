import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/profile';

export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!supabase) {
    console.warn('[profile] Supabase client not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('user_public')
    .select('id,username,is_premium')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn('[profile] Failed to load profile', error.message);
    }
    return null;
  }

  return {
    id: data.id,
    username: data.username,
    isPremium: Boolean(data.is_premium),
  };
};
