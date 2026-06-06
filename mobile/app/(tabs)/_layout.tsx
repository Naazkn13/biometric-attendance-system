import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Image, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

function LogoHeader() {
  return (
    <View style={{ marginLeft: 16 }}>
      <Image 
        source={require('../../assets/images/icon.png')} 
        style={{ width: 32, height: 32, borderRadius: 8 }} 
      />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [role, setRole] = useState<string>('EMPLOYEE');

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(r => setRole(r || 'EMPLOYEE'));
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
        headerTitleStyle: { fontWeight: '700' },
        headerLeft: () => <LogoHeader />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: role === 'ADMIN' ? 'Admin' : 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name={role === 'ADMIN' ? 'cog' : 'user'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
          // Both Admin and Employee can view attendance (Admins view company-wide)
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'Leaves',
          tabBarIcon: ({ color }) => <TabBarIcon name="bed" color={color} />,
          // Both Admin and Employee have a Leaves screen
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          title: 'Payslips',
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
          // Both Admin and Employee have a Payslips screen
        }}
      />
      <Tabs.Screen
        name="admin-sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color }) => <TabBarIcon name="upload" color={color} />,
          href: role === 'ADMIN' ? '/admin-sync' : null,
        }}
      />
      <Tabs.Screen
        name="corrections"
        options={{
          href: null,
          title: 'Corrections',
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          href: null,
          title: 'Employees',
        }}
      />
      <Tabs.Screen
        name="holidays"
        options={{
          href: null,
          title: 'Holidays',
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          href: null,
          title: 'Shifts',
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          href: null,
          title: 'Devices',
        }}
      />
      <Tabs.Screen
        name="payroll"
        options={{
          href: null,
          title: 'Payroll',
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          href: null,
          title: 'Users',
        }}
      />
    </Tabs>
  );
}
