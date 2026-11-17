import { forgotPasswordSchema } from '@mizan/shared';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, Field, Txt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { space } from '@/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', json: parsed.data });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.xl, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' }}
    >
      {sent ? (
        <Card style={{ gap: space.sm }}>
          <Txt variant="headline">Check your email</Txt>
          <Txt variant="subhead" tone="label2">
            If an account exists for {email.trim()}, we sent a link to reset its password. The link expires in 30 minutes.
          </Txt>
        </Card>
      ) : (
        <>
          <Txt variant="body" tone="label2">
            Enter the email you signed up with and we’ll send you a link to choose a new password.
          </Txt>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={error}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            onSubmitEditing={submit}
          />
          <Button title="Send Reset Link" onPress={submit} loading={busy} />
        </>
      )}
    </ScrollView>
  );
}
