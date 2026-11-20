import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Button, Field, Note, Screen } from '@/components/ui';
import { light, radius, spacing, type, useTheme } from '@/theme';
import { useAuth } from '@/state/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const signIn = useAuth((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter the email address and password you registered with.');
      return;
    }
    setBusy(true); setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>V</Text>
        </View>
        <Text style={styles.heroTitle}>Welcome Back</Text>
        <Text style={styles.heroSubtitle}>Sign in to access your dashboard and active courses.</Text>
      </View>

      {error ? <Note tone="error">{error}</Note> : null}

      <Field
        label="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        secureTextEntry={!showPassword}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeButton}
        >
          <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
        </Pressable>
      </Field>

      <Button label="Sign in" onPress={() => void submit()} loading={busy} wide />
      <View style={styles.footer}>
        <Text style={[type.small, { color: colors.textMuted }]}>New to VaceUp? </Text>
        <Link href="/register" asChild>
          <Pressable accessibilityRole="link">
            <Text style={[type.small, styles.link]}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
      <View style={styles.footer}>
        <Link href="/challenge" asChild>
          <Pressable accessibilityRole="link">
            <Text style={[type.small, styles.link]}>Challenge participant? Open the challenge portal</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing(2.5), marginTop: spacing(4), marginBottom: spacing(2) },
  logoMark: {
    width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: light.gold, alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { ...type.heading, fontWeight: '800', color: light.navy950 },
  heroTitle: { ...type.title, color: light.navy950 },
  heroSubtitle: { ...type.body, color: '#5C6684' },
  eyeButton: { position: 'absolute', right: spacing(3), top: '50%', transform: [{ translateY: -12 }] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  link: { color: light.focus, fontWeight: '700' },
});
