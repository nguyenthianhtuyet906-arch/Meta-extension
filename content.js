// Biến để theo dõi trạng thái đã lấy sản phẩm hay chưa
let hasCheckedProductsOnCurrentPage = false;

// Khởi tạo script inject
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);

// Listen for URL changes
window.addEventListener('urlChange', (event) => {
    processMessage(event.detail);
});

// Hàm tổng quan xử lý URL
function processMessage(url) {
    processMessageListPage(url);
    processMessageDetailPage(url);
    processProductsPage(url); // Thêm hàm mới để kiểm tra trang sản phẩm
}

// Process message list page function
async function processMessageListPage(url) {
    if (url != '/messages/all')
        if (url != '/messages/unread')  // Thêm dòng này
            if (url != 'https://www.etsy.com/messages/all')
                if (url != 'https://www.etsy.com/messages/unread')  // Thêm dòng này
                    if (!url.includes("messages?ref=seller-platform-mcnav"))
                        return;
    
    console.log(`Processing message list page: ${url}`);
}


async function getShopProducts(shopId, maxPages = 999) {
    try {
        console.log(`===== BẮT ĐẦU LẤY SẢN PHẨM CHO SHOP ${shopId} =====`);
        
        let page = 1;
        let hasMoreProducts = true;
        let allProducts = [];
        
        while (hasMoreProducts && page <= maxPages) {
            const offset = (page - 1) * 40;
            console.log(`----- TRANG ${page} -----`);
            
            const data = await fetchShopProducts(shopId, 40, offset);
            
            if (!data || !data.results || data.results.length === 0) {
                console.log(`Không còn sản phẩm hoặc có lỗi xảy ra.`);
                hasMoreProducts = false;
            } else {
                console.log(`Đã lấy ${data.results.length} sản phẩm của trang ${page}`);
                
                // Thêm sản phẩm vào mảng tổng
                allProducts = allProducts.concat(data.results);
                
                // Nếu số lượng sản phẩm nhận được ít hơn 40, không cần lấy thêm
                if (data.results.length < 40) {
                    console.log(`Đã lấy hết tất cả sản phẩm sau ${page} trang.`);
                    hasMoreProducts = false;
                }
                
                page++;
            }
        }
        
        if (page > maxPages) {
            console.log(`Đã đạt đến giới hạn ${maxPages} trang. Có thể còn nhiều sản phẩm hơn.`);
        }
        
        // Đồng bộ sản phẩm lên backend
        if (allProducts.length > 0) {
            console.log(`Bắt đầu đồng bộ ${allProducts.length} sản phẩm lên backend...`);
            
            // Thêm thông tin shop vào mỗi sản phẩm
            const context = getContext();
            if (context && context.data && context.data.current_shop) {
                const shopInfo = {
                    shop_id: context.data.current_shop.shop_id,
                    shop_name: context.data.current_shop.shop_name
                };
                
                // Chia nhỏ mảng sản phẩm để tránh request quá lớn
                const batchSize = 20;
                for (let i = 0; i < allProducts.length; i += batchSize) {
                    const batch = allProducts.slice(i, i + batchSize);
                    const productsWithShopInfo = batch.map(product => {
                        return {
                            ...product,
                            shop_info: shopInfo
                        };
                    });
                    
                    await syncProducts(productsWithShopInfo);
                    console.log(`Đã đồng bộ batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allProducts.length/batchSize)}`);
                }
            } else {
                console.error("Không thể lấy thông tin shop từ context. Bỏ qua đồng bộ.");
            }
        }
        
        console.log(`===== HOÀN THÀNH LẤY VÀ ĐỒNG BỘ SẢN PHẨM CHO SHOP ${shopId} =====`);
    } catch (error) {
        console.error(`Có lỗi khi lấy và đồng bộ sản phẩm cho shop ${shopId}:`, error);
    }
}
const syncProducts = async (products) => {
    try {
        const response = await callBackend("POST", "extension/products/sync", products);
        console.log(`[SYNC PRODUCTS] Đã đồng bộ ${products.length} sản phẩm lên backend`);
        return response;
    } catch (error) {
        console.error(`[ERROR] Lỗi khi đồng bộ sản phẩm lên backend:`, error);
        return null;
    }
};

