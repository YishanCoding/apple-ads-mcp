export interface Config {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    orgId?: string;
}
export declare function loadConfig(): Config;
