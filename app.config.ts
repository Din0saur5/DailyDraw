import type { ConfigContext, ExpoConfig } from '@expo/config';
import 'dotenv/config';

const APP_NAME = 'DailyDraw';
const SCHEME = 'dailydraw';

export default ({ config }: ConfigContext): ExpoConfig => {
  const allowDevAuthBypass =
    process.env.EXPO_PUBLIC_ALLOW_DEV_AUTH_BYPASS === 'false' ? false : true;

  return {
    ...config,
    name: APP_NAME,
    slug: SCHEME,
    scheme: SCHEME,
    owner: 'dinosaur5',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dinosaur5.dailydraw',
      infoPlist: {
      "ITSAppUsesNonExemptEncryption": false
    }
    },
    android: {
      package: 'com.dinosaur5.dailydraw',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router', 'expo-secure-store'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...config.extra,
      eas: { projectId: 'cc0fe617-beb5-4e39-9b30-42db5dae1f30' },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      allowDevAuthBypass,
    },
  };
};
