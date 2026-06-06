import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Switch, Alert } from 'react-native';
import { getDevices, toggleDevice } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const STATUS_COLOR: Record<string, string> = {
  success: '#22c55e',
  error: '#ef4444',
  timeout: '#f97316',
};

export default function DevicesScreen() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDevices();
      setDevices(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (device: any) => {
    setToggling(device.id);
    try {
      await toggleDevice(device.id, !device.is_active);
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_active: !d.is_active } : d));
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update device');
    } finally {
      setToggling(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadDevices}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Biometric Devices</Text>
        <Text style={styles.subtitle}>{devices.length} device{devices.length !== 1 ? 's' : ''} configured</Text>

        {devices.map((device) => {
          const statusColor = STATUS_COLOR[device.poll_status] || '#94a3b8';
          return (
            <View key={device.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                  <FontAwesome name="desktop" size={22} color="#3b82f6" />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.deviceName}>{device.device_name}</Text>
                  <Text style={styles.deviceSn}>SN: {device.device_sn}</Text>
                </View>
                <Switch
                  value={device.is_active}
                  onValueChange={() => handleToggle(device)}
                  disabled={toggling === device.id}
                  trackColor={{ true: '#3b82f6' }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>IP Address</Text>
                  <Text style={styles.infoValue}>{device.device_ip || '--'}:{device.device_port}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Mode</Text>
                  <Text style={styles.infoValue}>{device.connection_mode || '--'}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Last Poll</Text>
                  <Text style={styles.infoValue}>{formatDate(device.last_polled_at)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Poll Status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.infoValue, { color: statusColor }]}>
                      {device.poll_status || 'unknown'}
                    </Text>
                  </View>
                </View>
              </View>

              {device.last_seen_at && (
                <Text style={styles.lastSeen}>Last seen: {formatDate(device.last_seen_at)}</Text>
              )}
            </View>
          );
        })}

        {devices.length === 0 && (
          <View style={styles.empty}>
            <FontAwesome name="desktop" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No devices configured</Text>
          </View>
        )}

        <TouchableOpacity style={styles.refreshBtn} onPress={loadDevices}>
          <FontAwesome name="refresh" size={14} color="#3b82f6" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#3b82f6', borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  deviceSn: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#334155', fontWeight: '600' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  lastSeen: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#eff6ff', marginTop: 8,
  },
  refreshText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },
});
