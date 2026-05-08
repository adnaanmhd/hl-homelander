// Phase 1 root component — renders the SignIn screen unconditionally. No
// navigation library at MVP; the Welcome state is a conditional render inside
// SignIn (signedIn ? <Welcome> : <SignInButton>) per the plan-13 truths.

import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import SignIn from './src/screens/SignIn';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <SignIn />
    </SafeAreaView>
  );
}
