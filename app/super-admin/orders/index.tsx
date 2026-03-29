import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { collection, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SuperAdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadOrders = async () => {
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    } catch (error) {
      console.error("Erreur commandes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/super-admin/orders/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>{item.orderId || "N/A"}</Text>
        <Text style={styles.statusBadge}>{item.status || "En attente"}</Text>
      </View>
      
      <Text style={styles.clientName}>{item.shippingAddress?.fullName || "Client inconnu"}</Text>
      
      <View style={styles.cardFooter}>
        <Text style={styles.amount}>{(item.total || 0).toLocaleString()} XOF</Text>
        <Text style={styles.date}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Commandes</Text>
      {loading ? (
        <ActivityIndicator color="#FF6B00" size="large" />
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrders} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", padding: 15 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, marginTop: 40 },
  card: { backgroundColor: "#FFF", borderRadius: 10, padding: 15, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  orderId: { fontWeight: "bold", color: "#666" },
  statusBadge: { backgroundColor: "#FF6B0020", color: "#FF6B00", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, fontSize: 11, fontWeight: "bold" },
  clientName: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#EEE", paddingTop: 10 },
  amount: { fontWeight: "bold", color: "#333" },
  date: { color: "#999", fontSize: 12 }
});