// Thêm hàm mới để xử lý trang sản phẩm
async function processProductsPage(url) {
    // Kiểm tra xem URL có phải là trang danh sách sản phẩm hay không
    if (url.includes('/your/shops/me/tools/listings') || 
        url === 'https://www.etsy.com/your/shops/me/tools/listings') {
        
        // Kiểm tra nếu chưa lấy sản phẩm trên trang hiện tại
        if (!hasCheckedProductsOnCurrentPage) {
            console.log('Đã phát hiện trang danh sách sản phẩm, bắt đầu lấy dữ liệu...');
            
            // Lấy shop ID từ context
            const context = getContext();
            if (context && context.data && context.data.current_shop) {
                const shopId = context.data.current_shop.shop_id;
                await getShopProducts(shopId, 999); 
                
                // Đánh dấu đã lấy sản phẩm trên trang này
                hasCheckedProductsOnCurrentPage = true;
            } else {
                console.error("Không thể lấy thông tin shop từ context");
            }
        } else {
            console.log('Đã lấy sản phẩm trên trang này rồi, bỏ qua.');
        }
    } else {
        // Reset biến khi người dùng rời khỏi trang sản phẩm
        hasCheckedProductsOnCurrentPage = false;
    }
}

let isSyncing = false;
let hasInitialUnreadSync = false;

// Auto sync messages every 10s when Dora Tab is active
setInterval(async () => {
    if (!isDoraTab) return;
    if (isSyncing) return;
    isSyncing = true;
    console.log("[auto-sync] Starting message sync");
    try {
        if (!hasInitialUnreadSync) {
            await syncNewConversations(1, 'system_tag.unread');
            hasInitialUnreadSync = true;
        }
        await syncNewConversations(1, 'system_tag.inbox');
    } catch (error) {
        console.error('[auto-sync] Error syncing messages:', error);
    }
    isSyncing = false;
}, 10000);

// Listen for messages from extension (popup / background) - Sync Now only syncs orders
chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'triggerSync') {
        syncOrders(1).then(() => {
            sendResponse({ triggered: true });
        }).catch((err) => {
            sendResponse({ triggered: false, error: err && err.message });
        });
        return true;
    }
});

async function syncNewConversations(page, tag = 'system_tag.inbox') {
    if (tag === 'system_tag.inbox' && page > 4) {
        return;
    }
    
    if (tag === 'system_tag.unread' && page > 1) { 
        console.log('Unread sync only processes page 1');
        return;
    }
    
    const data = await fetchConversationList(page, tag);  
    
    if (!data || !data.conversations || data.conversations.length === 0) {
        return;
    }

    const conversationIds = await callBackend("POST", "extension/conversations/sync", data);

    for (const conversationId of conversationIds) {
        await syncConversationDetail(conversationId);
    }

    // Logic cho inbox và unread
    if (tag === 'system_tag.inbox') {
        // Inbox: dừng khi backend không trả về conversation IDs mới
        if (conversationIds && conversationIds.length > 0) {
            await syncNewConversations(page + 1, tag);  
        }
    } else if (tag === 'system_tag.unread') {
        // Unread: chỉ quét page 1, dừng khi hết data HOẶC không đủ 20 conversations
        if (data.conversations && data.conversations.length === 20) {
            await syncNewConversations(1, tag); // Luôn gọi với page = 1
        }
        // Nếu < 20 conversations thì dừng (đã hết data)
    }
}


async function syncOrders(page)
{
    if (page > 3) {
        console.log(`[SYNC ORDERS] Reached max page limit (3)`);
        return;
    }

    console.log(`[SYNC ORDERS] Starting sync for page ${page}`);
    
    context = getContext();
    const shopId = context.data.current_shop.shop_id;
    console.log(`[SYNC ORDERS] Fetching orders for shop ${shopId}, page ${page}`);
    
    const data = await fetchOrderList(shopId, page);
    
    if (!data || !data.orders || data.orders.length === 0) {
        console.log(`[SYNC ORDERS] No orders found on page ${page}`);
        return;
    }
    
    console.log(`[SYNC ORDERS] Found ${data.orders.length} orders on page ${page}`);
    data.context = context;
    
    // Sync tới old backend
    const response = await callBackend("POST", "extension/orders/sync", data);

    // Sync tới Mera Admin backend (best-effort, không block flow chính)
    syncOrdersToMera(data);
    
    if (response && response.new_order_ids) {
        console.log(`[SYNC ORDERS] Backend returned ${response.new_order_ids.length} new order IDs on page ${page}`);
        
        if (response.new_order_ids.length == 20) {
            console.log(`[SYNC ORDERS] Continuing to page ${page + 1}`);
            return await syncOrders(page + 1);
        } else {
            console.log(`[SYNC ORDERS] Sync completed at page ${page} (found ${response.new_order_ids.length} new orders)`);
        }
    } else {
        console.log(`[SYNC ORDERS] No new orders to sync on page ${page}`);
    }
}

