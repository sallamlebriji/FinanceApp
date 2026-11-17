import { SUPPORTED_CURRENCIES } from '@mizan/shared';
import Constants from 'expo-constants';
import { LogOut, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Chip, Field, Screen, SectionHeader, Separator, Txt } from '@/components/ui';
import { api, errorMessage, forgetSession, signOut } from '@/lib/api';
import { useUpdateProfile, useUpdateSettings } from '@/lib/data';
import { confirmDestructive, hapticSuccess, notify } from '@/lib/native';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { space, useColors } from '@/theme';

export default function Settings() {
  const c = useColors();
  const user = useAuth((s) => s.user);
  const settings = useAuth((s) => s.settings);
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(user?.name ?? '');
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string>();
  const [busy, setBusy] = useState<'signout' | 'everywhere' | 'delete' | null>(null);

  if (!user || !settings) return null;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.name) return;
    try {
      await updateProfile.mutateAsync({ name: trimmed });
      hapticSuccess();
    } catch (e) {
      notify('Couldn’t save your name', errorMessage(e));
    }
  }

  async function onSignOut() {
    setBusy('signout');
    await signOut();
    queryClient.clear();
  }

  async function onSignOutEverywhere() {
    const ok = await confirmDestructive(
      'Sign out on every device?',
      'You’ll need to sign in again here and on your other phones and browsers.',
      'Sign Out Everywhere',
    );
    if (!ok) return;
    setBusy('everywhere');
    try {
      await api('/auth/logout-all', { method: 'POST' });
      await forgetSession();
      queryClient.clear();
    } catch (e) {
      setBusy(null);
      notify('Couldn’t sign out everywhere', errorMessage(e));
    }
  }

  async function onDeleteAccount() {
    if (!password) return setDeleteError('Enter your password to confirm.');
    const ok = await confirmDestructive(
      'Delete your Mizan account?',
      'All accounts, transactions, budgets and settings are permanently erased. This can’t be undone.',
      'Delete Everything',
    );
    if (!ok) return;
    setBusy('delete');
    try {
      await api('/auth/me', { method: 'DELETE', json: { password } });
      await forgetSession();
      queryClient.clear();
    } catch (e) {
      setBusy(null);
      setDeleteError(errorMessage(e));
    }
  }

  return (
    <Screen title="Settings" contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <SectionHeader title="Profile" />
      <Card style={{ gap: space.lg }}>
        <Field label="Name" value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} returnKeyType="done" maxLength={80} />
        <View style={{ gap: 2 }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Email
          </Txt>
          <Txt selectable>{user.email}</Txt>
          {!user.emailVerified ? (
            <Txt variant="footnote" tone="warning">
              Not verified yet — open the link we emailed you.
            </Txt>
          ) : null}
        </View>
      </Card>

      <SectionHeader title="Preferences" />
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Main currency
          </Txt>
          <View accessibilityRole="radiogroup" accessibilityLabel="Main currency" style={{ flexDirection: 'row', gap: space.sm }}>
            {SUPPORTED_CURRENCIES.map((cur) => (
              <Chip
                key={cur}
                label={cur}
                selected={settings.baseCurrency === cur}
                onPress={() => updateSettings.mutate({ baseCurrency: cur })}
              />
            ))}
          </View>
          <Txt variant="footnote" tone="label3">
            Net worth and reports are shown in this currency, using the exchange rates you record.
          </Txt>
        </View>
        <Separator />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt>Budget alerts</Txt>
            <Txt variant="footnote" tone="label3">
              Notify me at 50, 75, 90 and 100 % of a budget.
            </Txt>
          </View>
          <Switch
            value={settings.budgetAlerts}
            onValueChange={(v) => updateSettings.mutate({ budgetAlerts: v })}
            accessibilityLabel="Budget alerts"
            trackColor={{ true: c.accent, false: c.fillStrong }}
          />
        </View>
        <Separator />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
          <Txt>Time zone</Txt>
          <Txt tone="label2">{settings.timezone}</Txt>
        </View>
      </Card>

      <SectionHeader title="Security" />
      <Card style={{ gap: space.md }}>
        <Button title="Sign Out" icon={LogOut} variant="secondary" onPress={onSignOut} loading={busy === 'signout'} />
        <Button
          title="Sign Out Everywhere"
          variant="plain"
          onPress={onSignOutEverywhere}
          loading={busy === 'everywhere'}
          accessibilityHint="Ends every session on all your devices"
        />
      </Card>

      <Card style={{ gap: space.md }}>
        {deleting ? (
          <>
            <Txt variant="headline">Delete account</Txt>
            <Txt variant="subhead" tone="label2">
              Enter your password to permanently erase your Mizan data.
            </Txt>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              error={deleteError}
            />
            <Button title="Delete Account" icon={Trash2} variant="destructive" onPress={onDeleteAccount} loading={busy === 'delete'} />
            <Button
              title="Keep My Account"
              variant="plain"
              onPress={() => {
                setDeleting(false);
                setPassword('');
                setDeleteError(undefined);
              }}
            />
          </>
        ) : (
          <Button title="Delete Account…" variant="destructive" onPress={() => setDeleting(true)} />
        )}
      </Card>

      <Txt variant="footnote" tone="label3" style={{ textAlign: 'center' }}>
        Mizan {Constants.expoConfig?.version ?? ''}
      </Txt>
    </Screen>
  );
}
