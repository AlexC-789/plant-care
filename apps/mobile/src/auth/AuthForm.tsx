import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      <TextInput
        accessibilityLabel="Email"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {fieldErrors.email ? <Text style={styles.error}>{fieldErrors.email}</Text> : null}

      <TextInput
        accessibilityLabel="Password"
        placeholder="Password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={passwordAutoComplete}
        onSubmitEditing={handleSubmit}
      />
      {fieldErrors.password ? <Text style={styles.error}>{fieldErrors.password}</Text> : null}

      {formError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: pending, busy: pending }}
        disabled={pending}
        onPress={handleSubmit}
        style={({ pressed }) => [styles.button, (pressed || pending) && styles.buttonDim]}>
        {pending ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>

      {showResend ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resendLabel}
          accessibilityState={{ disabled: resendDisabled, busy: resendPending }}
          disabled={resendDisabled}
          onPress={handleResend}
          style={[styles.secondaryButton, resendDisabled && styles.buttonDim]}>
          <Text style={styles.secondaryButtonText}>{resendLabel}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: '#b00020' },
  notice: { color: '#1b5e20' },
  button: {
    marginTop: 12,
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDim: { opacity: 0.7 },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 16, alignItems: 'center' },
});
