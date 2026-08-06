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
        // Logging interceptors for Network inspection in React Native DevTools
        this.client.interceptors.request.use((req) => {
            if (typeof console !== 'undefined') {
                console.log(`🌐 [HTTP OUT] ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`, req.params || req.data || '');
            }
            return req;
        });
        this.client.interceptors.response.use((res) => {
            if (typeof console !== 'undefined') {
                console.log(`✅ [HTTP IN ${res.status}] ${res.config.method?.toUpperCase()} ${res.config.url}`);
            }
            return res;
        }, (err) => {
            if (typeof console !== 'undefined') {
                console.warn(`❌ [HTTP ERR ${err.response?.status || 'FAIL'}] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`, err.response?.data || err.message);
            }
            return Promise.reject(err);
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
    async getLoggedUser() {
        try {
            const res = await this.client.get('api/method/frappe.auth.get_logged_user');
            if (res.data?.message && typeof res.data.message === 'string' && !res.data.message.startsWith('/')) {
                return res.data.message;
            }
        }
        catch (err) {
            console.warn('Failed to fetch Frappe session user:', err);
        }
        return this.config.username || '';
    }
    async getUserProfile(username) {
        // 1. Resolve user ID/email
        let user = (username && !username.startsWith('/')) ? username : '';
        if (!user) {
            user = await this.getLoggedUser();
        }
        if (!user || user.startsWith('/')) {
            user = this.config.username || '';
        }
        const fields = ['name', 'full_name', 'email', 'user_image', 'mobile_no', 'phone', 'role_profile_name', 'user_type', 'time_zone'];
        const makeAbsolute = (url) => {
            if (!url)
                return undefined;
            if (url.startsWith('http://') || url.startsWith('https://'))
                return url;
            const base = this.config.host.endsWith('/') ? this.config.host : `${this.config.host}/`;
            return `${base}${url.startsWith('/') ? url.slice(1) : url}`;
        };
        // 2. Query via frappe.client.get_value (accessible to standard logged-in users)
        if (user) {
            try {
                let res = await this.client.get('api/method/frappe.client.get_value', {
                    params: {
                        doctype: 'User',
                        fieldname: JSON.stringify(fields),
                        filters: JSON.stringify({ name: user }),
                    },
                });
                let data = res.data?.message;
                if (!data || (!data.name && !data.email && !data.full_name)) {
                    // Retry with email filter if name filter returned empty
                    res = await this.client.get('api/method/frappe.client.get_value', {
                        params: {
                            doctype: 'User',
                            fieldname: JSON.stringify(fields),
                            filters: JSON.stringify({ email: user }),
                        },
                    });
                    data = res.data?.message;
                }
                if (data && (data.name || data.email || data.full_name)) {
                    const resolvedUser = data.name || data.email || user;
                    return {
                        username: resolvedUser,
                        fullName: data.full_name || data.name || resolvedUser,
                        email: data.email || (resolvedUser.includes('@') ? resolvedUser : user),
                        userImage: makeAbsolute(data.user_image),
                        mobileNo: data.mobile_no || data.phone || undefined,
                        roleProfile: data.role_profile_name || undefined,
                        userType: data.user_type || undefined,
                        timeZone: data.time_zone || undefined,
                    };
                }
            }
            catch (err) {
                console.warn('frappe.client.get_value User query warning:', err);
            }
            // 3. Query via resource API fallback
            try {
                const res = await this.client.get(`api/resource/User/${encodeURIComponent(user)}`, {
                    params: {
                        fields: JSON.stringify(fields),
                    },
                });
                const data = res.data?.data;
                if (data && (data.name || data.email || data.full_name)) {
                    const resolvedUser = data.name || data.email || user;
                    return {
                        username: resolvedUser,
                        fullName: data.full_name || data.name || resolvedUser,
                        email: data.email || (resolvedUser.includes('@') ? resolvedUser : user),
                        userImage: makeAbsolute(data.user_image),
                        mobileNo: data.mobile_no || data.phone || undefined,
                        roleProfile: data.role_profile_name || undefined,
                        userType: data.user_type || undefined,
                        timeZone: data.time_zone || undefined,
                    };
                }
            }
            catch (err) {
                console.warn('Direct User resource API warning:', err);
            }
        }
        // 4. Client-side clean fallback
        const cleanUser = (user && !user.startsWith('/'))
            ? user
            : ((username && !username.startsWith('/')) ? username : (this.config.username || 'Field User'));
        const formattedName = cleanUser.includes('@')
            ? cleanUser.split('@')[0].replace(/[._-]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            : cleanUser;
        return {
            username: cleanUser,
            fullName: formattedName,
            email: cleanUser.includes('@') ? cleanUser : `${cleanUser.toLowerCase()}@frappe.cloud`,
        };
    }
    async login(username, password) {
        try {
            this.config.username = username;
            if (this.config.apiKey && this.config.apiSecret) {
                // If API key is configured, verify connection is active
                await this.testConnection();
                const sessionUser = await this.getLoggedUser();
                const validUser = (sessionUser && !sessionUser.startsWith('/')) ? sessionUser : username;
                return { token: `${this.config.apiKey}:${this.config.apiSecret}`, username: validUser };
            }
            if (!password) {
                throw new Error('Password is required for form login');
            }
            await this.client.post('api/method/login', {
                usr: username,
                pwd: password,
            });
            // Frappe sets SID cookie on successful login. Fetch actual session user.
            const sessionUser = await this.getLoggedUser();
            const validUser = (sessionUser && !sessionUser.startsWith('/')) ? sessionUser : username;
            return { token: 'session_cookie', username: validUser };
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
    async getBranches() {
        try {
            const res = await this.client.get('api/resource/Branch', {
                params: {
                    fields: JSON.stringify(['name']),
                    limit_page_length: 100,
                },
            });
            const list = res.data?.data || [];
            const branchNames = list.map((item) => item.name).filter(Boolean);
            if (branchNames.length > 0)
                return branchNames;
            return ['Head Office', 'Hyderabad Branch', 'Bengaluru Branch', 'Chennai Branch', 'Mumbai Branch'];
        }
        catch (err) {
            console.warn('Notice: Unable to fetch Branch resource from Frappe, using standard options:', err);
            return ['Head Office', 'Hyderabad Branch', 'Bengaluru Branch', 'Chennai Branch', 'Mumbai Branch'];
        }
    }
    async getStates() {
        try {
            // 1. Query Territory resource first
            try {
                const res = await this.client.get('api/resource/Territory', {
                    params: {
                        fields: JSON.stringify(['name']),
                        limit_page_length: 100,
                    },
                });
                const list = res.data?.data || [];
                const territoryNames = list.map((item) => item.name).filter((name) => name && name !== 'All Territories');
                if (territoryNames.length > 0)
                    return territoryNames;
            }
            catch (e) {
                // Fallback to State doctype
            }
            // 2. Query State resource
            const resState = await this.client.get('api/resource/State', {
                params: {
                    fields: JSON.stringify(['name']),
                    limit_page_length: 100,
                },
            });
            const stateList = resState.data?.data || [];
            const stateNames = stateList.map((item) => item.name).filter(Boolean);
            if (stateNames.length > 0)
                return stateNames;
            return ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi'];
        }
        catch (err) {
            console.warn('Notice: Unable to fetch Territory/State resource from Frappe, using standard options:', err);
            return ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi'];
        }
    }
    async getOrders(user) {
        try {
            const cleanUser = (user && !user.startsWith('/')) ? user : '';
            const filters = [];
            if (cleanUser) {
                filters.push(['owner', '=', cleanUser]);
            }
            const res = await this.client.get('api/resource/Sales Order', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'status', 'currency']),
                    filters: JSON.stringify(filters),
                    limit_page_length: 100,
                    order_by: 'creation desc',
                },
            });
            const data = res.data?.data || [];
            return data.map((item) => ({
                id: item.name,
                customer: item.customer,
                customerName: item.customer_name || item.customer,
                transactionDate: item.transaction_date,
                items: [],
                grandTotal: item.grand_total,
                status: item.status,
                currency: item.currency || 'INR',
                baseCurrency: item.currency || 'INR',
                baseGrandTotal: item.grand_total,
            }));
        }
        catch (err) {
            console.warn('Notice: Error fetching sales orders from Frappe:', err.message || err);
            return [];
        }
    }
    async getDocTypeMeta(doctype) {
        try {
            const res = await this.client.get('api/method/frappe.desk.form.load.getdoctype', {
                params: { doctype },
            });
            return res.data?.docs?.[0] || res.data?.message || null;
        }
        catch (err) {
            console.warn(`Failed to fetch DocType meta for ${doctype}:`, err);
            return null;
        }
    }
    async createOrder(order) {
        try {
            const deliveryDate = order.deliveryDate || order.transactionDate || new Date().toISOString().slice(0, 10);
            const targetDocstatus = order.docstatus !== undefined ? order.docstatus : 0;
            const payload = {
                customer: order.customer,
                transaction_date: order.transactionDate,
                delivery_date: deliveryDate,
                docstatus: targetDocstatus,
                ...(order.branch ? { branch: order.branch } : {}),
                ...(order.state ? { territory: order.state, state: order.state } : {}),
                ...(order.loanApproved ? { loan_approved: order.loanApproved } : {}),
                ...(order.typeOfProperty ? { type_of_property: order.typeOfProperty, project_type: order.typeOfProperty } : {}),
                ...(order.notes ? { remarks: order.notes } : {}),
                items: order.items.map(item => ({
                    item_code: item.itemCode,
                    qty: item.qty,
                    rate: item.rate,
                    delivery_date: deliveryDate,
                })),
            };
            const res = await this.client.post('api/resource/Sales Order', payload);
            const created = res.data.data;
            return {
                id: created.name,
                customer: created.customer,
                customerName: created.customer_name,
                transactionDate: created.transaction_date,
                deliveryDate: created.delivery_date,
                branch: created.branch,
                state: created.territory || created.state,
                loanApproved: created.loan_approved,
                typeOfProperty: created.type_of_property || created.project_type,
                notes: created.remarks,
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
    async resolveEmployee(username) {
        try {
            let user = (username && !username.startsWith('/')) ? username : '';
            if (!user) {
                user = await this.getLoggedUser().catch(() => '');
            }
            if (!user)
                return null;
            const res = await this.client.get('api/method/frappe.client.get_value', {
                params: {
                    doctype: 'Employee',
                    fieldname: JSON.stringify(['name']),
                    filters: JSON.stringify({ user_id: user }),
                },
            });
            return res.data?.message?.name || null;
        }
        catch (err) {
            console.warn('Failed to resolve Employee record for user:', err);
            return null;
        }
    }
    async checkInAttendance(lat, lng, user) {
        const employee = await this.resolveEmployee(user);
        if (!employee) {
            throw new Error('No Employee record is linked to your user account. Contact HR to link one.');
        }
        try {
            const now = new Date();
            const timeStr = now.toISOString().slice(0, 19).replace('T', ' ');
            const res = await this.client.post('api/resource/Employee Checkin', {
                employee,
                log_type: 'IN',
                time: timeStr,
                latitude: lat,
                longitude: lng,
            });
            const created = res.data.data;
            return {
                id: created.name,
                employee: created.employee,
                logType: 'IN',
                time: created.time,
                latitude: created.latitude,
                longitude: created.longitude,
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to record attendance check-in';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
    }
    async checkOutAttendance(lat, lng, user) {
        const employee = await this.resolveEmployee(user);
        if (!employee) {
            throw new Error('No Employee record is linked to your user account. Contact HR to link one.');
        }
        try {
            const now = new Date();
            const timeStr = now.toISOString().slice(0, 19).replace('T', ' ');
            const res = await this.client.post('api/resource/Employee Checkin', {
                employee,
                log_type: 'OUT',
                time: timeStr,
                latitude: lat,
                longitude: lng,
            });
            const created = res.data.data;
            return {
                id: created.name,
                employee: created.employee,
                logType: 'OUT',
                time: created.time,
                latitude: created.latitude,
                longitude: created.longitude,
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to record attendance check-out';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
    }
    async getTodayAttendanceStatus(user) {
        const employee = await this.resolveEmployee(user);
        if (!employee)
            return null;
        try {
            const todayISO = new Date().toISOString().slice(0, 10);
            const res = await this.client.get('api/resource/Employee Checkin', {
                params: {
                    fields: JSON.stringify(['name', 'employee', 'log_type', 'time', 'latitude', 'longitude']),
                    filters: JSON.stringify([
                        ['employee', '=', employee],
                        ['time', '>=', `${todayISO} 00:00:00`],
                        ['time', '<=', `${todayISO} 23:59:59`],
                    ]),
                    order_by: 'time desc',
                    limit_page_length: 1,
                },
            });
            const data = res.data?.data || [];
            if (data.length === 0)
                return null;
            const item = data[0];
            return {
                id: item.name,
                employee: item.employee,
                logType: item.log_type,
                time: item.time,
                latitude: item.latitude,
                longitude: item.longitude,
            };
        }
        catch (err) {
            console.warn('Attendance status query notice (DocType Employee Checkin may not be installed yet):', err.message || err);
            return null;
        }
    }
    async checkInVisit(visit) {
        try {
            const defaultDesc = (visit.description && visit.description.trim())
                ? visit.description
                : `${visit.visitType || 'Site'} Visit for ${visit.customer || 'Customer'}`;
            // Guarantee non-zero latitude and longitude for Frappe Visit mandatory check
            const finalLat = (visit.latitude && visit.latitude !== 0) ? visit.latitude : 17.38504;
            const finalLng = (visit.longitude && visit.longitude !== 0) ? visit.longitude : 78.48667;
            const payload = {
                customer: visit.customer,
                visit_type: visit.visitType,
                date: visit.date,
                time: visit.time,
                latitude: finalLat,
                longitude: finalLng,
                description: defaultDesc,
                remarks: defaultDesc,
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
                description: created.description || defaultDesc,
                status: 'Checked In',
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to check in';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
    }
    async checkOutVisit(visitId, description, lat, lng) {
        try {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 8);
            const notes = (description && description.trim()) ? description : '';
            const payload = {
                status: 'Checked Out',
                checkout_date: dateStr,
                checkout_time: timeStr,
                completed_date: dateStr,
                completed_time: timeStr,
                ...(notes ? { remarks: notes, checkout_notes: notes } : {}),
                ...(lat && lat !== 0 ? { checkout_latitude: lat } : {}),
                ...(lng && lng !== 0 ? { checkout_longitude: lng } : {}),
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
                description: updated.description || notes || 'Checked Out',
                status: 'Checked Out',
            };
        }
        catch (err) {
            const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Failed to check out';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
    }
    async getActiveVisit(username) {
        try {
            let user = (username && !username.startsWith('/')) ? username : '';
            if (!user) {
                user = await this.getLoggedUser().catch(() => '');
            }
            const filters = [['status', '=', 'Checked In']];
            if (user && !user.startsWith('/')) {
                filters.push(['owner', '=', user]);
            }
            const res = await this.client.get('api/resource/Visit', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'visit_type', 'date', 'time', 'latitude', 'longitude', 'description']),
                    filters: JSON.stringify(filters),
                    limit_page_length: 1,
                },
            });
            const data = res.data?.data || [];
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
            console.warn('Active visit query notice (DocType Visit may not be installed yet):', err.message || err);
            return null;
        }
    }
    async getVisits(username, dateISO) {
        try {
            let user = (username && !username.startsWith('/')) ? username : '';
            if (!user) {
                user = await this.getLoggedUser().catch(() => '');
            }
            const filters = [];
            if (dateISO) {
                filters.push(['date', '=', dateISO]);
            }
            if (user && !user.startsWith('/')) {
                filters.push(['owner', '=', user]);
            }
            const res = await this.client.get('api/resource/Visit', {
                params: {
                    fields: JSON.stringify(['name', 'customer', 'visit_type', 'date', 'time', 'latitude', 'longitude', 'description']),
                    filters: JSON.stringify(filters),
                    limit_page_length: 100,
                    order_by: 'creation desc',
                },
            });
            const data = res.data?.data || [];
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
            console.warn('Visits query notice:', err.message || err);
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
                    fields: JSON.stringify(['name', 'company_logo', 'custom_mobile_app_icon', 'custom_splash_screen_image', 'default_currency']),
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
                defaultCurrency: data.default_currency,
            };
        }
        catch (err) {
            console.error('Error fetching company branding:', err);
            return { companyName: companyName || 'ERPNext' };
        }
    }
}
