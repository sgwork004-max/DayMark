import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { HomeScreen } from "../screens/HomeScreen";
import { NoteScreen } from "../screens/NoteScreen";
import { SmartViewScreen } from "../screens/SmartViewScreen";
import { SearchScreen } from "../screens/SearchScreen";

export type RootStackParams = {
  Tabs: undefined;
  Note: { noteId: string; title?: string };
};

export type TabParams = {
  Notes: undefined;
  SmartViews: undefined;
  Search: undefined;
};

const Stack = createNativeStackNavigator<RootStackParams>();
const Tab   = createBottomTabNavigator<TabParams>();

const DARK_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: "#141414",
    card: "#1a1a1a",
    text: "#e8e8e8",
    border: "#2e2e2e",
    primary: "#7c6fff",
    notification: "#7c6fff",
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: "#1a1a1a", borderTopColor: "#2e2e2e" },
        tabBarActiveTintColor: "#7c6fff",
        tabBarInactiveTintColor: "#888",
        headerStyle: { backgroundColor: "#1a1a1a" },
        headerTintColor: "#e8e8e8",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Notes"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◆</Text>, title: "Notes" }}
      />
      <Tab.Screen
        name="SmartViews"
        component={SmartViewScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text>, title: "Views" }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌕</Text>, title: "Search" }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={DARK_THEME}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Note"
          component={NoteScreen}
          options={({ route }) => ({
            title: route.params.title ?? "Note",
            headerStyle: { backgroundColor: "#1a1a1a" },
            headerTintColor: "#e8e8e8",
            headerTitleStyle: { fontWeight: "700" },
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
