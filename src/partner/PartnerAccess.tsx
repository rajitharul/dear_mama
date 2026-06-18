import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPartnerAccount, listPartners, revokePartner, type PartnerLink } from '@/features/auth/partner';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, Card, Field } from '@/ui';

/**
 * Mother-side screen to register and manage partner logins. She enters an email + password; that
 * provisions a partner auth account (tagged so it lands straight on her Care tab) and links it to
 * her. Partners can be revoked at any time.
 */
export function PartnerAccess({ motherId, onBack }: { motherId: string; onBack: () => void }) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [partners, setPartners] = useState<PartnerLink[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 6 && !busy;

  const refresh = useCallback(async () => {
    try {
      const list = await listPartners();
      setPartners(list);
    } catch {
      // Leave the existing list; a transient list failure shouldn't block adding partners.
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    setBusy(true);
    try {
      const { needsConfirmation } = await createPartnerAccount(motherId, email, password);
      setEmail('');
      setPassword('');
      await refresh();
      Alert.alert(
        'Partner login created',
        needsConfirmation
          ? 'They’ll need to confirm the email address before they can sign in.'
          : 'Share the email and password — they can sign in right away.',
      );
    } catch (e) {
      Alert.alert('Could not create partner login', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmRevoke(link: PartnerLink) {
    Alert.alert(
      'Remove partner access?',
      'They’ll no longer be able to see or change your care. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokePartner(link.id);
              await refresh();
            } catch (e) {
              Alert.alert('Could not remove access', errorMessage(e));
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          paddingTop: t.spacing.sm,
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <AppText variant="subtitle">Partner access</AppText>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AppText variant="bodyMuted" style={{ maxWidth: 340 }}>
            Give a partner their own login. They’ll see only your Care tab — Physical care, Fetal care
            and Visits — and can help you track and add to it.
          </AppText>

          <Card style={{ gap: t.spacing.lg }}>
            <AppText variant="label">CREATE A PARTNER LOGIN</AppText>
            <Field
              label="Email"
              placeholder="partner@example.com"
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
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <Button
              label="Create partner login"
              icon="person-add-outline"
              onPress={handleCreate}
              loading={busy}
              disabled={!canSubmit}
            />
          </Card>

          <View style={{ gap: t.spacing.sm }}>
            <AppText variant="label">PARTNERS</AppText>
            {loadingList ? (
              <ActivityIndicator color={t.colors.accent} />
            ) : partners.length === 0 ? (
              <AppText variant="bodyMuted">No partners yet.</AppText>
            ) : (
              partners.map((p) => (
                <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: t.radius.md,
                      backgroundColor: t.colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="person-outline" size={20} color={t.colors.accent} />
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    Partner
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove partner access"
                    hitSlop={8}
                    onPress={() => confirmRevoke(p)}>
                    <AppText variant="body" color={t.colors.danger}>
                      Remove
                    </AppText>
                  </Pressable>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
