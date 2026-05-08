import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Phase 1 SignIn component test — runs in JSDOM and stubs the React Native
// runtime (View/Text/Pressable/etc.) via the setup file. Native modules are
// not invoked in this test path because tests mock `../src/services/auth`
// entirely, so MMKV/GoogleSignin/Keychain transitively never load.
//
// Note: we deliberately do NOT use @testing-library/react-native here —
// testing-library expects the real RN host-component infrastructure
// (react-test-renderer + RN's host-components map), which is heavy to
// stand up under vitest. The host-component shim in vitest.setup.ts maps
// View/Text/Pressable to plain DOM elements so testing-library/react can
// query them via aria-label / role.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
