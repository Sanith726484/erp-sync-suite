import { ErpConnectionConfig } from './types';
import { ErpAdapter } from './adapters/base';
export * from './types';
export * from './adapters/base';
export { FrappeAdapter } from './adapters/frappe';
export { MockAdapter } from './adapters/mock';
export declare class ErpClientManager {
    private static instance;
    private static activeConfig;
    static getConfig(): ErpConnectionConfig;
    static setConfig(config: ErpConnectionConfig): void;
    static clearConfig(): void;
    static getClient(): ErpAdapter;
}
