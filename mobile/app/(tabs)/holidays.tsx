import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { getHolidays } from '../../services/api';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HolidaysScreen() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      const data = await getHolidays();
      // Filter only holidays just to be safe
      const onlyHolidays = (data || []).filter((d: any) => d.day_type === 'HOLIDAY');
      
      // Sort by date ascending
      onlyHolidays.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setHolidays(onlyHolidays);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Holiday Master</Text>
      
      {holidays.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No upcoming holidays found.</Text>
        </View>
      ) : (
        holidays.map((h) => {
          const d = new Date(h.date);
          const monthStr = monthNames[d.getMonth()].substring(0, 3).toUpperCase();
          const dayNum = d.getDate();
          
          return (
            <View key={h.id} style={styles.card}>
              <View style={styles.dateBox}>
                <Text style={styles.dateMonth}>{monthStr}</Text>
                <Text style={styles.dateNum}>{dayNum}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.holidayName}>{h.description || 'Public Holiday'}</Text>
                <Text style={styles.holidayDay}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</Text>
              </View>
              <View style={styles.badgeBox}>
                <Text style={styles.badgeText}>{d.getFullYear()}</Text>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
    letterSpacing: 0.5,
  },
  dateNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: -2,
  },
  infoBox: {
    flex: 1,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  holidayDay: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  badgeBox: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
});
