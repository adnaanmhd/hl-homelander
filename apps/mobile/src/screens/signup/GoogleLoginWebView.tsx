// WebView-based Google OAuth screen. Opened inline when the user taps
// "Continue with Google". onShouldStartLoadWithRequest intercepts the redirect
// URL before the WebView navigates — no OS-level deep-link setup needed.
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import Config from 'react-native-config';
import { extractOAuthCodeFromUrl } from '../../utils/oauthCode';
import { loginWithGoogle, type GoogleAuthResponse } from '../../api/googleAuth';
import { colors } from '../../ui/tokens';

interface Props {
  webViewUrl: string;
  onSuccess: (data: GoogleAuthResponse) => void;
  onError: (err: unknown) => void;
}

export default function GoogleLoginWebView({ webViewUrl, onSuccess, onError }: Props) {
  const redirectUri = Config.QUEST_REDIRECT_URI ?? '';

  useEffect(() => {
    console.log('[GoogleLoginWebView] mounted — url:', webViewUrl);
  }, [webViewUrl]);

  const handleShouldStartLoad = ({ url }: { url: string }): boolean => {
    if (!redirectUri || !url.startsWith(redirectUri)) return true;

    const code = extractOAuthCodeFromUrl(url);
    if (code) {
      loginWithGoogle(code).then(onSuccess).catch(onError);
    } else {
      onError(new Error('oauth_code_missing'));
    }
    return false;
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: webViewUrl }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        // Chrome UA — Google blocks OAuth in embedded WebViews (disallowed_useragent).
        userAgent="Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  webview: { flex: 1 },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});
