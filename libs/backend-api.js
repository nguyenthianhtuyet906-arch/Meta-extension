let env;

(async () => {
    const response = await fetch(chrome.runtime.getURL('../configs/env.json'));
    env = await response.json();
})();

const callBackend = async (method, url, data) => {
    try {
        // Combine URL with backend endpoint
        url = env.BACKEND_ENDPOINT + url;

        let params = {
            method: method,
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (method === 'POST') {
            params.body = JSON.stringify(data);
        }

        const response = await fetch(url, params);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log(`Response from ${url}`, responseData);
        return responseData;
    } catch (error) {
        console.error('Error sending messages to server:', error);
        return null;
    }
};

const callMeraAdmin = async (method, url, data) => {
    if (!env || !env.MERA_ADMIN_ENDPOINT) return null;
    try {
        const fullUrl = env.MERA_ADMIN_ENDPOINT + url;
        let params = {
            method: method,
            headers: { "Content-Type": "application/json" }
        };
        if (method === 'POST' && data) {
            params.body = JSON.stringify(data);
        }
        const response = await fetch(fullUrl, params);
        if (!response.ok) {
            console.warn(`[MERA ADMIN] HTTP ${response.status} from ${fullUrl}`);
            return null;
        }
        const responseData = await response.json();
        console.log(`[MERA ADMIN] Response from ${fullUrl}`, responseData);
        return responseData;
    } catch (error) {
        console.error('[MERA ADMIN] Error:', error.message);
        return null;
    }
};

const sendMeraHeartbeat = async (etsyShopId, etsyShopName) => {
    if (!env || !env.MERA_ADMIN_ENDPOINT) return null;
    try {
        const url = env.MERA_ADMIN_ENDPOINT + '/v1/extension/heartbeat';
        const response = await fetch(url, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                etsy_shop_id: String(etsyShopId || ''),
                etsy_shop_name: String(etsyShopName || '')
            })
        });
        if (!response.ok) {
            console.warn(`[MERA HEARTBEAT] HTTP ${response.status}`);
            return null;
        }
        const data = await response.json();
        console.log('[MERA HEARTBEAT] OK', data);
        return data;
    } catch (error) {
        console.warn('[MERA HEARTBEAT] Failed:', error.message);
        return null;
    }
};

if (typeof window !== 'undefined') {
    window.callMeraAdmin = callMeraAdmin;
    window.sendMeraHeartbeat = sendMeraHeartbeat;
}