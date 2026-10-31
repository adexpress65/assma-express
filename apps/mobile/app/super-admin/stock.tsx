import ProductStockListScreen from "@/features/stock/ProductStockListScreen";
import { useOperationalStaffAccess } from "@/hooks/useOperationalStaffAccess";
import { ActivityIndicator, View, StyleSheet } from "react-native";

export default function SuperAdminStockScreen() {
  const { allowed, isLoading } = useOperationalStaffAccess();

  if (isLoading || !allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <ProductStockListScreen mode="admin" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});
