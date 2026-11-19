import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { space, typography, useTheme } from '@/theme';
import { Button, Icon, InsetGroup, Text } from '@/ui';

import { authErrorMessage } from './authErrors';
import { RESEND_COOLDOWN_SECONDS } from './emailConfirmation';
import { validateCredentials, type CredentialErrors } from './validation';

export type AuthSubmitResult = { error?: unknown; notice?: string };

type Props = {
  title: string;
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  onSubmit: (email: string, password: string) => Promise<AuthSubmitResult>;
  footer: ReactNode;
  initialEmail?: string;
  initialNotice?: string;
  /** Shown as a button after an `email_not_confirmed` error. */
  onResendConfirmation?: (email: string) => Promise<AuthSubmitResult>;
  /** Start the resend cooldown immediately (an email was just sent at sign-up). */
  resendCooldownFromStart?: boolean;
};

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

export function AuthForm({
  title,
  submitLabel,
  passwordAutoComplete,
  onSubmit,
  footer,
  initialEmail = '',
  initialNotice,
  onResendConfirmation,
  resendCooldownFromStart = false,
}: Props) {
  const { colors } = useTheme();
  const inputStyle = [styles.input, typography.body, { color: colors.label }];
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  const [resendPending, setResendPending] = useState(false);
  const resendInFlight = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    resendCooldownFromStart ? Date.now() + RESEND_COOLDOWN_SECONDS * 1000 : 0,
  );
  const cooldownLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  // Tick once a second while the resend cooldown runs.
  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= resendAvailableAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  // Event handlers stay synchronous; the request runs in the background and
  // `inFlight` blocks repeat taps until it settles.
  function handleSubmit() {
    void submit();
  }

  async function submit() {
    if (inFlight.current) return;
    setFormError(null);
    setNotice(null);
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    inFlight.current = true;
    setPending(true);
    try {
      const result = await onSubmit(email.trim(), password);
      setLastErrorCode(result.error ? errorCode(result.error) : null);
      if (result.error) setFormError(authErrorMessage(result.error));
      else if (result.notice) setNotice(result.notice);
    } catch (error) {
      setLastErrorCode(errorCode(error));
      setFormError(authErrorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function handleResend() {
    void resend();
  }

  async function resend() {
    if (!onResendConfirmation || resendInFlight.current) return;
    const emailError = validateCredentials(email, 'x'.repeat(8)).email;
    setFieldErrors(emailError ? { email: emailError } : {});
    if (emailError) return;

    setFormError(null);
    setNotice(null);
    resendInFlight.current = true;
    setResendPending(true);
    try {
      const result = await onResendConfirmation(email.trim());
      if (result.error) {
        setFormError(authErrorMessage(result.error));
      } else {
        setNotice(result.notice ?? null);
        const t = Date.now();
        setNow(t);
        setResendAvailableAt(t + RESEND_COOLDOWN_SECONDS * 1000);
      }
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      resendInFlight.current = false;
      setResendPending(false);
    }
  }

  const showResend = !!onResendConfirmation && lastErrorCode === 'email_not_confirmed';
  const resendLabel = cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : 'Resend confirmation email';
  const resendDisabled = resendPending || cooldownLeft > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>

        <InsetGroup>
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email"
            placeholderTextColor={colors.secondaryLabel}
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            placeholderTextColor={colors.secondaryLabel}
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={passwordAutoComplete}
            onSubmitEditing={handleSubmit}
          />
        </InsetGroup>

        {fieldErrors.email || fieldErrors.password ? (
          <View style={styles.messages}>
            {fieldErrors.email ? (
              <Text variant="footnote" color="statusNow">
                {fieldErrors.email}
              </Text>
            ) : null}
            {fieldErrors.password ? (
              <Text variant="footnote" color="statusNow">
                {fieldErrors.password}
              </Text>
            ) : null}
          </View>
        ) : null}

        {formError ? (
          <View style={styles.alert} accessible accessibilityRole="alert">
            <Icon name="error" size={18} color="statusNow" />
            <Text variant="subheadline" color="statusNow" style={styles.flexShrink}>
              {formError}
            </Text>
          </View>
        ) : null}
        {notice ? (
          <Text variant="subheadline" style={styles.messages}>
            {notice}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button label={submitLabel} onPress={handleSubmit} disabled={pending} busy={pending} />
          {showResend ? (
            <Button
              label={resendLabel}
              variant="line"
              onPress={handleResend}
              disabled={resendDisabled}
              busy={resendPending}
            />
          ) : null}
        </View>

        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.l,
    paddingVertical: space.xxxl,
    gap: space.l,
  },
  title: { marginHorizontal: space.xs, marginBottom: space.s },
  input: { minHeight: space.touch, paddingHorizontal: space.l, paddingVertical: space.m },
  messages: { marginHorizontal: space.xs, gap: space.xs },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s,
    marginHorizontal: space.xs,
  },
  flexShrink: { flexShrink: 1 },
  actions: { gap: space.m, marginTop: space.xs },
  footer: { alignItems: 'center' },
});
