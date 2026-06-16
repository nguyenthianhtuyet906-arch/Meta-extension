const fetchConversationList = async (page, tag = 'system_tag.inbox') => {  
    try {
        let url = `https://www.etsy.com/api/v3/ajax/bespoke/member/conversations/message-list-data?tag=${tag}&is_search=false&search_query=&page=${page}`; 
        
        let referer;                                      
        if (tag === 'system_tag.unread') {                  
            referer = `https://www.etsy.com/messages/unread?ref=seller-platform-mcnav&page=${page}`;  
        } else {                                           
            referer = `https://www.etsy.com/messages?ref=seller-platform-mcnav&page=${page}`;      
        }                                               
        
        const response = await fetch(url, {
            headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                Referer: referer,                           
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Detail data received for conversation list page ${page} (${tag}):`, data);  

        return data;
    } catch (error) {
        console.error(`Error fetching conversation list page ${page} (${tag}):`, error);  
        return null;
    }
};

const fetchOrderList = async (shopId, page) => {
    const pageSize = 20;
    try {
        let url = `https://www.etsy.com/api/v3/ajax/bespoke/shop/${shopId}/mission-control/orders?filters[buyer_id]=all&filters[channel]=all&filters[destination]=all&filters[ship_date]=all&filters[shipping_label_eligibility]=false&filters[shipping_label_status]=all&filters[has_buyer_notes]=false&filters[is_marked_as_gift]=false&filters[is_personalized]=false&filters[has_shipping_upgrade]=false&limit=${pageSize}&offset=${(page-1)*pageSize}&search_terms=&sort_by=ship_date&sort_order=desc&objects_enabled_for_normalization[order_state]=true`;
        const response = await fetch(url, {
            headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referer": `https://www.etsy.com/your/orders/sold/completed?ref=seller-platform-mcnav&page=${page}`,
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Detail data received for order list page ${page}:`, data);

        return data;
    } catch (error) {
        console.error(`Error fetching order list page ${page}:`, error);
        return null;
    }
};

const fetchConversationDetail = async (conversation_id) => {
    try {
        const response = await fetch(`https://www.etsy.com/api/v3/ajax/bespoke/member/conversations/detail-view-data?conversation_id=${conversation_id}`, {
            headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                Referer: `https://www.etsy.com/messages/${conversation_id}`,
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const detailData = await response.json();
        console.log(`Detail data received for conversation ${conversation_id}:`, detailData);

        return detailData;
    } catch (error) {
        console.error(`Error fetching conversation detail for ${conversation_id}:`, error);
        return null;
    }
};

const callEtsyGetApi = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[ETSY GET] ${url}:`, data);

        return data;
    } catch (error) {
        console.error(`Error fetching for ${url}:`, error);
        return null;
    }
};

const fetchMoreMessages = async (conversation_id, messages) => {
    let message_order = messages[0].message_order - 1;
    messages = messages.reverse();
    if (message_order === 0) {
        return messages;
    }

    let url = `https://www.etsy.com/api/v3/ajax/member/conversations/detail/${conversation_id}/message-list?offset=${message_order}&fetch_older=true`;
    let data = await callEtsyGetApi(url);
    let older_messages = data.messages;
    
    messages = messages.concat(await fetchMoreMessages(conversation_id, older_messages));
    return messages;
};

function getContext() {
    // Get the current page's HTML
    const pageHtml = document.documentElement.outerHTML;

    // Use a regular expression to find the Etsy.Context variable
    const contextRegex = /Etsy\.Context\s*=\s*(\{[\s\S]*?\});/;
    const match = pageHtml.match(contextRegex);

    if (match && match[1]) {
        try {
            // Parse the matched JSON string
            const contextObj = JSON.parse(match[1]);
            console.log(contextObj);

            // Extract only the current_shop and current_user data
            const contextObj2 = {
                data: {
                    current_shop: contextObj.data?.current_shop || null,
                    current_user: contextObj.data?.current_user || null,
                    user_data: contextObj.data?.user_data || null,
                    shop_image: contextObj.data?.shop_image || null
                }
            };

            return contextObj2;
        } catch (error) {
            console.error('Error parsing Etsy.Context:', error);
            return null;
        }
    } else {
        console.error('Etsy.Context not found in the page HTML');
        return null;
    }
}


/**
 * Lấy danh sách sản phẩm từ một shop Etsy cụ thể và log ra
 * @param {number} shopId - ID của shop Etsy
 * @param {number} limit - Số lượng sản phẩm tối đa trả về
 * @param {number} offset - Vị trí bắt đầu lấy sản phẩm
 * @returns {Promise<Object>} - Dữ liệu sản phẩm
 */
const fetchShopProducts = async (shopId, limit = 40, offset = 0) => {
    try {
        // Giữ nguyên URL API
        const url = `https://www.etsy.com/api/v3/ajax/shop/${shopId}/listings/v3/search?limit=${limit}&offset=${offset}&sort_field=ending_date&sort_order=descending&state=active&language_id=0&query=&shop_section_id=&listing_tag=&is_featured=&shipping_profile_id=&return_policy_id=&production_partner_id=&is_retail=true&is_retail_only=&is_pattern=&is_pattern_only=&is_digital=&channels=&is_waitlisted=&has_video=&quality_issue=`;
        
        console.log(`[FETCH PRODUCTS] Đang gọi API: ${url}`);
        
        const response = await fetch(url, {
            method: "GET",
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-requested-with': 'XMLHttpRequest',
                'referer': 'https://www.etsy.com/your/shops/me/tools/listings?ref=seller-platform-mcnav'
            }
        });

        if (!response.ok) {
            console.error(`[API ERROR] Status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse JSON response
        const data = await response.json();
        
        // Xác định danh sách sản phẩm từ phản hồi
        // API trả về một mảng trực tiếp, không phải một đối tượng có thuộc tính results
        const products = Array.isArray(data) ? data : [];
        
        console.log(`[SHOP PRODUCTS] Lấy được ${products.length} sản phẩm từ shop ${shopId}`);
        
        // Hiển thị chi tiết sản phẩm nếu có
        if (products.length > 0) {
            console.log("----- DANH SÁCH SẢN PHẨM -----");
            products.forEach((product, index) => {
                console.log(`${index + 1}. Sản phẩm: ${product.title || 'Không có tiêu đề'}`);
                console.log(`   - ID: ${product.listing_id}`);   
                console.log("   ---------------------");
            });
        } else {
            console.log("[API RESPONSE] Không có dữ liệu sản phẩm");
        }
        
        return {
            count: products.length,
            results: products
        };
    } catch (error) {
        console.error(`[ERROR] Lỗi khi lấy sản phẩm cho shop ${shopId}:`, error);
        return {
            count: 0,
            results: []
        };
    }
};

