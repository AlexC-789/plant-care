import { useRef, useState, type ReactNode } from 'react';
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
import { validateCredentials, type CredentialErrors } from './validation';

export type AuthSubmitResult = { error?: unknown; notice?: string };

type Props = {
  title: string;
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  onSubmit: (email: string, password: string) => Promise<AuthSubmitResult>;
  footer: ReactNode;
};

export function AuthForm({ title, submitLabel, passwordAutoComplete, onSubmit, footer }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

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
      if (result.error) setFormError(authErrorMessage(result.error));
      else if (result.notice) setNotice(result.notice);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 16, alignItems: 'center' },
});
