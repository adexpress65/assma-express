// apps/mobile/app/migration-screen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { collection, getDocs, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/config/firebase";

export default function MigrationScreen() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
    console.log(msg);
  };

  const migrateCollection = async (collectionName: string) => {
    addLog(`🚀 Début migration ${collectionName}...`);
    const snapshot = await getDocs(collection(db, collectionName));
    const docs = snapshot.docs;
    setProgress({ current: 0, total: docs.length });
    
    // Traitement par batch de 500 (limite Firestore)
    const batchSize = 500;
    let batch = writeBatch(db);
    let batchCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < docs.length; i++) {
      const document = docs[i];
      const data = document.data();
      
      // Vérifier si déjà à jour (optionnel, pour relancer sans doublon)
      if (data.nameLower && data._migratedAt) {
        continue;
      }

      const updates: any = {
        nameLower: (data.name || "").toLowerCase().trim(),
        _migratedAt: new Date().toISOString(),
      };

      // Champs spécifiques par collection
      if (collectionName === "products") {
        updates.categoryLower = (data.category || data.categoryName || "").toLowerCase().trim();
        updates.supplierLower = (data.supplier || data.companyName || "").toLowerCase().trim();
      }
      if (collectionName === "categories") {
        updates.parentLower = (data.parentName || "").toLowerCase().trim();
      }
      if (collectionName === "companies") {
        updates.cityLower = (data.city || "").toLowerCase().trim();
        updates.countryLower = (data.country || "").toLowerCase().trim();
      }

      batch.update(doc(db, collectionName, document.id), updates);
      batchCount++;
      updatedCount++;

      if (batchCount === batchSize) {
        await batch.commit();
        addLog(`✅ Batch de ${batchSize} documents ${collectionName} migré`);
        batch = writeBatch(db);
        batchCount = 0;
      }

      setProgress({ current: i + 1, total: docs.length });
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    addLog(`✅ Migration ${collectionName} terminée: ${updatedCount} documents mis à jour`);
  };

  const runMigration = async () => {
    setLoading(true);
    setLogs([]);
    try {
      await migrateCollection("products");
      await migrateCollection("categories");
      await migrateCollection("companies");
      addLog("🎉 Migration globale terminée avec succès !");
      Alert.alert("Succès", "Migration terminée ! Vous pouvez supprimer cet écran.");
    } catch (error) {
      addLog(`❌ Erreur: ${error}`);
      Alert.alert("Erreur", String(error));
    } finally {
      setLoading(false);
    }
  };

  const verifyData = async () => {
    setLoading(true);
    try {
      const productsSnap = await getDocs(collection(db, "products"));
      const withoutNameLower = productsSnap.docs.filter(d => !d.data().nameLower);
      addLog(`📊 Produits sans nameLower: ${withoutNameLower.length}/${productsSnap.size}`);
      
      if (withoutNameLower.length > 0) {
        addLog(`⚠️ Exemple: ${withoutNameLower[0]?.data().name}`);
      }
    } catch (error) {
      addLog(`❌ Erreur vérification: ${error}`);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Migration Firestore</Text>
      <Text style={styles.subtitle}>
        Ajout des champs nameLower pour la recherche optimisée
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={runMigration}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🚀 Lancer la migration</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]} 
          onPress={verifyData}
          disabled={loading}
        >
          <Text style={styles.buttonText}>📊 Vérifier les données</Text>
        </TouchableOpacity>
      </View>

      {progress.total > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Progression: {progress.current}/{progress.total}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(progress.current / progress.total) * 100}%` }
              ]} 
            />
          </View>
        </View>
      )}

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#ff6a00",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#333",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    marginBottom: 8,
    fontWeight: "600",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ff6a00",
  },
  logsContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    maxHeight: 300,
  },
  logsTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  logText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
    marginBottom: 4,
  },
});