import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';

import { Button, Card, EmptyState, Field, Note, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { ChallengePortal, ChallengeRound } from '@/lib/types';
import { colors, spacing, type } from '@/constants/theme';

const TOKEN_KEY = 'vaceup.challenge-token';

/** Challenge portal: independent from the signed-in academy account, exactly
 * like the web. Email + the round's access code opens the personal portal. */
export default function ChallengeScreen() {
  const [rounds, setRounds] = useState<ChallengeRound[]>([]);
  const [roundSlug, setRoundSlug] = useState('');
  const selectedRound = rounds.find((round) => round.slug === roundSlug) ?? null;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [portal, setPortal] = useState<ChallengePortal | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.challengeRounds()
      .then((available) => {
        setRounds(available);
        setRoundSlug(available[0]?.slug ?? '');
      })
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Could not load challenge rounds.'));
    SecureStore.getItemAsync(TOKEN_KEY).then((saved) => {
      if (saved) {
        setToken(saved);
        api.challengePortal(saved).then(setPortal).catch(() => undefined);
      }
    }).catch(() => undefined);
  }, []);

  const open = async () => {
    if (!roundSlug || !email.trim() || code.trim().length !== 6) {
      setError('Enter your email address and the six-digit access code from your registration email.');
      return;
    }
    setBusy(true); setError('');
    try {
      const access = await api.challengeAccessCode(roundSlug, email.trim(), code.trim());
      setToken(access);
      await SecureStore.setItemAsync(TOKEN_KEY, access);
      setPortal(await api.challengePortal(access));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open your portal. Check your code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOutPortal = () => {
    void SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    setToken(''); setPortal(null);
  };

  if (portal) {
    const round = portal.registration.round;
    return (
      <Screen>
        <Card style={styles.stack}>
          <Text style={type.heading}>{round.title}</Text>
          <Text style={[type.small, styles.muted]}>{portal.registration.category.name} · {portal.registration.email}</Text>
          <View style={styles.statusRow}>
            <Feather name="file-text" size={16} color={colors.focus} />
            <Text style={[type.small, { flex: 1 }]}>Submission: {portal.submission ? `revision ${portal.submission.revision} submitted` : 'not submitted yet'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Feather name="activity" size={16} color={colors.focus} />
            <Text style={[type.small, { flex: 1 }]}>Assessment: {portal.assessment_status.replaceAll('_', ' ')}</Text>
          </View>
          {portal.result ? (
            <Note tone="success">
              {portal.result.winner ? 'Category winner' : portal.result.rank ? `Placed ${portal.result.rank}` : 'Assessed'}
              {portal.result.total ? ` · ${Number(portal.result.total).toFixed(2)} points` : ''}
            </Note>
          ) : (
            <Note tone="info">Scores stay private until the results are approved and published.</Note>
          )}
          <Button label="Close portal on this device" intent="neutral" onPress={signOutPortal} />
        </Card>
        <Text style={[type.caption, styles.muted, styles.footer]}>Portal access ends with the round. Your marketing emails continue separately.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.stack}>
        <Text style={type.heading}>Open your challenge portal</Text>
        <Text style={[type.body, styles.muted]}>Challenge access is separate from your academy sign-in. Use the email you registered with and the six-digit access code from your registration email.</Text>
      </Card>

      {error ? <Note tone="error">{error}</Note> : null}

      <Field label="Challenge round" value={selectedRound?.title ?? 'Loading rounds...'} editable={false} />
      {rounds.length > 1 ? (
        <View style={styles.roundPicker}>
          {rounds.map((round) => (
            <Pressable key={round.slug} accessibilityRole="button" onPress={() => setRoundSlug(round.slug)} style={[styles.roundChip, round.slug === roundSlug && styles.roundChipActive]}>
              <Text style={[type.small, { fontWeight: '700', color: round.slug === roundSlug ? colors.navy950 : colors.textMuted }]} numberOfLines={1}>{round.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Registered email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Field label="Access code" keyboardType="number-pad" value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="Six digits" maxLength={6} />

      <Button label="Open my portal" onPress={() => void open()} loading={busy} wide icon="lock" />
      <Text style={[type.caption, styles.muted, styles.footer]}>Lost your code? Use the emailed link on the web, or request a fresh access email from the challenge page at vaceup.ng/challenge - then return here with the new code.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing(2.5) },
  muted: { color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  roundPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  roundChip: {
    minHeight: 40, paddingHorizontal: spacing(3), borderRadius: 999,
    backgroundColor: colors.navy100, justifyContent: 'center', maxWidth: '100%',
  },
  roundChipActive: { backgroundColor: colors.gold },
  footer: { textAlign: 'center' },
});
