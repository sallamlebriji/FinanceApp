import { registerSchema } from '@mizan/shared';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Field, Txt } from '@/components/ui';
import { errorMessage, register } from '@/lib/api';
import { space } from '@/theme';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ name: f.name?.[0], email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password);
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
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.xl, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' }}
      >
        <Txt variant="body" tone="label2">
          Your data stays private to your account. You can export or delete it at any time.
        </Txt>
        <Field label="Name" value={name} onChangeText={setName} error={errors.name} autoComplete="name" textContentType="name" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          hint="At least 10 characters, with a letter and a number."
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {errors.form ? (
          <Txt variant="subhead" tone="negative" accessibilityRole="alert">
            {errors.form}
          </Txt>
        ) : null}
        <Button title="Create Account" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
