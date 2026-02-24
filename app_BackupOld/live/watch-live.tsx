import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function LiveScreen({
  currentLive,
  liveStats,
  liveMessages,
  handleLike,
  setShowGiftMenu,
  showGiftMenu,
  handleSendGift,
  chatMessage,
  setChatMessage,
  handleSendMessage,
  videoReady,
  videoRef,
  leaveLiveSession,
  router,
  agoraError,
}) {
  const chatListRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    chatListRef.current?.scrollToEnd({ animated: true });
  }, [liveMessages]);

  // Optimisation du rendu message
  const renderChatMessage = useCallback(({ item }) => {
    if (item.type === "system") {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    if (item.type === "gift") {
      return (
        <View style={styles.giftMessage}>
          <Text style={styles.giftMessageText}>
            ?? {item.user} a envoyÃ© un cadeau : {item.giftName}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageBubble,
          item.isCurrentUser && styles.currentUserMessage,
        ]}
      >
        <Text style={styles.userName}>{item.user}</Text>
        <Text style={styles.messageText}>{item.message}</Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* VIDEO */}
      <View style={styles.videoContainer}>
        {videoReady ? (
          <View ref={videoRef} style={styles.videoPlayer} />
        ) : (
          <View style={styles.videoPlaceholder}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.placeholderTitle}>
              Connexion au Live...
            </Text>
            <Text style={styles.placeholderSubtitle}>Veuillez patienter</Text>
            <Text style={styles.placeholderText}>
              Le flux vidÃ©o se charge. Cela peut prendre quelques secondes.
            </Text>
          </View>
        )}
      </View>

      {/* HEADER LIVE INFO */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerOverlay}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>

          <Text style={styles.liveTitle} numberOfLines={1}>
            {currentLive?.title || "Live sans titre"}
          </Text>

          <Text style={styles.hostName}>
            Par {currentLive?.hostName || "Anonyme"}
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>??</Text>
              <Text style={styles.statValue}>
                {liveStats?.viewersCount || 0}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statIcon}>??</Text>
              <Text style={styles.statValue}>
                {liveStats?.likesCount || 0}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statIcon}>??</Text>
              <Text style={styles.statValue}>
                {liveStats?.giftsCount || 0}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* ACTIONS RIGHT SIDE */}
      <SafeAreaView style={styles.actionsSafeArea}>
        <View style={styles.actionsColumn}>
          {/* LIKE */}
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="heart-outline" size={28} color="#FF375F" />
            </View>
            <Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>

          {/* GIFTS */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowGiftMenu(true)}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="gift-outline" size={28} color="#FFD700" />
            </View>
            <Text style={styles.actionText}>Cadeau</Text>
          </TouchableOpacity>

          {/* SHARE */}
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Ionicons
                name="share-social-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>

          {/* QUIT */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              leaveLiveSession();
              router.back();
            }}
          >
            <View style={[styles.actionIconContainer, styles.closeButton]}>
              <Ionicons name="close-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Quitter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* CHAT */}
      <View style={styles.chatContainer}>
        <FlatList
          ref={chatListRef}
          data={liveMessages}
          renderItem={renderChatMessage}
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
        />

        {/* INPUT */}
        <View style={styles.chatInputContainer}>
          <TextInput
            value={chatMessage}
            onChangeText={setChatMessage}
            placeholder="Tapez votre message..."
            placeholderTextColor="#888"
            style={styles.chatInput}
            multiline
            maxLength={200}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !chatMessage.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!chatMessage.trim()}
          >
            <Ionicons
              name="send-outline"
              size={20}
              color={chatMessage.trim() ? "#FF375F" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* GIFT MODAL */}
      <Modal
        visible={showGiftMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGiftMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.giftMenu}>
            <View style={styles.giftMenuHeader}>
              <Text style={styles.giftMenuTitle}>Envoyer un cadeau</Text>
              <TouchableOpacity onPress={() => setShowGiftMenu(false)}>
                <Ionicons name="close-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.giftsGrid}>
              <GiftButton
                emoji="??"
                name="CÅ“ur"
                price="10"
                onPress={() => handleSendGift("heart", 10)}
              />
              <GiftButton
                emoji="?"
                name="Ã‰toile"
                price="50"
                onPress={() => handleSendGift("star", 50)}
              />
              <GiftButton
                emoji="??"
                name="Couronne"
                price="100"
                onPress={() => handleSendGift("crown", 100)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* AGORA ERROR */}
      {agoraError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{agoraError}</Text>
        </View>
      )}
    </View>
  );
}

/* SUB COMPONENT â€“ optimized */
function GiftButton({ emoji, name, price, onPress }) {
  return (
    <TouchableOpacity style={styles.giftItem} onPress={onPress}>
      <Text style={styles.giftEmoji}>{emoji}</Text>
      <Text style={styles.giftName}>{name}</Text>
      <Text style={styles.giftPrice}>{price} coins</Text>
    </TouchableOpacity>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoPlayer: {
    flex: 1,
    width: "100%",
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 20,
  },
  placeholderTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  placeholderSubtitle: {
    color: "#CCC",
    fontSize: 15,
    marginTop: 6,
    textAlign: "center",
  },
  placeholderText: {
    color: "#888",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },

  /* HEADER */
  headerSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  headerOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 10,
    margin: 16,
    maxWidth: screenWidth * 0.7,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF375F",
    marginRight: 6,
  },
  liveText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  liveTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  hostName: {
    color: "#DDD",
    fontSize: 13,
    marginBottom: 6,
  },
  statsContainer: {
    flexDirection: "row",
    marginTop: 2,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  statIcon: {
    fontSize: 13,
    marginRight: 3,
    color: "#FFF",
  },
  statValue: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 12,
  },

  /* ACTIONS */
  actionsSafeArea: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  actionsColumn: {
    marginRight: 16,
    alignItems: "center",
  },
  actionButton: {
    alignItems: "center",
    marginBottom: 18,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: "rgba(255,55,95,0.8)",
  },
  actionText: {
    color: "#FFF",
    fontSize: 12,
  },

  /* CHAT */
  chatContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.35,
  },
  chatListContent: {
    padding: 12,
    paddingBottom: 4,
  },

  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    maxWidth: "80%",
  },
  currentUserMessage: {
    backgroundColor: "rgba(255,55,95,0.3)",
    alignSelf: "flex-end",
  },
  userName: {
    color: "#CCC",
    fontSize: 12,
    fontWeight: "500",
  },
  messageText: {
    color: "#FFF",
    fontSize: 14,
  },

  systemMessage: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  systemMessageText: {
    color: "#CCC",
    fontSize: 12,
    fontStyle: "italic",
  },

  giftMessage: {
    alignSelf: "center",
    backgroundColor: "rgba(255,215,0,0.2)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  giftMessageText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
  },

  /* CHAT INPUT */
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    marginLeft: 8,
    padding: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  /* GIFT MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  giftMenu: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  giftMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  giftMenuTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  giftsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  giftItem: {
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    minWidth: 100,
  },
  giftEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  giftName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  giftPrice: {
    color: "#FFD700",
    fontSize: 12,
  },

  /* ERROR */
  errorBanner: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,55,95,0.9)",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  errorText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
