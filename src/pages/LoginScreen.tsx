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

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const {colors, isDark} = useTheme();
  const {login} = useAuth();
  const [form, setForm] = useState<FormData>({email: '', password: ''});
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {return;}
    setApiError('');
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      // AuthContext sets token → App.tsx auto-navigates to Dashboard
    } catch (e: any) {
      setApiError(e?.message ?? 'Login failed. Please try again.');
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
            <Text style={[styles.title, {color: colors.text}]}>Welcome Back</Text>
            <Text style={[styles.subtitle, {color: colors.subText}]}>Log in to your account</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1}]}>

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

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={[styles.forgotText, {color: colors.accent}]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* API error */}
            {apiError ? (
              <Text style={[styles.errorText, {color: colors.danger, marginBottom: 12}]}>
                {apiError}
              </Text>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, submitting && {opacity: 0.7}]}
              onPress={handleLogin}
              disabled={submitting}
              activeOpacity={0.85}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.buttonText}>Log In</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, {backgroundColor: colors.divider}]} />
              <Text style={[styles.dividerText, {color: colors.muted}]}>or</Text>
              <View style={[styles.dividerLine, {backgroundColor: colors.divider}]} />
            </View>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, {color: colors.subText}]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, {color: colors.accent}]}>Sign Up</Text>
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    color: '#4a6cf7',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4a6cf7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e8ecf4',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#aaa',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#4a6cf7',
    fontWeight: '600',
  },
});
