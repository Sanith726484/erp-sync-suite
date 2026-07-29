import { ErpAdapter } from './base';
import { Customer, Product, Order, GpsLog, Visit, CompanyBranding } from '../types';

export class MockAdapter implements ErpAdapter {
  private getStorageItem<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    const value = localStorage.getItem(key);
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  private setStorageItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Helper distance calculator (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  async testConnection(): Promise<boolean> {
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
  }

  async login(username: string, _password?: string): Promise<{ token: string; username: string }> {
    return { token: 'mock_token_123', username };
  }

  async getCustomers(): Promise<Customer[]> {
    const defaultCustomers: Customer[] = [
      { id: 'CUST-001', name: 'John Doe Enterprise', mobile: '9876543210', email: 'john@doe.com' },
      { id: 'CUST-002', name: 'Apex Builders', mobile: '8765432109', email: 'contact@apex.com' },
      { id: 'CUST-003', name: 'Greenwood Resort', mobile: '7654321098', email: 'stay@greenwood.com' },
      { id: 'CUST-004', name: 'Metro Hospitals', mobile: '6543210987', email: 'info@metrohospitals.org' },
    ];
    
    const customers = this.getStorageItem<Customer[]>('mock_customers', defaultCustomers);
    this.setStorageItem('mock_customers', customers);
    return customers;
  }

  async getProducts(): Promise<Product[]> {
    const defaultProducts: Product[] = [
      { id: 'ITEM-SOLAR-500W', name: 'Erpnext Mono Perc Solar Panel 500W', rate: 150.00, description: 'High-efficiency monocrystalline PV panel' },
      { id: 'ITEM-INV-5KW', name: 'Erpnext Grid-Tied Inverter 5kW', rate: 450.00, description: 'Single-phase smart string solar inverter' },
      { id: 'ITEM-INV-10KW', name: 'Erpnext Grid-Tied Inverter 10kW', rate: 850.00, description: 'Three-phase smart string solar inverter' },
      { id: 'ITEM-CABLE-DC', name: 'Solar DC Cable 4 Sq.mm (Mtr)', rate: 1.20, description: 'UV resistant cross-linked solar cable' },
      { id: 'ITEM-STRUCTURE-GI', name: 'Galvanized Mounting Structure 4-Panel', rate: 80.00, description: 'HDG structure for rooftop mounting' },
    ];
    return defaultProducts;
  }

  async getOrders(user?: string): Promise<Order[]> {
    const orders = this.getStorageItem<Order[]>('mock_orders', []);
    return orders;
  }

  async createOrder(order: Order): Promise<Order> {
    const orders = this.getStorageItem<Order[]>('mock_orders', []);
    const newOrder: Order = {
      ...order,
      id: `SO-MOCK-${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'Draft',
    };
    orders.unshift(newOrder);
    this.setStorageItem('mock_orders', orders);
    return newOrder;
  }

  async saveGpsLocation(lat: number, lng: number, user: string): Promise<{ status: string; reason?: string }> {
    const logs = this.getStorageItem<GpsLog[]>('mock_gps_logs', []);
    const todayISO = new Date().toISOString().slice(0, 10);
    const userLogs = logs.filter(l => l.user === user && l.timestamp.startsWith(todayISO));
    
    let dist = '—';
    if (userLogs.length > 0) {
      const prev = userLogs[userLogs.length - 1];
      const d = this.calculateDistance(prev.latitude, prev.longitude, lat, lng);
      dist = d.toFixed(3); // distance in km, 3 decimal places
    }

    const newLog: GpsLog = {
      id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
      user,
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      distanceFromPrevious: dist,
    };

    logs.push(newLog);
    this.setStorageItem('mock_gps_logs', logs);
    return { status: 'success' };
  }

  async getGpsLocationLogs(user: string, dateISO: string): Promise<GpsLog[]> {
    const logs = this.getStorageItem<GpsLog[]>('mock_gps_logs', []);
    return logs.filter(log => log.user === user && log.timestamp.startsWith(dateISO));
  }

  async checkInVisit(visit: Omit<Visit, 'status' | 'id'>): Promise<Visit> {
    const visits = this.getStorageItem<Visit[]>('mock_visits', []);
    const newVisit: Visit = {
      ...visit,
      id: `VST-${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'Checked In',
    };
    visits.unshift(newVisit);
    this.setStorageItem('mock_visits', visits);
    return newVisit;
  }

  async checkOutVisit(visitId: string, description: string, lat?: number, lng?: number): Promise<Visit> {
    const visits = this.getStorageItem<Visit[]>('mock_visits', []);
    const idx = visits.findIndex(v => v.id === visitId);
    if (idx === -1) throw new Error('Visit not found');
    
    visits[idx] = {
      ...visits[idx],
      status: 'Checked Out',
      description: description || visits[idx].description,
      ...(lat !== undefined ? { latitude: lat } : {}), // Update with latest checkout location
      ...(lng !== undefined ? { longitude: lng } : {}),
    };
    this.setStorageItem('mock_visits', visits);
    return visits[idx];
  }

  async getActiveVisit(user: string): Promise<Visit | null> {
    const visits = this.getStorageItem<Visit[]>('mock_visits', []);
    // Search active visit for the user
    // In mock, we assume the creator is the user (or we match field)
    const active = visits.find(v => v.status === 'Checked In');
    return active || null;
  }

  async getVisits(user: string, dateISO: string): Promise<Visit[]> {
    const visits = this.getStorageItem<Visit[]>('mock_visits', []);
    return visits.filter(v => v.date === dateISO);
  }

  async getCompanyBranding(companyName?: string): Promise<CompanyBranding> {
    return {
      companyName: companyName || 'Mock Company',
      logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aba9?w=200&h=200&fit=crop', // generic logo placeholder
      appIconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop', // generic app icon
      splashScreenUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop', // generic splash screen
      defaultCurrency: 'USD',
    };
  }
}
