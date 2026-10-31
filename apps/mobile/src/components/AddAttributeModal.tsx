// components/AddAttributeModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AddAttributeModalProps {
  visible: boolean;
  onClose: () => void;
  attributeName: string;
  setAttributeName: (text: string) => void;
  onAdd: () => void;
  styles: any;
}

const AddAttributeModal: React.FC<AddAttributeModalProps> = ({
  visible,
  onClose,
  attributeName,
  setAttributeName,
  onAdd,
  styles,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", alignItems: "center" }}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel attribut</Text>

              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom de l'attribut</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Ex: RAM, Stockage..."
                  value={attributeName}
                  onChangeText={setAttributeName}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={onAdd}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />

                <Text style={styles.modalAddButtonText}>
                  Ajouter l'attribut
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ✅ Vérifie que c'est bien exporté par défaut
export default AddAttributeModal;