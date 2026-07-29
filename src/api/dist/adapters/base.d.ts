import { Customer, Product, Order, GpsLog, Visit, CompanyBranding } from '../types';
export interface ErpAdapter {
    testConnection(): Promise<boolean>;
    login(username: string, password?: string): Promise<{
        token: string;
        username: string;
    }>;
    getCustomers(): Promise<Customer[]>;
    getProducts(): Promise<Product[]>;
    getOrders(user?: string): Promise<Order[]>;
    createOrder(order: Order): Promise<Order>;
    saveGpsLocation(lat: number, lng: number, user: string): Promise<{
        status: string;
        reason?: string;
    }>;
    getGpsLocationLogs(user: string, dateISO: string): Promise<GpsLog[]>;
    checkInVisit(visit: Omit<Visit, 'status' | 'id'>): Promise<Visit>;
    checkOutVisit(visitId: string, description: string, lat?: number, lng?: number): Promise<Visit>;
    getActiveVisit(user: string): Promise<Visit | null>;
    getVisits(user: string, dateISO: string): Promise<Visit[]>;
    getCompanyBranding(companyName: string): Promise<CompanyBranding>;
}
