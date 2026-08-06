import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { ErpClientManager, ErpConnectionConfig, DEFAULT_ERP_HOST } from '../../api';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const initialHost = DEFAULT_ERP_HOST || 'https://suntek-dev.m.frappe.cloud';
  const [host, setHost] = useState(initialHost);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const config = ErpClientManager.getConfig();
    const currentHost = config?.host;
    if (currentHost && currentHost !== 'https://' && currentHost.trim() !== '' && currentHost.includes('.')) {
      setHost(currentHost);
    } else {
      setHost(initialHost);
    }
  }, []);

  const handleLogin = async () => {
    if (!host || host === 'https://') {
      Alert.alert('Validation Error', 'Please specify a valid ERP Domain Host.');
      return;
    }

    if (!username || !password) {
      Alert.alert('Validation Error', 'Please enter your Username / Email and Password.');
      return;
    }

    setLoading(true);
    try {
      const config: ErpConnectionConfig = {
        host,
        mode: 'frappe',
      };
      
      ErpClientManager.setConfig(config);
      const client = ErpClientManager.getClient();
      
      const session = await client.login(username, password);
      onLoginSuccess(session.username);
    } catch (err: any) {
      Alert.alert('Connection Failure', err.message || 'Unable to authenticate with ERPNext site.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.brandTitle}>Erpnext</Text>
        <Text style={styles.brandSubtitle}>Field Operations Connector</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>CRM Field Login</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>ERP Domain Host</Text>
          <TextInput
            value={host}
            onChangeText={setHost}
            placeholder="https://your-site.erpnext.com"
            placeholderTextColor="#5a6880"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Username / Email</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="user@domain.com"
            placeholderTextColor="#5a6880"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••••"
            placeholderTextColor="#5a6880"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Authenticate Connection</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#05080e',
    justifyContent: 'center',
    padding: 24,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#65778a',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65778a',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
