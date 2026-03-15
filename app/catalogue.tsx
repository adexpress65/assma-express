// apps/mobile/app/seller/catalogue.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
View,
Text,
StyleSheet,
FlatList,
TouchableOpacity,
ActivityIndicator,
TextInput,
SafeAreaView,
Dimensions
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

import {
collection,
query,
where,
orderBy,
limit,
startAfter,
getDocs
} from 'firebase/firestore';

import { db } from '@/config/firebase';

const { width } = Dimensions.get('window');

export default function SellerCatalogue() {

const router = useRouter();
const { user } = useAuth();

const [products, setProducts] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);

const [lastDoc, setLastDoc] = useState<any>(null);
const [hasMore, setHasMore] = useState(true);

const [search, setSearch] = useState('');

useEffect(() => {
loadProducts();
}, [user]);

// Chargement initial

const loadProducts = async () => {

if (!user?.uid) return;

try {

setLoading(true);

const q = query(
collection(db, 'products'),
where('sellerId', '==', user.uid),
orderBy('updatedAt', 'desc'),
limit(20)
);

const snapshot = await getDocs(q);

const items = snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

setProducts(items);

setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

} catch (error) {

console.error('Catalogue error:', error);

} finally {

setLoading(false);

}

};

// Chargement au scroll

const loadMoreProducts = async () => {

if (!hasMore || loadingMore || !lastDoc) return;

try {

setLoadingMore(true);

const q = query(
collection(db, 'products'),
where('sellerId', '==', user.uid),
orderBy('updatedAt', 'desc'),
startAfter(lastDoc),
limit(20)
);

const snapshot = await getDocs(q);

const items = snapshot.docs.map(doc => ({
id: doc.id,
...doc.data()
}));

if (snapshot.docs.length === 0) {
setHasMore(false);
return;
}

setProducts(prev => {

  const merged = [...prev, ...items];

  const unique = Array.from(
    new Map(merged.map(item => [item.id, item])).values()
  );

  return unique;

});


setLastDoc(snapshot.docs[snapshot.docs.length - 1]);

} catch (error) {

console.error('Pagination error:', error);

} finally {

setLoadingMore(false);

}

};

const filteredProducts = useMemo(() => {

if (!search) return products;

return products.filter(item =>
item.name?.toLowerCase().includes(search.toLowerCase()) ||
item.categoryName?.toLowerCase().includes(search.toLowerCase())
);

}, [products, search]);

const renderProductItem = useCallback(({ item }: { item: any }) => {

return (
<ProductCard item={item} router={router} />
);

}, []);

const getItemLayout = (_, index: number) => ({
length: 230,
offset: 230 * index,
index
});

return (

<SafeAreaView style={styles.container}>

<View style={styles.header}>

<TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
<Ionicons name="chevron-back" size={24} color="#333" />
</TouchableOpacity>

<Text style={styles.title}>Catalogue Usine</Text>

<TouchableOpacity 
  onPress={() => router.push('/seller/add-product' as any)} 
  style={styles.iconBtn}
>
  <Ionicons name="add-circle" size={28} color="#FF6B00" />
</TouchableOpacity>

</View>

<View style={styles.searchBar}>

<Ionicons name="search" size={18} color="#999" />

<TextInput
style={styles.input}
placeholder="Rechercher dans mes produits..."
value={search}
onChangeText={setSearch}
/>

</View>

{loading ? (

<ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 50 }} />

) : (

<FlatList

data={filteredProducts}

renderItem={renderProductItem}

keyExtractor={(item, index) => `${item.id}-${index}`}

numColumns={2}

contentContainerStyle={styles.list}

initialNumToRender={8}
maxToRenderPerBatch={6}
windowSize={7}
removeClippedSubviews
updateCellsBatchingPeriod={50}

getItemLayout={getItemLayout}

onEndReached={loadMoreProducts}
onEndReachedThreshold={0.5}

keyboardShouldPersistTaps="handled"

showsVerticalScrollIndicator={false}

ListFooterComponent={
loadingMore
? <ActivityIndicator style={{ marginVertical: 20 }} />
: null
}

ListEmptyComponent={

<View style={styles.empty}>
<Ionicons name="file-tray-stacked-outline" size={50} color="#CCC" />
<Text style={styles.emptyText}>Aucun produit trouvé</Text>
</View>

}

/>

)}

