import { ErpAdapter } from './base';
import { Customer, Product, Order, GpsLog, Visit, ErpConnectionConfig, UserProfile } from '../types';
export declare class FrappeAdapter implements ErpAdapter {
    private client;
    private config;
    constructor(config: ErpConnectionConfig);
    testConnection(): Promise<boolean>;
    getLoggedUser(): Promise<string>;
    getUserProfile(username: string): Promise<UserProfile>;
    login(username: string, password?: string): Promise<{
        token: string;
        username: string;
    }>;
    getCustomers(): Promise<Customer[]>;
    getProducts(): Promise<Product[]>;
    getBranches(): Promise<string[]>;
    getStates(): Promise<string[]>;
    getOrders(user?: string): Promise<Order[]>;
    getDocTypeMeta(doctype: string): Promise<any>;
    createOrder(order: Order): Promise<Order>;
    saveGpsLocation(lat: number, lng: number, user: string): Promise<{
        status: string;
        reason?: string;
    }>;
    getGpsLocationLogs(user: string, dateISO: string): Promise<GpsLog[]>;
    checkInVisit(visit: Omit<Visit, 'status' | 'id'>): Promise<Visit>;
    checkOutVisit(visitId: string, description: string, lat?: number, lng?: number): Promise<Visit>;
    getActiveVisit(username: string): Promise<Visit | null>;
    getVisits(username: string, dateISO?: string): Promise<Visit[]>;
    return: any;
    []: any;
}
