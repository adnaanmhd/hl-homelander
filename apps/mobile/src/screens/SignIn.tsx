// Phase 1 Sign-In screen — the only screen at this milestone. Renders a
// "Continue with Google" button; on tap, runs signInWithGoogle() (which
// orchestrates the full /auth/nonce → IntegrityManager.requestIntegrityToken →
// /auth/google round-trip per src/services/auth.ts) and shows a Welcome view
// with the user's display name on success. The full Sign-up screen with
// consent checkbox + animated logo + Terms-of-Use modal lands in Phase 2 per
// design-spec.md §2 — Phase 1 is intentionally minimal (D-APK-04).

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { signInWithGoogle, type AuthSuccess } from '../services/auth';

interface State {
  user: AuthSuccess['user'] | null;
  loading: boolean;
  error: string | null;
}

export default function SignIn() {
  const [state, setState] = useState<State>({ user: null, loading: false, error: null });

  const handleSignIn = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await signInWithGoogle();
      setState({ user: result.user, loading: false, error: null });
    } catch (err) {
      setState({
        user: null,
        loading: false,
        error: err instanceof Error ? err.message : 'unknown_error',
      });
    }
  }, []);

  if (state.user) {
    return (
      <View style={styles.container} accessible accessibilityLabel="Welcome view">
        <Text style={styles.welcome}>Welcome, {state.user.name}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} accessible accessibilityLabel="Sign in">
      <Text style={styles.title}>Humyn Labs Capture</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={styles.button}
        onPress={handleSignIn}
        disabled={state.loading}
      >
        <Text style={styles.buttonText}>
          {state.loading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </Pressable>
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
    </View>
  );
}

// Tokens are deliberately minimal at MVP — full design-spec.md §2 layout
// (animated scalePop logo, tagline, pitch, consent row, Terms-of-Use modal)
// lands in Phase 2. Colors mirror the design-spec.md neutrals:
//   - background `#FFFFFF` (`--bg`)
//   - text       `#0E0E0E` (`--text`)
//   - error      `#C2410C` (`--accent-error`)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, color: '#0E0E0E' },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0E0E0E',
    minWidth: 240,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  error: { color: '#C2410C', marginTop: 16, textAlign: 'center' },
  welcome: { fontSize: 24, fontWeight: '600', color: '#0E0E0E' },
});
