async function sendMessage(conversation_id, message, image_ids) {
    console.log('Sending message to Etsy:', message, image_ids);
    const url = `https://www.etsy.com/api/v3/ajax/member/conversations/${conversation_id}`;

    const headers = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://www.etsy.com',
        'referer': `https://www.etsy.com/messages/${conversation_id}`,
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'x-detected-locale': 'GBP|en-GB|GB',
        'x-etsy-protection': '1',
        'x-page-guid': 'fa5e032bf94.3c5ee6c9bfa1b3070215.00',
        'x-csrf-token': await getCsrf()
    };

    let attachments = '{}';
    if (image_ids && Object.keys(image_ids).length > 0) {
        attachments = JSON.stringify(image_ids);
    }

    const body = JSON.stringify({
        message: message,
        attachments: attachments,
        api_context: 'seller_conversations'
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response from Etsy API:', data);
        return data; 
    } catch (error) {
        console.error('Error fetching conversation:', error);
        throw error; 
    }
}

async function upload2Etsy(conversation_id, link) {
    try {
        console.log('Uploading image to Etsy:', link);
        const response = await fetch(link);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append('attachment', blob, 'uploaded_image.png');
        const uploadResponse = await fetch("https://www.etsy.com/api/v3/ajax/member/conversations/attachment-upload", {
            method: 'POST',
            headers: {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "sec-ch-dpr": "1",
                "sec-ch-ua": "\"Chromium\";v=\"118\", \"Google Chrome\";v=\"118\", \"Not=A?Brand\";v=\"99\"",
                "sec-ch-ua-arch": "\"x86\"",
                "sec-ch-ua-bitness": "\"64\"",
                "sec-ch-ua-full-version-list": "\"Chromium\";v=\"118.0.5993.70\", \"Google Chrome\";v=\"118.0.5993.70\", \"Not=A?Brand\";v=\"99.0.0.0\"",
                "sec-ch-ua-mobile": "?0",
                "x-etsy-protection": 1,
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-ch-ua-platform-version": "\"17.0.0\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-csrf-token": await getCsrf(conversation_id),
                "x-detected-locale": "USD|en-US|US",
                "x-page-guid": "fa6737e984a.12e30d359446c9c2564b.00"
            },
            body: formData,
            credentials: 'include',
        });

        const result = await uploadResponse.json();
        console.log('image_id:', result.image_id);
        return result.image_id; // Return the image_id
    } catch (error) {
        console.error('Error uploading image to Etsy:', error);
        throw error;
    }
}


async function getShopInfo() {
    try {
        // Check localStorage cache first
        const cachedData = localStorage.getItem('etsy_credentials');
        if (cachedData) {
            const { csrfToken, shopId, timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            // Check if cache is still valid (within 5 minutes)
            if (now - timestamp < 5 * 60 * 1000) {
                console.log('Using cached credentials');
                return { csrfToken, shopId };
            }
        }

        const response = await fetch("https://www.etsy.com/messages?ref=seller-platform-mcnav", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "vi-VN,vi;q=0.9",
                "cache-control": "max-age=0",
                "downlink": "5",
                "dpr": "1",
                "ect": "4g",
                "rtt": "50",
                "sec-ch-dpr": "1",
                "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
                "sec-ch-ua-arch": "\"x86\"",
                "sec-ch-ua-bitness": "\"64\"",
                "sec-ch-ua-full-version-list": "\"Chromium\";v=\"116.0.5845.140\", \"Not)A;Brand\";v=\"24.0.0.0\", \"Google Chrome\";v=\"116.0.5845.140\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-ch-ua-platform-version": "\"12.0.0\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "Referer": "https://www.etsy.com/",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": null,
            "method": "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        // Get CSRF token
        const metaTag = doc.querySelector('meta[name="csrf_nonce"]');
        const csrfToken = metaTag ? metaTag.getAttribute('content') : null;
        
        // Get shop ID directly from response text
        let shopId = null;
        const shopIdMatch = text.match(/"shop_id":(\d+)/);
        if (shopIdMatch && shopIdMatch[1]) {
            shopId = parseInt(shopIdMatch[1]);
        }

        console.log('CSRF Token:', csrfToken);
        console.log('Shop ID:', shopId);
        
        // Cache the values with current timestamp
        const cacheData = {
            csrfToken: csrfToken,
            shopId: shopId,
            timestamp: Date.now()
        };
        localStorage.setItem('etsy_credentials', JSON.stringify(cacheData));
        
        return {
            csrfToken: csrfToken,
            shopId: shopId
        };
    } catch (error) {
        console.error('Error fetching shop info:', error);
        return null;
    }
}

// Function to get only CSRF token
async function getCsrf() {
    const shopInfo = await getShopInfo();
    return shopInfo ? shopInfo.csrfToken : null;
}

// Function to get only Shop ID
async function getShopId() {
    const shopInfo = await getShopInfo();
    return shopInfo ? shopInfo.shopId : null;
}
