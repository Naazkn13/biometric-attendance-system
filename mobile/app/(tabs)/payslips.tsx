import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getMyPayslips, getMyPayslipDetail, getAllPayslips } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (val: number | null | undefined) => val === undefined || val === null ? '₹0' : `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayslipsScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [role, setRole] = useState<string>('EMPLOYEE');

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(r => setRole(r || 'EMPLOYEE'));
  }, []);

  useEffect(() => {
    if (role) {
      loadPayslips();
    }
  }, [year, month, role]);

  const loadPayslips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = ['ADMIN', 'SUPERADMIN', 'HM'].includes(role)
        ? await getAllPayslips(year, month)
        : await getMyPayslips(year, month);
      setPayslips(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const toggleDetail = async (payslip: any) => {
    if (expandedId === payslip.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(payslip.id);
    setDetailLoading(true);
    try {
      const data = await getMyPayslipDetail(payslip.period_start);
      setDetail(data);
    } catch (e: any) {
      setDetail(payslip);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Month & Year Selector */}
      <View style={styles.yearSelector}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.yearTitle}>{monthNames[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>▶</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : payslips.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>💰</Text>
          <Text style={styles.emptyText}>No finalized payslips for {year}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {payslips.map((p: any) => {
            const d = new Date(p.period_start);
            const periodName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            const isExpanded = expandedId === p.id;

            return (
              <View key={p.id}>
                {/* Payslip Card */}
                <TouchableOpacity
                  style={[styles.payslipCard, isExpanded && styles.payslipCardActive]}
                  onPress={() => toggleDetail(p)}
                  activeOpacity={0.7}
                >
                  <View style={styles.payslipHeader}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      {['ADMIN', 'SUPERADMIN', 'HM'].includes(role) && (
                        <Text style={[styles.periodText, { color: '#3b82f6', marginBottom: 2 }]} numberOfLines={2}>
                          {p.employee_name || 'Unknown Employee'}
                        </Text>
                      )}
                      <Text style={styles.periodText}>{periodName}</Text>
                      <View style={styles.finalBadge}>
                        <Text style={styles.finalBadgeText}>FINALIZED</Text>
                      </View>
                    </View>
                    <View style={styles.payAmountContainer}>
                      <Text style={styles.payAmount}>{fmt(p.final_salary)}</Text>
                      <Text style={styles.tapHint}>{isExpanded ? 'Tap to hide ▲' : 'Tap to view ▼'}</Text>
                    </View>
                  </View>

                  {/* Quick Stats Row */}
                  <View style={styles.quickStats}>
                    <View style={styles.quickStatItem}>
                      <Text style={styles.quickStatLabel}>Present</Text>
                      <Text style={styles.quickStatValue}>{p.days_present || 0}d</Text>
                    </View>
                    <View style={styles.quickStatItem}>
                      <Text style={styles.quickStatLabel}>OT</Text>
                      <Text style={[styles.quickStatValue, { color: '#0284c7' }]}>{(p.overtime_hours || 0).toFixed(1)}h</Text>
                    </View>
                    <View style={styles.quickStatItem}>
                      <Text style={styles.quickStatLabel}>Absent</Text>
                      <Text style={[styles.quickStatValue, { color: p.days_absent > 0 ? '#dc2626' : '#94a3b8' }]}>{p.days_absent || 0}d</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Detail */}
                {isExpanded && (
                  <View style={styles.detailContainer}>
                    {detailLoading ? (
                      <ActivityIndicator color="#3b82f6" style={{ padding: 20 }} />
                    ) : detail ? (
                      <PayslipBreakdown payslip={detail} />
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function PayslipBreakdown({ payslip }: { payslip: any }) {
  const p = payslip;
  const basicSalary = p.basic_salary || 0;
  const otPay = p.overtime_pay || 0;
  const pt = p.calculation_details?.pt_deduction || p.pt_deduction || 0;
  const plAdjustment = p.calculation_details?.pl_adjustment || p.pl_adjustment || 0;
  const conveyance = p.calculation_details?.conveyance || 0;
  const perDaySalary = p.calculation_details?.per_day_salary || p.per_day_salary || 0;
  const totalDaySalary = p.calculation_details?.total_day_salary || p.total_day_salary || 0;

  const lopDeduction = (p.days_absent || 0) * perDaySalary;
  const totalGap = basicSalary - totalDaySalary;
  const shortHoursDeduction = Math.max(0, Math.round((totalGap - lopDeduction) * 100) / 100);
  const totalEarnings = basicSalary + otPay + conveyance + plAdjustment;
  const totalDeductions = lopDeduction + shortHoursDeduction + pt;
  const netPay = p.final_salary || Math.round((totalEarnings - totalDeductions) * 100) / 100;

  return (
    <View style={styles.breakdownCard}>
      {/* Earnings */}
      <Text style={styles.sectionTitle}>Earnings</Text>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Basic Salary</Text>
        <Text style={styles.breakdownValue}>{fmt(basicSalary)}</Text>
      </View>
      {otPay > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Overtime ({(p.overtime_hours || 0).toFixed(1)}h)</Text>
          <Text style={[styles.breakdownValue, { color: '#0284c7' }]}>{fmt(otPay)}</Text>
        </View>
      )}
      {conveyance > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Conveyance</Text>
          <Text style={styles.breakdownValue}>{fmt(conveyance)}</Text>
        </View>
      )}
      {plAdjustment > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>PL Adjustment</Text>
          <Text style={[styles.breakdownValue, { color: '#16a34a' }]}>{fmt(plAdjustment)}</Text>
        </View>
      )}
      <View style={[styles.breakdownRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total Earnings</Text>
        <Text style={styles.totalValue}>{fmt(totalEarnings)}</Text>
      </View>

      {/* Deductions */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Deductions</Text>
      {lopDeduction > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>LOP ({p.days_absent || 0} days)</Text>
          <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>-{fmt(lopDeduction)}</Text>
        </View>
      )}
      {shortHoursDeduction > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Short Hours</Text>
          <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>-{fmt(shortHoursDeduction)}</Text>
        </View>
      )}
      {pt > 0 && (
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Professional Tax</Text>
          <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>-{fmt(pt)}</Text>
        </View>
      )}
      <View style={[styles.breakdownRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total Deductions</Text>
        <Text style={[styles.totalValue, { color: '#dc2626' }]}>{fmt(totalDeductions)}</Text>
      </View>

      {/* Net Pay */}
      <View style={styles.netPayRow}>
        <Text style={styles.netPayLabel}>Net Pay</Text>
        <Text style={styles.netPayValue}>{fmt(netPay)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  yearTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 15, fontWeight: '500' },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  payslipCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  payslipCardActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  payslipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  periodText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  finalBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  finalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5,
  },
  payAmountContainer: {
    alignItems: 'flex-end',
  },
  payAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  tapHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  quickStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  quickStatItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  detailContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 12,
  },
  breakdownCard: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  netPayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  netPayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e40af',
  },
  netPayValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e40af',
  },
});
