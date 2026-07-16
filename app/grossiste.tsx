import React, { Suspense, lazy } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const GrossisteScreen = lazy(() => import("@/screens/GrossisteScreen"));

export default function GrossisteRoute() {
  return (
    <Suspense
      fallback={
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color="#FF6A00" />
        </View>
      }
    >
      <GrossisteScreen />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
  },
});
