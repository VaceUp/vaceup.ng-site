import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Button, Field, Note, Screen } from '@/components/ui';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/state/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const signUp = useAuth((state) => state.signUp);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Fill in your name, email address and a password.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password of at least eight characters.');
      return;
    }
    setBusy(true); setError('');
    try {
      const detail = await signUp(fullName.trim(), email.trim(), phone.trim(), password);
      setNotice(detail);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Create your account</Text>
        <Text style={styles.heroSubtitle}>One account for courses, lessons and your challenge entries. Registering for a challenge never creates this account.</Text>
      </View>

      {error ? <Note tone="error">{error}</Note> : null}
      {notice ? (
        <Note tone="success">
          {notice} Sign in after verifying to start learning.
        </Note>
      ) : null}

      <Field label="Full name" autoCapitalize="words" autoComplete="name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
      <Field label="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Field label="Phone number" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} placeholder="080..." />
      <Field
        label="Password"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least eight characters"
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

      <Button label="Create account" onPress={() => void submit()} loading={busy} wide />
      <View style={styles.footer}>
        <Text style={type.small}>Already have an account? </Text>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link">
            <Text style={[type.small, styles.link]}>Sign in</Text>
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
  hero: {
    backgroundColor: colors.navy950,
    borderRadius: radius.xl,
    padding: spacing(5),
    gap: spacing(2),
  },
  heroTitle: { ...type.title, color: colors.white },
  heroSubtitle: { ...type.body, color: colors.navy200 },
  eyeButton: { position: 'absolute', right: spacing(3), top: '50%', transform: [{ translateY: -12 }] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.focus, fontWeight: '700' },
});
