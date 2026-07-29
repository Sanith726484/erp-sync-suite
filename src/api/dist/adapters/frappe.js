import axios from 'axios';
export class FrappeAdapter {
    constructor(config) {
        this.config = config;
        // Ensure trailing slash is handled
        const baseURL = config.host.endsWith('/') ? config.host : `${config.host}/`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (config.apiKey && config.apiSecret) {
            headers['Authorization'] = `token ${config.apiKey}:${config.apiSecret}`;
        }
        this.client = axios.create({
            baseURL,
            headers,
            withCredentials: true, // Needed if session cookies are used
        });
    }
    async testConnection() {
        try {
            // Fetch user info to test access
            const res = await this.client.get('api/method/frappe.auth.get_logged_user');
            return !!res.data.message;
        }
        catch (err) {
            console.error('Frappe test connection failed:', err);
            return false;
        }
    }
    async login(username, password) {
        try {
            if (this.config.apiKey && this.config.apiSecret) {
                // If API key is configured, verify connection is active
                await this.testConnection();
                return { token: `${this.config.apiKey}:${this.config.apiSecret}`, username };
            }
            if (!password) {
                throw new Error('Password is required for form login');
            }
            const res = await this.client.post('api/method/login', {
                usr: username,
                pwd: password,
            });
            // Frappe sets SID cookie on successful login
            const loggedUser = res.data.home_page || res.data.message || username;
            return { token: 'session_cookie', username: loggedUser };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Login failed';
            throw new Error(errMsg);
        }
    }
    async getCustomers() {
        try {
            const res = await this.client.get('api/resource/Customer', {
                params: {
                    fields: JSON.stringify(['name', 'customer_name', 'mobile_no', 'email_id']),
                    limit_page_length: 500,
                },
            });
            const data = res.data.data || [];
            return data.map((item) => ({
                id: item.name,
                name: item.customer_name || item.name,
                mobile: item.mobile_no || undefined,
                email: item.email_id || undefined,
            }));
        }
        catch (err) {
            console.error('Error fetching customers:', err);
            return [];
        }
    }
    async getProducts() {
        try {
            const res = await this.client.get('api/resource/Item', {
                params: {
                    fields: JSON.stringify(['name', 'item_name', 'standard_rate', 'description']),
                    filters: JSON.stringify([['disabled', '=', 0], ['is_sales_item', '=', 1]]),
                    limit_page_length: 500,
                },
            });
            const data = res.data.data || [];
            return data.map((item) => ({
                id: item.name,
                name: item.item_name || item.name,
                rate: item.standard_rate || 0.0,
                description: item.description || undefined,
            }));
        }
        catch (err) {
            console.error('Error fetching products:', err);
            return [];
        }
    }
    async getOrders(user) {
        try {
            const filters = [];
            if (user) {
                filters.push(['owner', '=', user]);
            }
            const res = await this.client.get('api/resource/Sales Order', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'status']),
                    filters: JSON.stringify(filters),
                    limit_page_length: 100,
                    order_by: 'creation desc',
                },
            });
            const data = res.data.data || [];
            return data.map((item) => ({
                id: item.name,
                customer: item.customer,
                customerName: item.customer_name,
                transactionDate: item.transaction_date,
                items: [], // Standard API list doesn't include child items to save bandwidth
                grandTotal: item.grand_total,
                status: item.status,
            }));
        }
        catch (err) {
            console.error('Error fetching orders:', err);
            return [];
        }
    }
    async createOrder(order) {
        try {
            const payload = {
                customer: order.customer,
                transaction_date: order.transactionDate,
                items: order.items.map(item => ({
                    item_code: item.itemCode,
                    qty: item.qty,
                    rate: item.rate,
                })),
            };
            const res = await this.client.post('api/resource/Sales Order', payload);
            const created = res.data.data;
            return {
                id: created.name,
                customer: created.customer,
                customerName: created.customer_name,
                transactionDate: created.transaction_date,
                items: (created.items || []).map((item) => ({
                    itemCode: item.item_code,
                    itemName: item.item_name,
                    qty: item.qty,
                    rate: item.rate,
                    amount: item.amount,
                })),
                grandTotal: created.grand_total,
                status: created.status,
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to create sales order';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
    }
    async saveGpsLocation(lat, lng, user) {
        try {
            // 1. Try to invoke custom API method first
            try {
                const res = await this.client.post('api/method/erpnext_mobile.api.gps_tracking.save_gps_location', {
                    latitude: lat,
                    longitude: lng,
                });
                if (res.data && res.data.message) {
                    return {
                        status: res.data.message.status || 'success',
                        reason: res.data.message.reason,
                    };
                }
            }
            catch (methodErr) {
                // Fallback to directly inserting GPS Location Log resource
            }
            // 2. Resource API direct insertion
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const res = await this.client.post('api/resource/GPS Location Log', {
                user,
                latitude: lat,
                longitude: lng,
                timestamp,
            });
            return { status: res.data.data ? 'success' : 'failed' };
        }
        catch (err) {
            console.error('Error saving GPS location:', err);
            return { status: 'failed', reason: err.message };
        }
    }
    async getGpsLocationLogs(user, dateISO) {
        try {
            const start = `${dateISO} 00:00:00`;
            const end = `${dateISO} 23:59:59`;
            const res = await this.client.get('api/resource/GPS Location Log', {
                params: {
                    fields: JSON.stringify(['name', 'user', 'latitude', 'longitude', 'timestamp', 'distance_from_previous']),
                    filters: JSON.stringify([
                        ['user', '=', user],
                        ['timestamp', '>=', start],
                        ['timestamp', '<=', end],
                    ]),
                    limit_page_length: 500,
                    order_by: 'timestamp asc',
                },
            });
            const data = res.data.data || [];
            return data.map((item) => ({
                id: item.name,
                user: item.user,
                latitude: item.latitude,
                longitude: item.longitude,
                timestamp: item.timestamp,
                distanceFromPrevious: item.distance_from_previous,
            }));
        }
        catch (err) {
            console.error('Error fetching GPS logs:', err);
            return [];
        }
    }
    async checkInVisit(visit) {
        try {
            const payload = {
                customer: visit.customer,
                visit_type: visit.visitType,
                date: visit.date,
                time: visit.time,
                latitude: visit.latitude,
                longitude: visit.longitude,
                description: visit.description || '',
                status: 'Checked In',
            };
            const res = await this.client.post('api/resource/Visit', payload);
            const created = res.data.data;
            return {
                id: created.name,
                customer: created.customer,
                visitType: created.visit_type,
                date: created.date,
                time: created.time,
                latitude: created.latitude,
                longitude: created.longitude,
                description: created.description,
                status: 'Checked In',
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to check in';
            throw new Error(errMsg);
        }
    }
    async checkOutVisit(visitId, description, lat, lng) {
        try {
            const payload = {
                status: 'Checked Out',
                description: description,
                ...(lat !== undefined ? { checkout_latitude: lat } : {}),
                ...(lng !== undefined ? { checkout_longitude: lng } : {}),
            };
            const res = await this.client.put(`api/resource/Visit/${encodeURIComponent(visitId)}`, payload);
            const updated = res.data.data;
            return {
                id: updated.name,
                customer: updated.customer,
                visitType: updated.visit_type,
                date: updated.date,
                time: updated.time,
                latitude: updated.latitude,
                longitude: updated.longitude,
                description: updated.description,
                status: 'Checked Out',
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Failed to check out';
            throw new Error(errMsg);
        }
    }
    async getActiveVisit(user) {
        try {
            const res = await this.client.get('api/resource/Visit', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'visit_type', 'date', 'time', 'latitude', 'longitude', 'description', 'status']),
                    filters: JSON.stringify([
                        ['owner', '=', user],
                        ['status', '=', 'Checked In'],
                    ]),
                    limit_page_length: 1,
                },
            });
            const data = res.data.data || [];
            if (data.length === 0)
                return null;
            const item = data[0];
            return {
                id: item.name,
                customer: item.customer,
                visitType: item.visit_type,
                date: item.date,
                time: item.time,
                latitude: item.latitude,
                longitude: item.longitude,
                description: item.description,
                status: 'Checked In',
            };
        }
        catch (err) {
            console.error('Error fetching active visit:', err);
            return null;
        }
    }
    async getVisits(user, dateISO) {
        try {
            const res = await this.client.get('api/resource/Visit', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'visit_type', 'date', 'time', 'latitude', 'longitude', 'description', 'status']),
                    filters: JSON.stringify([
                        ['owner', '=', user],
                        ['date', '=', dateISO],
                    ]),
                    limit_page_length: 100,
                    order_by: 'time asc',
                },
            });
            const data = res.data.data || [];
            return data.map((item) => ({
                id: item.name,
                customer: item.customer,
                visitType: item.visit_type,
                date: item.date,
                time: item.time,
                latitude: item.latitude,
                longitude: item.longitude,
                description: item.description,
                status: item.status,
            }));
        }
        catch (err) {
            console.error('Error fetching visits:', err);
            return [];
        }
    }
    async getCompanyBranding(companyName) {
        try {
            let targetCompany = companyName;
            if (!targetCompany) {
                const listRes = await this.client.get('api/resource/Company', {
                    params: { limit_page_length: 1 }
                });
                const companies = listRes.data.data || [];
                if (companies.length > 0) {
                    targetCompany = companies[0].name;
                }
            }
            if (!targetCompany) {
                return { companyName: 'ERPNext' };
            }
            const res = await this.client.get(`api/resource/Company/${encodeURIComponent(targetCompany)}`, {
                params: {
                    fields: JSON.stringify(['name', 'company_logo', 'custom_mobile_app_icon', 'custom_splash_screen_image']),
                }
            });
            const data = res.data.data || {};
            const makeAbsolute = (url) => {
                if (!url)
                    return undefined;
                if (url.startsWith('http://') || url.startsWith('https://'))
                    return url;
                const base = this.config.host.endsWith('/') ? this.config.host : `${this.config.host}/`;
                return `${base}${url.startsWith('/') ? url.slice(1) : url}`;
            };
            return {
                companyName: data.name || targetCompany,
                logoUrl: makeAbsolute(data.company_logo),
                appIconUrl: makeAbsolute(data.custom_mobile_app_icon),
                splashScreenUrl: makeAbsolute(data.custom_splash_screen_image),
            };
        }
        catch (err) {
            console.error('Error fetching company branding:', err);
            return { companyName: companyName || 'ERPNext' };
        }
    }
}
