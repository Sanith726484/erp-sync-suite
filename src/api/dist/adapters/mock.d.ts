import { ErpAdapter } from './base';
import { Customer, Product, Order, GpsLog, Visit, CompanyBranding, UserProfile, AttendanceLog } from '../types';
export declare class MockAdapter implements ErpAdapter {
    private getStorageItem;
    private setStorageItem;
    private calculateDistance;
    private currentUsername;
    testConnection(): Promise<boolean>;
    login(username: string, _password?: string): Promise<{
        token: string;
        username: string;
    }>;
    getLoggedUser(): Promise<string>;
    getUserProfile(username: string): Promise<UserProfile>;
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
    checkInAttendance(lat: number, lng: number, user: string): Promise<AttendanceLog>;
    checkOutAttendance(lat: number, lng: number, user: string): Promise<AttendanceLog>;
    getTodayAttendanceStatus(user: string): Promise<AttendanceLog | null>;
    getCompanyBranding(companyName?: string): Promise<CompanyBranding>;
    getDocTypeMeta(doctype: string): Promise<any>;
    getBranches(): Promise<string[]>;
    getStates(): Promise<string[]>;
}
