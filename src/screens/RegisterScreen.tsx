import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';

type RegisterNavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterNavProp>();
  const {colors, isDark} = useTheme();
  const {register} = useAuth();
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (form.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {return;}
    setApiError('');
    setSubmitting(true);
    try {
      await register(form.username.trim(), form.email.trim(), form.password);
      // AuthContext sets token → App.tsx auto-navigates to Dashboard
    } catch (e: any) {
      setApiError(e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm(prev => ({...prev, [field]: value}));
    if (errors[field]) {
      setErrors(prev => ({...prev, [field]: undefined}));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, {color: colors.text}]}>Create Account</Text>
            <Text style={[styles.subtitle, {color: colors.subText}]}>Sign up to get started</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1}]}>

            {/* Username */}
            <View style={styles.field}>
              <Text style={[styles.label, {color: colors.text}]}>Username</Text>
              <TextInput
                style={[styles.input, {backgroundColor: colors.inputBg, borderColor: errors.username ? colors.danger : colors.inputBorder, color: colors.text}]}
                placeholder="Enter your username"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                value={form.username}
                onChangeText={v => handleChange('username', v)}
              />
              {errors.username ? <Text style={[styles.errorText, {color: colors.danger}]}>{errors.username}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, {color: colors.text}]}>Email</Text>
              <TextInput
                style={[styles.input, {backgroundColor: colors.inputBg, borderColor: errors.email ? colors.danger : colors.inputBorder, color: colors.text}]}
                placeholder="Enter your email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={form.email}
                onChangeText={v => handleChange('email', v)}
              />
              {errors.email ? <Text style={[styles.errorText, {color: colors.danger}]}>{errors.email}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, {color: colors.text}]}>Password</Text>
              <View style={[styles.inputRow, {backgroundColor: colors.inputBg, borderColor: errors.password ? colors.danger : colors.inputBorder}]}>
                <TextInput
                  style={[styles.inputFlex, {color: colors.text}]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  value={form.password}
                  onChangeText={v => handleChange('password', v)}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                  <Text style={[styles.eyeText, {color: colors.accent}]}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={[styles.errorText, {color: colors.danger}]}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={[styles.label, {color: colors.text}]}>Confirm Password</Text>
              <View style={[styles.inputRow, {backgroundColor: colors.inputBg, borderColor: errors.confirmPassword ? colors.danger : colors.inputBorder}]}>
                <TextInput
                  style={[styles.inputFlex, {color: colors.text}]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showConfirm}
                  value={form.confirmPassword}
                  onChangeText={v => handleChange('confirmPassword', v)}
                />
                <TouchableOpacity onPress={() => setShowConfirm(p => !p)} style={styles.eyeBtn}>
                  <Text style={[styles.eyeText, {color: colors.accent}]}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? <Text style={[styles.errorText, {color: colors.danger}]}>{errors.confirmPassword}</Text> : null}
            </View>

            {/* API error */}
            {apiError ? (
              <Text style={[styles.errorText, {color: colors.danger, marginBottom: 12}]}>
                {apiError}
              </Text>
            ) : null}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.button, submitting && {opacity: 0.7}]}
              onPress={handleRegister}
              disabled={submitting}
              activeOpacity={0.85}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.buttonText}>Register</Text>}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, {color: colors.subText}]}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={[styles.loginLink, {color: colors.accent}]}>Log In</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dde1f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
    backgroundColor: '#fafbff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dde1f0',
    borderRadius: 10,
    backgroundColor: '#fafbff',
    paddingHorizontal: 14,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  eyeBtn: {
    paddingLeft: 10,
    paddingVertical: 12,
  },
  eyeText: {
    fontSize: 13,
    color: '#4a6cf7',
    fontWeight: '600',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  button: {
    backgroundColor: '#4a6cf7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4a6cf7',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#4a6cf7',
    fontWeight: '600',
  },
});
