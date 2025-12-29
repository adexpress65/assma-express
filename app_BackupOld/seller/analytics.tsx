import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('week');
  const [activeMetric, setActiveMetric] = useState('revenue');

  // DonnÃ©es simulÃ©es pour les graphiques
  const revenueData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [{
      data: [4500, 5200, 4800, 6100, 7200, 6800, 7500],
      color: () => '#FF6B00',
      strokeWidth: 2
    }]
  };

  const ordersData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [{
      data: [12, 19, 15, 22, 28, 25, 30],
      color: () => '#4CAF50',
      strokeWidth: 2
    }]
  };

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF6B00' }
  };

  const kpiCards = [
    {
      title: 'Chiffre d\'Affaires',
      value: '45,800 DH',
      change: '+12.5%',
      isPositive: true,
      icon: 'trending-up',
      color: '#FF6B00'
    },
    {
      title: 'Commandes',
      value: '152',
      change: '+8.3%',
      isPositive: true,
      icon: 'cart',
      color: '#4CAF50'
    },
    {
      title: 'Panier Moyen',
      value: '301 DH',
      change: '+3.8%',
      isPositive: true,
      icon: 'cash',
      color: '#2196F3'
    },
    {
      title: 'Taux de Conversion',
      value: '4.2%',
      change: '-0.5%',
      isPositive: false,
      icon: 'pulse',
      color: '#9C27B0'
    }
  ];

  const topProducts = [
    { name: 'Smartphone 5G', sales: 45, revenue: '13,500 DH' },
    { name: 'Casque Audio', sales: 32, revenue: '9,600 DH' },
    { name: 'Montre ConnectÃ©e', sales: 28, revenue: '12,600 DH' },
    { name: 'Power Bank', sales: 25, revenue: '3,750 DH' },
    { name: 'CÃ¢bles USB', sales: 22, revenue: '1,100 DH' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytiques</Text>
        <TouchableOpacity>
          <Ionicons name="download-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Filtres de pÃ©riode */}
        <View style={styles.filters}>
          {['day', 'week', 'month', 'year'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.filterButton,
                timeRange === period && styles.filterButtonActive
              ]}
              onPress={() => setTimeRange(period)}
            >
              <Text style={[
                styles.filterText,
                timeRange === period && styles.filterTextActive
              ]}>
                {period === 'day' ? 'Jour' : 
                 period === 'week' ? 'Semaine' :
                 period === 'month' ? 'Mois' : 'AnnÃ©e'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cartes KPI */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.kpiScroll}
        >
          {kpiCards.map((kpi, index) => (
            <View key={index} style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIcon, { backgroundColor: kpi.color + '20' }]}>
                  <Ionicons name={kpi.icon as any} size={20} color={kpi.color} />
                </View>
                <View style={[
                  styles.changeBadge,
                  { backgroundColor: kpi.isPositive ? '#E8F5E8' : '#FFE8E8' }
                ]}>
                  <Ionicons 
                    name={kpi.isPositive ? 'trending-up' : 'trending-down'} 
                    size={12} 
                    color={kpi.isPositive ? '#4CAF50' : '#FF4444'} 
                  />
                  <Text style={[
                    styles.changeText,
                    { color: kpi.isPositive ? '#4CAF50' : '#FF4444' }
                  ]}>
                    {kpi.change}
                  </Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiTitle}>{kpi.title}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Graphiques */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Performance des Ventes</Text>
            <View style={styles.chartTabs}>
              {['revenue', 'orders'].map((metric) => (
                <TouchableOpacity
                  key={metric}
                  style={[
                    styles.chartTab,
                    activeMetric === metric && styles.chartTabActive
                  ]}
                  onPress={() => setActiveMetric(metric)}
                >
                  <Text style={[
                    styles.chartTabText,
                    activeMetric === metric && styles.chartTabTextActive
                  ]}>
                    {metric === 'revenue' ? 'Revenus' : 'Commandes'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LineChart
            data={activeMetric === 'revenue' ? revenueData : ordersData}
            width={screenWidth - 32}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Produits populaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produits Populaires</Text>
          {topProducts.map((product, index) => (
            <View key={index} style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productSales}>{product.sales} ventes</Text>
              </View>
              <Text style={styles.productRevenue}>{product.revenue}</Text>
            </View>
          ))}
        </View>

        {/* MÃ©triques supplÃ©mentaires */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="eye-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>2.4K</Text>
            <Text style={styles.metricLabel}>Vues boutique</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="heart-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>156</Text>
            <Text style={styles.metricLabel}>Favoris</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="star-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>4.8</Text>
            <Text style={styles.metricLabel}>Avis</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="time-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>98%</Text>
            <Text style={styles.metricLabel}>Taux rÃ©ponse</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B00',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  kpiScroll: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  kpiCard: {
    width: 160,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 14,
    color: '#666',
  },
  chartSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  chartTabs: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 4,
  },
  chartTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chartTabActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  chartTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  chartTabTextActive: {
    color: '#333',
  },
  chart: {
    borderRadius: 12,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productSales: {
    fontSize: 12,
    color: '#666',
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  metricCard: {
    width: (screenWidth - 56) / 2,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

