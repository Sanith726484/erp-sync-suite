export interface ErpConnectionConfig {
    host: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiSecret?: string;
    mode: 'frappe' | 'mock';
    gpsInterval?: number;
}
export interface Customer {
    id: string;
    name: string;
    mobile?: string;
    email?: string;
}
export interface Product {
    id: string;
    name: string;
    rate: number;
    description?: string;
}
export interface OrderItem {
    itemCode: string;
    itemName: string;
    qty: number;
    rate: number;
    amount: number;
}
export interface Order {
    id?: string;
    customer: string;
    customerName?: string;
    transactionDate: string;
    items: OrderItem[];
    grandTotal: number;
    status?: string;
    currency?: string;
    baseCurrency?: string;
    baseGrandTotal?: number;
}
export interface GpsLog {
    id?: string;
    user: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    distanceFromPrevious?: number | string;
}
export interface Visit {
    id?: string;
    customer: string;
    visitType: string;
    date: string;
    time: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    status: 'Checked In' | 'Checked Out';
}
export interface CompanyBranding {
    companyName: string;
    logoUrl?: string;
    appIconUrl?: string;
    splashScreenUrl?: string;
    defaultCurrency?: string;
}