</SafeAreaView>

);

}

const ProductCard = React.memo(({ item, router }: { item: any, router: any }) => (

<TouchableOpacity
style={styles.card}
onPress={() => router.push({
pathname: '/seller/edit-product',
params: { id: item.id }
} as any)}
>

<Image
source={{ uri: item.mainImage || item.imageUrl }}
style={styles.image}
contentFit="cover"
cachePolicy="disk"
/>

{item.specialOffer && (

<View style={styles.promoBadge}>
<Text style={styles.promoText}>OFFRE</Text>
</View>

)}

<View style={styles.content}>

<Text style={styles.category}>
{item.categoryName || 'Général'}
</Text>

<Text style={styles.name} numberOfLines={2}>
{item.name}
</Text>

<View style={styles.priceRow}>

<Text style={styles.price}>
{item.price?.toLocaleString()} {item.currency || 'XOF'}
</Text>

{item.originalPrice > item.price && (

<Text style={styles.oldPrice}>
{item.originalPrice?.toLocaleString()}
</Text>

)}

</View>

<View style={styles.footer}>

<View style={styles.stockInfo}>
<Ionicons name="cube-outline" size={12} color="#666" />
<Text style={styles.stockText}>
{item.stockQuantity > 1000 ? '+999' : item.stockQuantity} dispos
</Text>
</View>

<Text style={styles.variantText}>
{item.variantCount || 0} var.
</Text>

</View>

</View>

</TouchableOpacity>

));

const styles = StyleSheet.create({

container: { flex: 1, backgroundColor: '#FFF' },

header: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
padding: 15
},

title: {
fontSize: 20,
fontWeight: '800',
color: '#1A1A1A'
},

iconBtn: { padding: 5 },

searchBar: {
flexDirection: 'row',
alignItems: 'center',
backgroundColor: '#F5F5F5',
marginHorizontal: 15,
paddingHorizontal: 15,
borderRadius: 12,
marginBottom: 10
},

input: {
flex: 1,
height: 45,
marginLeft: 10,
fontSize: 14
},

list: { padding: 10 },

card: {
width: (width / 2) - 15,
backgroundColor: '#FFF',
margin: 5,
borderRadius: 15,
borderWidth: 1,
borderColor: '#F0F0F0',
overflow: 'hidden'
},

image: {
width: '100%',
height: 140,
backgroundColor: '#F9F9F9'
},

promoBadge: {
position: 'absolute',
top: 10,
left: 10,
backgroundColor: '#FF6B00',
paddingHorizontal: 6,
paddingVertical: 2,
borderRadius: 4
},

promoText: {
color: '#FFF',
fontSize: 9,
fontWeight: '900'
},

content: { padding: 10 },

category: {
fontSize: 10,
color: '#FF6B00',
fontWeight: 'bold',
textTransform: 'uppercase'
},

name: {
fontSize: 13,
fontWeight: '600',
color: '#333',
marginTop: 2,
height: 35
},

priceRow: {
flexDirection: 'row',
alignItems: 'center',
marginTop: 5,
gap: 5
},

price: {
fontSize: 14,
fontWeight: '800',
color: '#1A1A1A'
},

oldPrice: {
fontSize: 11,
color: '#AAA',
textDecorationLine: 'line-through'
},

footer: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginTop: 10,
paddingTop: 8,
borderTopWidth: 1,
borderTopColor: '#F5F5F5'
},

stockInfo: {
flexDirection: 'row',
alignItems: 'center',
gap: 4
},

stockText: {
fontSize: 10,
color: '#666'
},

variantText: {
fontSize: 10,
color: '#999',
fontStyle: 'italic'
},

empty: {
alignItems: 'center',
marginTop: 100
},

emptyText: {
color: '#999',
marginTop: 10
}

});
