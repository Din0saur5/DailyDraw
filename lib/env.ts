const warnMissing = (key: string) => {
  if (__DEV__) {
    console.warn(`[env] Missing value for ${key}`);
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const iapProductId = process.env.EXPO_PUBLIC_IAP_PRODUCT_ID;

if (!supabaseUrl) warnMissing('EXPO_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) warnMissing('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!iapProductId) warnMissing('EXPO_PUBLIC_IAP_PRODUCT_ID');

export const env = {
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  allowDevAuthBypass: process.env.EXPO_PUBLIC_ALLOW_DEV_AUTH_BYPASS !== 'false',
  iapProductId: iapProductId ?? '',
};
