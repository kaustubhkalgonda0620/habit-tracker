import type { AuthError } from '@supabase/supabase-js';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Supabase's email code length is a project setting (6–10 digits), so accept any of them.
const MinCodeLength = 6;
const MaxCodeLength = 10;

function errorMessage(error: AuthError, step: 'send' | 'verify'): string {
  if (error.status === 429) return 'Too many tries. Wait a minute, then try again.';
  if (!error.status) return "Couldn't reach the server. Check your connection and try again.";
  if (step === 'verify') return 'That code is wrong or has expired. Check it, or send a new one.';
  return error.message;
}

/** Email + one-time code sign-in. Signing in updates `useAuth()`, which moves the app on. */
export function SignIn({ color, returning }: { color: string; returning: boolean }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const address = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  async function sendCode(to: string) {
    setBusy(true);
    setError(null);
    setResent(false);
    const { error } = await supabase.auth.signInWithOtp({ email: to });
    setBusy(false);
    if (error) {
      setError(errorMessage(error, 'send'));
      return;
    }
    setResent(sentTo !== null);
    setSentTo(to);
    setCode('');
  }

  async function verify() {
    if (!sentTo || code.length < MinCodeLength) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
    // On success this screen is replaced, so only failures need handling.
    if (error) {
      setBusy(false);
      setError(errorMessage(error, 'verify'));
    }
  }

  return (
    <>
      <Text style={styles.hero}>{returning ? '👋' : '✨'}</Text>
      <ThemedText type="subtitle" style={styles.center}>
        {returning ? 'Welcome back' : 'Sign in to get started'}
      </ThemedText>

      {sentTo === null ? (
        <>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Enter your email and we&apos;ll send you a sign-in code. No password needed.
          </ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => validEmail && !busy && sendCode(address)}
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            accessibilityLabel="Email"
            style={inputStyle}
          />
          <PrimaryButton
            label={busy ? 'Sending…' : 'Send code'}
            color={color}
            onPress={() => sendCode(address)}
            disabled={!validEmail || busy}
          />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Enter the code we sent to {sentTo}. It may take a minute, and it
            might land in spam.
          </ThemedText>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, MaxCodeLength))}
            onSubmitEditing={verify}
            placeholder="Code"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={MaxCodeLength}
            accessibilityLabel="Code"
            style={[inputStyle, styles.code]}
          />
          <PrimaryButton
            label={busy ? 'Checking…' : 'Sign in'}
            color={color}
            onPress={verify}
            disabled={code.length < MinCodeLength || busy}
          />
          <View style={styles.links}>
            <Pressable onPress={() => sendCode(sentTo)} disabled={busy} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Send a new code
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setSentTo(null);
                setError(null);
                setResent(false);
              }}
              disabled={busy}
              hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Use a different email
              </ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {resent && !error && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          New code sent.
        </ThemedText>
      )}
      {error && (
        <ThemedText type="small" style={[styles.center, styles.error]} accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontSize: 72,
    lineHeight: 88,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  code: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  error: {
    color: '#E5484D',
  },
});
