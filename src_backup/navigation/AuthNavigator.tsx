import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import SuperAdminDashboard from "../screens/SuperAdminDashboard";
import AdminDashboard from "../screens/AdminDashboard";
import SellerDashboard from "../screens/SellerDashboard";
import BottomTabs from "./BottomTabs"; // ton Accueil

export type AuthStackParamList = {
  Login: undefined;
  SuperAdminDashboard: undefined;
  AdminDashboard: undefined;
  SellerDashboard: undefined;
  Home: undefined; // via BottomTabs
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboard} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="SellerDashboard" component={SellerDashboard} />
      <Stack.Screen name="Home" component={BottomTabs} />
    </Stack.Navigator>
  );
}
