const ProductMessageBubble = ({ productInfo }) => (
  <View style={styles.productBubble}>
    <Image source={{ uri: productInfo.image }} style={styles.bubbleThumb} />
    <View style={styles.bubbleInfo}>
      <Text style={styles.bubbleTitle} numberOfLines={2}>{productInfo.name}</Text>
      <Text style={styles.bubblePrice}>{productInfo.price} CFA</Text>
      <TouchableOpacity style={styles.viewProductBtn}>
        <Text style={styles.viewProductText}>Voir le produit</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  productBubble: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    width: 250,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 10,
  },
  bubbleThumb: { width: 60, height: 60, borderRadius: 4 },
  bubbleInfo: { flex: 1, marginLeft: 10 },
  bubbleTitle: { fontSize: 13, color: '#333', fontWeight: '500' },
  bubblePrice: { fontSize: 14, fontWeight: 'bold', color: '#FF6A00', marginVertical: 4 },
  viewProductBtn: { borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 5 },
  viewProductText: { color: '#007AFF', fontSize: 12, textAlign: 'center' }
});
