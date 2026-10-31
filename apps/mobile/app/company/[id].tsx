import React from "react";
import { useLocalSearchParams } from "expo-router";
import CompanyProductsScreen from "@/screens/CompanyProductsScreen";
import CompanyProfileScreen from "@/screens/CompanyProfileScreen";

export default function CompanyRoute() {
  const params = useLocalSearchParams<{ view?: string }>();
  const showDashboard = params.view === "dashboard";

  return showDashboard ? <CompanyProfileScreen /> : <CompanyProductsScreen />;
}
