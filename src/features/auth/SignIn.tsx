import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithPassword, signUpWithPassword } from '@/features/auth/api';
import { errorMessage } from '@/lib/errors';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { AppText, Button, Card, Field, Illustration, OrganicBackdrop } from '@/ui';

type Mode = 'signin' | 'signup';

export function SignIn() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 6;

  async function handleSubmit() {
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password);
        if (needsConfirmation) {
          Alert.alert('Confirm your email', 'We sent you a confirmation link. Confirm it, then sign in.');
          setMode('signin');
        }
      }
    } catch (e) {
      Alert.alert(
        mode === 'signin' ? 'Could not sign in' : 'Could not sign up',
        errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <OrganicBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: t.spacing.xl, gap: t.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <Illustration name="welcome" size={170} />
          <AppText variant="display" center>
            DearMama
          </AppText>
          <AppText variant="bodyMuted" center>
            Your companion through every week.
          </AppText>
        </View>

        {!isSupabaseConfigured ? (
          <Card>
            <AppText variant="subtitle">Connect Supabase</AppText>
            <AppText variant="bodyMuted" style={{ marginTop: t.spacing.xs }}>
              Add your project URL and anon key to .env, then restart the dev server.
            </AppText>
          </Card>
        ) : (
          <Card style={{ gap: t.spacing.lg }}>
            <Field
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <Field
              label="Password"
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <Button
              label={mode === 'signin' ? 'Sign in' : 'Create account'}
              icon={mode === 'signin' ? 'log-in-outline' : 'person-add-outline'}
              onPress={handleSubmit}
              loading={busy}
              disabled={!canSubmit}
            />
            <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} hitSlop={8} style={{ alignItems: 'center' }}>
              <AppText variant="bodyMuted">
                {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
                <AppText color={t.colors.accent} weight="bold">
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </AppText>
              </AppText>
            </Pressable>
          </Card>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
