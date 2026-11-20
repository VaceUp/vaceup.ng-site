import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Badge, Card, Note, Screen, Separator } from '@/components/ui';
import { light as colors, spacing, type } from '@/theme';
import { useAuth } from '@/state/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);

  const rows: Array<{ icon: keyof typeof Feather.glyphMap; label: string; href: string }> = [
    { icon: 'link', label: 'Challenge portal', href: '/challenge' },
  ];

  return (
    <Screen>
      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{(user?.full_name ?? 'V').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{user?.full_name || 'VaceUp learner'}</Text>
          <Text style={[type.small, styles.muted]}>{user?.email}</Text>
          <View style={{ marginTop: spacing(2) }}>
            <Badge label={(user?.role ?? 'student').toUpperCase()} tone="gold" />
          </View>
        </View>
      </Card>

      {user && !user.is_verified ? (
        <Note tone="info">Your email is not verified yet. Use the verification link we emailed you to unlock everything.</Note>
      ) : null}

      <Card style={{ padding: 0 }}>
        {rows.map((row) => (
          <Link key={row.href} href={row.href} asChild>
            <Pressable accessibilityRole="button" style={styles.rowButton}>
              <Feather name={row.icon} size={16} color={colors.navy950} />
              <Text style={[type.body, { flex: 1 }]}>{row.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          </Link>
        ))}
        <Separator />
        <Pressable
          accessibilityRole="button"
          style={styles.rowButton}
          onPress={() => { void signOut().then(() => router.replace('/login')); }}
        >
          <Feather name="log-out" size={16} color={colors.error} />
          <Text style={[type.body, { color: colors.error, flex: 1 }]}>Sign out</Text>
        </Pressable>
      </Card>

      <Text style={[type.caption, styles.muted, styles.footerLine]}>
        VaceUp Digital Academy · challenge access is separate from this account and expires with the round.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { ...type.heading, fontWeight: '800', color: colors.navy950 },
  muted: { color: colors.textMuted },
  rowButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing(3),
    paddingHorizontal: spacing(4), minHeight: 52,
  },
  footerLine: { textAlign: 'center', marginTop: spacing(2) },
});
