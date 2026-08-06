import { DEFAULT_ERP_CONFIG, DEFAULT_ERP_HOST } from './types';
import { FrappeAdapter } from './adapters/frappe';
export * from './types';
export * from './adapters/base';
export { FrappeAdapter } from './adapters/frappe';
export { MockAdapter } from './adapters/mock';
export class ErpClientManager {
    static getConfig() {
        if (this.activeConfig) {
            if (!this.activeConfig.host || this.activeConfig.host === 'https://' || this.activeConfig.host.trim() === '') {
                this.activeConfig.host = DEFAULT_ERP_HOST;
            }
            return this.activeConfig;
        }
        // Check if browser localStorage is available
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('erp_connection_config');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed && typeof parsed === 'object') {
                        if (!parsed.host || parsed.host === 'https://' || parsed.host.trim() === '') {
                            parsed.host = DEFAULT_ERP_HOST;
                        }
                        this.activeConfig = parsed;
                        return this.activeConfig;
                    }
                }
                catch {
                    // fallback to default
                }
            }
        }
        return DEFAULT_ERP_CONFIG;
    }
    static setConfig(config) {
        if (!config.host || config.host === 'https://' || config.host.trim() === '') {
            config.host = DEFAULT_ERP_HOST;
        }
        this.activeConfig = config;
        this.instance = null; // Force recreation on next getClient()
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('erp_connection_config', JSON.stringify(config));
        }
    }
    static clearConfig() {
        this.activeConfig = null;
        this.instance = null;
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.removeItem('erp_connection_config');
        }
    }
    static getClient() {
        if (this.instance)
            return this.instance;
        const config = this.getConfig();
        this.instance = new FrappeAdapter(config);
        return this.instance;
    }
}
ErpClientManager.instance = null;
ErpClientManager.activeConfig = null;
