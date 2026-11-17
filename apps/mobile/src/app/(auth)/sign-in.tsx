import { loginSchema } from '@mizan/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Button, Field, Txt } from '@/components/ui';
import { errorMessage, signIn } from '@/lib/api';
import { space, useColors } from '@/theme';

/** Small static scale — the brand mark, not decoration: it is the app's one signature motif. */
function Mark() {
  const c = useColors();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Rect width={56} height={56} rx={14} fill={c.accent} />
      <Rect x={12} y={22} width={32} height={3} rx={1.5} fill={c.accentFg} />
      <Path d="M28 24 L23 42 H33 Z" fill={c.accentFg} />
      <Path d="M10 30 H22 a6 3.5 0 0 1 -12 0Z" fill={c.accentFg} />
      <Path d="M34 30 H46 a6 3.5 0 0 1 -12 0Z" fill={c.accentFg} />
      <Circle cx={28} cy={23.5} r={2.5} fill={c.accent} />
    </Svg>
    </View>
  );
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setErrors({ form: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: space.xl,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
          gap: space.xl,
          maxWidth: 480,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View style={{ gap: space.md }}>
          <Mark />
          <Txt variant="largeTitle" accessibilityRole="header">
            Mizan
          </Txt>
          <Txt variant="body" tone="label2">
            Weigh what comes in against what goes out.
          </Txt>
        </View>

        <View style={{ gap: space.lg }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {errors.form ? (
            <Txt variant="subhead" tone="negative" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {errors.form}
            </Txt>
          ) : null}
          <Button title="Sign In" onPress={submit} loading={busy} />
          <Link href="/forgot-password" asChild>
            <Button title="Forgot Password?" variant="plain" />
          </Link>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
          <Txt variant="subhead" tone="label2">
            New to Mizan?
          </Txt>
          <Link href="/register" asChild>
            <Button title="Create Account" variant="plain" style={{ paddingHorizontal: space.sm }} />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
