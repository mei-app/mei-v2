import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#00000040",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#00000010",
          backgroundColor: "#ffffff",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "lists",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>☰</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "profile",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>◯</Text>
          ),
        }}
      />
    </Tabs>
  );
}
