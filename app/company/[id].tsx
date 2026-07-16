import React, { Suspense, lazy } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

const CompanyProductsScreen = lazy(() => import("@/screens/CompanyProductsScreen"));
const CompanyProfileScreen = lazy(() => import("@/screens/CompanyProfileScreen"));

export default function CompanyRoute() {
  const params = useLocalSearchParams<{ view?: string }>();
  const showDashboard = params.view === "dashboard";

  return (
    <Suspense
      fallback={
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color="#FF6A00" />
        </View>
      }
    >
      {showDashboard ? <CompanyProfileScreen /> : <CompanyProductsScreen />}
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
});
