import { FrappeAdapter } from './adapters/frappe';
import { MockAdapter } from './adapters/mock';
export * from './types';
export * from './adapters/base';
export { FrappeAdapter } from './adapters/frappe';
export { MockAdapter } from './adapters/mock';
export class ErpClientManager {
    static getConfig() {
        if (this.activeConfig)
            return this.activeConfig;
        // Check if browser localStorage is available
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('erp_connection_config');
            if (stored) {
                try {
                    this.activeConfig = JSON.parse(stored);
                    return this.activeConfig;
                }
                catch {
                    return null;
                }
            }
        }
        return null;
    }
    static setConfig(config) {
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
        if (!config || config.mode === 'mock') {
            this.instance = new MockAdapter();
        }
        else {
            this.instance = new FrappeAdapter(config);
        }
        return this.instance;
    }
}
ErpClientManager.instance = null;
ErpClientManager.activeConfig = null;
