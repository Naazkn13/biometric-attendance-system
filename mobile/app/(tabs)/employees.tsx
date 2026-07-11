import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform, Modal, ScrollView } from 'react-native';
import { getEmployees, getPunchesByEmployee } from '@/services/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function EmployeesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down states
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Month picker state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Load employee list
  const loadEmployees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getEmployees();
      setEmployees(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch employees');
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Load employee history (monthly)
  const loadHistory = async (emp: any, month?: number, year?: number) => {
    setSelectedEmployee(emp);
    setHistoryLoading(true);
    setHistoryError(null);
    const m = month || selectedMonth;
    const y = year || selectedYear;
    try {
      const data = await getPunchesByEmployee(emp.id, m, y);
      setHistoryData(data);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load history');
      setHistoryData(null);
    }
    setHistoryLoading(false);
  };

  // Change month
  const changeMonth = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setShowMonthPicker(false);
    if (selectedEmployee) {
      loadHistory(selectedEmployee, month, year);
    }
  };

  // Navigate months with arrows
  const navigateMonth = (delta: number) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    changeMonth(newMonth, newYear);
  };

  // Check if we can go forward (don't go past current month)
  const canGoForward = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth() + 1);

  // Month Picker Modal
  const renderMonthPicker = () => (
    <Modal visible={showMonthPicker} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
            <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
              <FontAwesome name="times" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Year selector */}
          <View style={styles.yearRow}>
            <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={styles.yearBtn}>
              <FontAwesome name="chevron-left" size={16} color={colors.tint} />
            </TouchableOpacity>
            <Text style={[styles.yearText, { color: colors.text }]}>{selectedYear}</Text>
            <TouchableOpacity 
              onPress={() => { if (selectedYear < now.getFullYear()) setSelectedYear(y => y + 1); }} 
              style={styles.yearBtn}
              disabled={selectedYear >= now.getFullYear()}
            >
              <FontAwesome name="chevron-right" size={16} color={selectedYear >= now.getFullYear() ? 'gray' : colors.tint} />
            </TouchableOpacity>
          </View>

          {/* Month grid */}
          <View style={styles.monthGrid}>
            {SHORT_MONTHS.map((name, idx) => {
              const m = idx + 1;
              const isFuture = selectedYear === now.getFullYear() && m > now.getMonth() + 1;
              const isSelected = m === selectedMonth && selectedYear === selectedYear;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.monthCell,
                    isSelected && { backgroundColor: colors.tint },
                    isFuture && { opacity: 0.3 },
                  ]}
                  disabled={isFuture}
                  onPress={() => changeMonth(m, selectedYear)}
                >
                  <Text style={[
                    styles.monthCellText,
                    { color: isSelected ? '#fff' : colors.text },
                  ]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );

  // -------------------------------------------------------------
  // RENDER: LIST VIEW
  // -------------------------------------------------------------
  if (!selectedEmployee) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6' }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Employees</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.tint} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: 'red' }}>{error}</Text>
            <TouchableOpacity onPress={() => loadEmployees()} style={{ marginTop: 15 }}>
              <Text style={{ color: colors.tint }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEmployees(true)} />}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.empCard, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}
                onPress={() => loadHistory(item)}
              >
                <View>
                  <Text style={[styles.empName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={{ color: colors.text, opacity: 0.5, marginTop: 4 }}>ID: {item.device_user_id}</Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color={colors.tint} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER: DRILL-DOWN VIEW (History with Month Picker)
  // -------------------------------------------------------------
  return (
    <View style={styles.container}>
      {renderMonthPicker()}

      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6', justifyContent: 'flex-start' }]}>
        <TouchableOpacity onPress={() => { setSelectedEmployee(null); setHistoryData(null); setHistoryError(null); }} style={{ padding: 10, marginRight: 10 }}>
          <FontAwesome name="arrow-left" size={20} color={colors.tint} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedEmployee.name}</Text>
      </View>

      {/* Month Navigation Bar */}
      <View style={[styles.monthNav, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#e5e7eb' }]}>
        <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.tint} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={styles.monthDisplay}>
          <FontAwesome name="calendar" size={16} color={colors.tint} style={{ marginRight: 8 }} />
          <Text style={[styles.monthDisplayText, { color: colors.text }]}>
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </Text>
          <FontAwesome name="caret-down" size={14} color={colors.tint} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn} disabled={!canGoForward}>
          <FontAwesome name="chevron-right" size={18} color={canGoForward ? colors.tint : 'gray'} />
        </TouchableOpacity>
      </View>

      {historyLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.tint} /></View>
      ) : historyError ? (
        <View style={styles.center}>
          <Text style={{ color: 'red', textAlign: 'center' }}>{historyError}</Text>
          <TouchableOpacity onPress={() => loadHistory(selectedEmployee)} style={{ marginTop: 15 }}>
            <Text style={{ color: colors.tint }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : historyData ? (
        <>
          {/* Summary Banner */}
          <View style={styles.summaryBanner}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>{historyData.month || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}</Text>
            <Text style={{ color: 'white' }}>
              Present: {historyData.summary?.days_present ?? 0}  |  Absent: {historyData.summary?.days_absent ?? 0}
            </Text>
          </View>
          <FlatList
            data={(historyData.days || []).filter((d: any) => d.status !== 'ABSENT')}
            keyExtractor={(item) => item.date}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.historyCard, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <View style={styles.historyCardHeader}>
                  <Text style={[styles.historyDate, { color: colors.text }]}>
                    {new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.total_hours} hrs</Text>
                </View>
                {item.punches.map((p: any, idx: number) => (
                  <View key={idx} style={styles.historyPunchRow}>
                    <Text style={{ color: colors.text, opacity: 0.8 }}>{p.in}  →  {p.out || '—'}</Text>
                    <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>{p.duration}</Text>
                  </View>
                ))}
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 50, color: colors.text, opacity: 0.5 }}>
                No attendance data for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
              </Text>
            }
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContent: { padding: 10, paddingBottom: 30 },
  empCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  empName: { fontSize: 16, fontWeight: 'bold' },
  
  // Month Navigation
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  navBtn: { padding: 10 },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  monthDisplayText: { fontSize: 16, fontWeight: 'bold' },

  // Month Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 30,
  },
  yearBtn: { padding: 10 },
  yearText: { fontSize: 22, fontWeight: 'bold' },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthCell: {
    width: '30%',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 10,
  },
  monthCellText: { fontSize: 15, fontWeight: '600' },

  // Summary & History
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#3b82f6',
    padding: 12,
    paddingHorizontal: 20,
  },
  historyCard: {
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    paddingBottom: 8,
  },
  historyDate: { fontWeight: 'bold', fontSize: 15 },
  historyPunchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
