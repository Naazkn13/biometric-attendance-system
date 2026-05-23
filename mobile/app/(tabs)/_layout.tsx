import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: role === 'ADMIN' ? 'Admin' : 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name={role === 'ADMIN' ? 'cog' : 'user'} color={color} />,
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
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