// Gửi orders tới Mera Admin backend (best-effort)
async function syncOrdersToMera(data) {
    if (!env || !env.MERA_ADMIN_ENDPOINT) return;
    try {
        const url = env.MERA_ADMIN_ENDPOINT + '/v1/extension/orders/sync';
        const response = await fetch(url, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            const result = await response.json();
            console.log('[MERA SYNC ORDERS] OK', result);
        } else {
            console.warn(`[MERA SYNC ORDERS] HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('[MERA SYNC ORDERS] Failed:', error.message);
    }
}

// Process message detail page function
async function processMessageDetailPage(url) {
    const match = url.match(/\/messages\/(\d+)/);
    if (!match) {
        return;
    }

    let conversation_id = match[1];

    try {
        await syncConversationDetail(conversation_id);

        // Step 3: Fetch AI suggestions
        const aiResponse = await callBackend("GET", `conversations/ai/${conversation_id}`, {});
        
        const solutions = aiResponse.solutions;
        const suggestion = aiResponse.message.replace(/\n/g, "<br>");

        // Update textarea directly with AI suggestion
        const textarea = document.querySelector('.wt-textarea.wt-pr-md-10.wt-pr-xs-8.new-message-textarea-min-height');
        if (textarea) {
            textarea.value = suggestion;

            // Dispatch input event to trigger any listeners
            textarea.dispatchEvent(new Event('input', {
                bubbles: true,
                cancelable: true,
            }));
        }

        // Create buttons for each solution
        const buttonContainer = document.createElement('div');

        // Create "Get AI Advice" button
        const aiButton = document.createElement('button');
        aiButton.type = 'button';
        aiButton.className = 'wt-btn wt-btn--filled wt-btn--small';
        aiButton.innerText = 'Get AI Advice';
        aiButton.style.margin = '5px 0';
        aiButton.addEventListener('click', async () => {
            const input = textarea.value;
            const aiRes = await callBackend("GET", `conversations/ai/${conversation_id}?input=${encodeURIComponent(input)}`, {});
            if (aiRes.message) {
                textarea.value = aiRes.message;
            } 

            // Dispatch input event to trigger any listeners
            textarea.dispatchEvent(new Event('input', {
                bubbles: true,
                cancelable: true,
            }));
        });
        buttonContainer.appendChild(aiButton);

        // Create buttons for each solution
        solutions.forEach((solution, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wt-btn wt-btn--filled wt-btn--small';
            button.innerText = solution;
            button.style.display = 'block';
            button.style.margin = '10px';
            button.addEventListener('click', async () => {
                const aiRes = await callBackend("GET", `conversations/ai/${conversation_id}?input=${encodeURIComponent(solution)}`, {});
                if (aiRes.message) {
                    textarea.value = aiRes.message;
                }

                // Dispatch input event to trigger any listeners
                textarea.dispatchEvent(new Event('input', {
                    bubbles: true,
                    cancelable: true,
                }));
            });
            buttonContainer.appendChild(button);
        });

        // Prepend buttons to buyerInfoDiv
        const buyerInfoDiv = document.querySelector('.buyer-info.wt-mt-xs-2');
        buyerInfoDiv.prepend(buttonContainer);
    } catch (error) {
        console.error('Error process detail page:', error);
    }
}

async function syncConversationDetail(conversation_id) {
    // console.log("[CONVERSATION] " + conversation_id);
    try {
        // Step 1: Fetch conversation detail
        const conversation = await fetchConversationDetail(conversation_id);
        await callBackend("POST", `extension/conversations/sync/${conversation_id}`, conversation);

        // Step 2: Fetch all messages of the conversation
        const messages = await fetchMoreMessages(conversation_id, conversation.detail.messages);
        await callBackend("POST", `extension/messages/sync`, { messages });

    } catch (error) {
        console.error('Error sync conversation detail:', error);
    }
}

// Kiểm tra URL hiện tại khi extension được tải
document.addEventListener('DOMContentLoaded', () => {
    const currentUrl = window.location.href;
    processMessage(currentUrl);
});