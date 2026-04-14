import { readFileSync } from "fs";
import { resolve } from "path";
import { loadState } from "./state.js";
export function loadConfig() {
    const clientId = requireEnv("ASA_CLIENT_ID");
    const teamId = requireEnv("ASA_TEAM_ID");
    const keyId = requireEnv("ASA_KEY_ID");
    const orgId = process.env.ASA_ORG_ID || loadState().orgId || undefined;
    const inlineKey = process.env.ASA_PRIVATE_KEY;
    const keyPath = process.env.ASA_PRIVATE_KEY_PATH;
    let privateKey;
    if (inlineKey) {
        privateKey = inlineKey.replace(/\\n/g, "\n");
    }
    else if (keyPath) {
        const resolvedPath = resolve(keyPath);
        try {
            privateKey = readFileSync(resolvedPath, "utf-8");
        }
        catch (err) {
            throw new Error(`Failed to read private key at ${resolvedPath}: ${err instanceof Error ? err.message : err}`);
        }
    }
    else {
        throw new Error("Set ASA_PRIVATE_KEY (PEM content) or ASA_PRIVATE_KEY_PATH (file path)");
    }
    return { clientId, teamId, keyId, privateKey, orgId };
}
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
//# sourceMappingURL=config.js.map