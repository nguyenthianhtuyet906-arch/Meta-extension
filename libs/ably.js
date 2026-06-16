let isDoraTab = false;
let isDoraTracking = false;
const clientId = Date.now().toString();
let heartbeatInterval = null;
let cachedShopName = null;
let cachedShopId = null;
let ablyListenerStarted = false;

function createModal() {
  // Remove existing modal if any
  const existingOverlay = document.querySelector('.dora-modal-overlay');
  const existingModal = document.querySelector('.dora-modal');
  if (existingOverlay) existingOverlay.remove();
  if (existingModal) existingModal.remove();
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'dora-modal-overlay';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'dora-modal';
  
  // Add modal content with Off button
  modal.innerHTML = `
    <h2>Dora Management Active</h2>
    <p>This tab is now being managed by Dora.</p>
    <p style="color: #F56400; font-weight: bold;">Please do not close this tab!</p>
    <p>Keep this tab open to ensure Dora continues working properly.</p>
    <button id="offDoraBtn" style="
      background-color: #dc3545;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    ">Off Dora Tab</button>
  `;
  
  // Add click handler for Off button
  modal.querySelector('#offDoraBtn').addEventListener('click', () => {
    setDoraTabStatus(false);
    // Remove from storage
    chrome.storage.local.remove('doraTabId');
    // Notify background to set a per-tab override (so popup and background respect the off state)
    try {
      // send message; background will use sender.tab.id when tabId omitted
      chrome.runtime.sendMessage({ action: 'setDoraOverride', isDora: false }, (resp) => {
        // ignore response
      });
    } catch (e) {
      // ignore
    }
  });
  
  // Add elements to page
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  return { overlay, modal };
}

function setDoraTabStatus(status) {
  isDoraTab = status;

  if (status) {
    isDoraTracking = true;
  } else {
    // Re-check if independent tracking is still active on this tab
    chrome.runtime.sendMessage({ action: "checkDoraTrackingStatus" }, (response) => {
      isDoraTracking = !!(response && response.isDoraTracking);
    });
  }

  const elements = document.querySelectorAll('button, a, input, select, [role="button"]');
  const { overlay, modal } = createModal();
  
  if (status) {
    // Enable Dora mode
    elements.forEach(el => {
      if (!el.id || el.id !== 'offDoraBtn') {
        el.classList.add('dora-disable-interactions');
      }
    });
    
    overlay.classList.add('dora-active');
    modal.classList.add('dora-active');
    modal.classList.add('dora-enable-modal');
    overlay.classList.add('dora-enable-modal');
    
    // Start listening to Ably
    startAblyListener();
  } else {
    // Disable Dora mode
    elements.forEach(el => {
      el.classList.remove('dora-disable-interactions');
    });
    
    overlay.classList.remove('dora-active');
    modal.classList.remove('dora-active');
    
    // Remove modal after animation
    setTimeout(() => {
      if (overlay && overlay.parentNode) overlay.remove();
      if (modal && modal.parentNode) modal.remove();
    }, 300);
  }
}

function setDoraTrackingStatus(status) {
  isDoraTracking = status;

  const existingBadge = document.getElementById('dora-tracking-badge');
  if (existingBadge) existingBadge.remove();

  if (status) {
    const badge = document.createElement('div');
    badge.id = 'dora-tracking-badge';
    badge.innerHTML = `
      <span style="
        display: inline-block;
        width: 8px; height: 8px;
        background: #22c55e;
        border-radius: 50%;
        margin-right: 6px;
        animation: dora-pulse 1.5s infinite;
      "></span>
      Dora Tracking Active
      <button id="dora-tracking-off-btn" style="
        margin-left: 10px;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.5);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      ">Off</button>
    `;
    badge.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      background: #16a34a;
      color: white;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    const style = document.createElement('style');
    style.id = 'dora-tracking-style';
    style.textContent = `
      @keyframes dora-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    if (!document.getElementById('dora-tracking-style')) {
      document.head.appendChild(style);
    }

    document.body.appendChild(badge);

    document.getElementById('dora-tracking-off-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'offDoraTrackingFromPage' }, () => {});
      setDoraTrackingStatus(false);
    });

    startTrackingHeartbeat();

    // Also start Ably listener for fetch-orders / send-tracking channels
    if (!ablyListenerStarted) {
      startAblyListener();
    }
  } else {
    stopTrackingHeartbeat();
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "doraTabStatus") {
    setDoraTabStatus(message.isDoraTab);
  }
  if (message.action === "doraTrackingStatus") {
    setDoraTrackingStatus(message.isDoraTracking);
  }
});

// Check Dora tab status on page load/refresh
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: "checkDoraTabStatus" }, (response) => {
    if (response && response.isDoraTab) {
      setDoraTabStatus(true);
    }
  });
  chrome.runtime.sendMessage({ action: "checkDoraTrackingStatus" }, (response) => {
    if (response && response.isDoraTracking) {
      setDoraTrackingStatus(true);
    }
  });
});

// Also check when script loads (for cases where DOMContentLoaded already fired)
chrome.runtime.sendMessage({ action: "checkDoraTabStatus" }, (response) => {
  if (response && response.isDoraTab) {
    setDoraTabStatus(true);
  }
});
chrome.runtime.sendMessage({ action: "checkDoraTrackingStatus" }, (response) => {
  if (response && response.isDoraTracking) {
    setDoraTrackingStatus(true);
  }
});

async function startTrackingHeartbeat() {
  // Lấy thông tin shop nếu chưa có cache
  if (!cachedShopName) {
    try {
      const currentUser = await callEtsyGetApi('https://www.etsy.com/api/v3/ajax/member/conversations/current-user');
      if (currentUser && currentUser.shop_name) {
        cachedShopName = currentUser.shop_name;
      }
    } catch (e) {
      console.warn('[HEARTBEAT] Cannot get shop name:', e);
    }
  }

  if (!cachedShopId) {
    try {
      if (typeof getShopId === 'function') {
        cachedShopId = await getShopId();
      }
    } catch (e) {
      console.warn('[HEARTBEAT] Cannot get shop ID:', e);
    }
  }

  // Gửi heartbeat ngay lập tức
  sendMeraHeartbeat(cachedShopId, cachedShopName);

  // Định kỳ mỗi 5 phút
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    sendMeraHeartbeat(cachedShopId, cachedShopName);
  }, 5 * 60 * 1000);
}

function stopTrackingHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function startAblyListener() {
  if (ablyListenerStarted) return;
  ablyListenerStarted = true;

  try {
    const currentUser = await callEtsyGetApi("https://www.etsy.com/api/v3/ajax/member/conversations/current-user");
    console.log("[CURRENT-USER]", currentUser);

    // Cache shop info for heartbeat
    if (currentUser && currentUser.shop_name) {
      cachedShopName = currentUser.shop_name;
    }

    const ably = new Ably.Realtime({
      key: env.ABLY_KEY,
      clientId: clientId
    });

    const channel = ably.channels.get(currentUser.shop_name);
    channel.presence.enter({
      clientId: clientId
    });

    console.log("ENTERED ", clientId);

    // Send heartbeat to Mera Admin with shop info from Ably current user
    // Also try to get shop_id from getShopInfo()
    let etsyShopId = null;
    try {
      const shopInfo = await getShopInfo();
      if (shopInfo && shopInfo.shopId) {
        etsyShopId = String(shopInfo.shopId);
        cachedShopId = etsyShopId;
      }
    } catch (e) {
      console.warn('[MERA] Could not get shopId from getShopInfo:', e);
    }
    sendMeraHeartbeat(etsyShopId, currentUser.shop_name);
    
    channel.subscribe('chat-message', (message) => {
      console.log(message);
      const parsedMessage = message.data;
      processSendMessage(parsedMessage);
    });

    // Subscribe to tracking events (payload should include orders array)
    channel.subscribe('send-tracking', (message) => {
      console.log('Received send-tracking message', message);
      const parsed = message.data;
      processSendTracking(parsed);
    });

    // Subscribe to fetch-shipments trigger from Mera Admin
    channel.subscribe('fetch-shipments', async (message) => {
      console.log('[FETCH-SHIPMENTS] Received fetch-shipments trigger from Mera Admin', message);
      const data = message.data;
      if (data.clientId != clientId) {
        console.log('[FETCH-SHIPMENTS] Message from other client, ignoring');
        return;
      }
      const statusId = data.id || null;
      const shopId = data.shopId || null;
      const orderIds = data.orderIds || [];
      const referer = data.referer || 'https://www.etsy.com/your/orders/sold';
      try {
        const result = await fetchShipmentsByOrder(shopId, orderIds, referer);
        console.log('[FETCH-SHIPMENTS] Shipments fetched:', result);
        if (statusId) {
          // Normalize shipments: Etsy returns camelCase keys, tracking nested under s.tracking,
          // and order_id only in the separate ordersToShipments map.
          // Admin backend expects snake_case strings with order_id on each shipment.
          const rawShipments = (result && result.shipments) ? result.shipments : [];
          const ordersToShipments = (result && result.ordersToShipments) ? result.ordersToShipments : {};

          // Build reverse map: shipmentId → order_id
          const shipmentToOrder = {};
          for (const [orderId, shipmentIds] of Object.entries(ordersToShipments)) {
            for (const sid of shipmentIds) {
              shipmentToOrder[sid] = orderId;
            }
          }

          const normalizedShipments = rawShipments.map(s => {
            const t = (s && s.tracking) ? s.tracking : {};
            return {
              order_id: String(shipmentToOrder[s.shipmentId] ?? ''),
              tracking_code: String(t.code ?? ''),
              carrier_name: String(s.carrierName ?? ''),
              tracking_url: String(t.url ?? ''),
              is_shipped: !!(t.isShipped ?? false),
              is_delivered: !!(t.isDelivered ?? false)
            };
          });
          await callMeraAdmin('POST', '/v1/extension/trackings/shipments-result', {
            id: statusId,
            shipments: normalizedShipments,
            ordersToShipments: ordersToShipments
          });
          console.log('[FETCH-SHIPMENTS] Result sent to admin backend');
        }
      } catch (error) {
        console.error('[FETCH-SHIPMENTS] Error:', error);
        if (statusId) {
          await callMeraAdmin('POST', '/v1/extension/trackings/shipments-result', {
            id: statusId,
            shipments: [],
            ordersToShipments: {}
          });
        }
      }
    });

    // Subscribe to fetch-orders trigger from Mera Admin
    channel.subscribe('fetch-orders', async (message) => {
      console.log('[FETCH-ORDERS] Received fetch-orders trigger from Mera Admin', message);
      try {
        await syncOrders(1);
        console.log('[FETCH-ORDERS] Orders sync completed');
      } catch (error) {
        console.error('[FETCH-ORDERS] Error syncing orders:', error);
      }
    });

    const onlineChannel = ably.channels.get('all-shops');
    onlineChannel.presence.enter({
      shop_name: currentUser.shop_name
    });

    console.log('Now listening for shop messages ', clientId);
  } catch (error) {
    console.error('Error in startAblyListener:', error);
  }
}

async function processSendMessage(data) {
    console.log('Processing message:', data);
    if (data.clientId != clientId){
        console.log("Message from other client, ignoring");
        return;
    }
    let response = await callBackend("POST", `messages/status/${data.message.id}`, {status: 'SENDING'});
    if (!response) {
        console.error('Failed to update message status to SENDING');
    }

    let attachments = {};
    if (data.message.attachments && data.message.attachments.length > 0) {
        for (let i = 0; i < data.message.attachments.length; i++) {
            const imageUrl = data.message.attachments[i];
            try {
                const image_id = await upload2Etsy(data.conversation_id, imageUrl);
                attachments[i] = image_id;
            } catch (error) {
                console.error('Error uploading image:', error);
                await callBackend("POST", `messages/status/${data.message.id}`, {
                    status: 'FAILED'
                });
                return;
            }
        }
    }
    console.log('Attachments:', attachments);

    try {
        let message = await sendMessage(data.conversation_id, data.message.message, attachments);
        console.log('Message sent successfully:', message);

        response = await callBackend("POST", `messages/status/${data.message.id}`, {
            message: message,
            status: 'DONE'
        });
        console.log('Backend updated with DONE status:', response);
    } catch (error) {
        console.error('Error sending message:', error);
        await callBackend("POST", `messages/status/${data.message.id}`, {
            status: 'FAILED'
        });
    }
}

async function processSendTracking(data) {
  console.log('[processSendTracking] Received data:', JSON.stringify(data, null, 2));
  
  if (data.clientId != clientId) {
    console.log('[processSendTracking] Message from other client, ignoring');
    return;
  }

  // Determine tracking ID from payload
  const statusId = (data.tracking && data.tracking.id) || (data.message && data.message.id) || data.id || null;
  const statusPath = statusId ? `trackings/status/${statusId}` : null;
  
  console.log('[processSendTracking] Status ID:', statusId, 'Status Path:', statusPath);

  if (statusPath) {
    try {
      const sendingResp = await callMeraAdmin('POST', '/v1/extension/' + statusPath, { status: 'SENDING' });
      console.log('[processSendTracking] Set status to SENDING:', sendingResp);
    } catch (e) {
      console.warn('[processSendTracking] Failed to set SENDING status for tracking:', e);
    }
  }

  // Build orders array from data.tracking.etsy or data.orders
  let orders = [];
  if (data.tracking && data.tracking.etsy) {
    // Single tracking object from server - extract order info
    orders = [{
      order_id: data.tracking.etsy.order_id || data.tracking.order_id,
      carrier: data.tracking.etsy.carrier !== undefined ? data.tracking.etsy.carrier : -1,
      other_carrier: data.tracking.etsy.other_carrier || data.tracking.other_carrier || '',
      tracking_number: data.tracking.etsy.tracking_number || data.tracking.tracking_number || '',
      note: data.tracking.etsy.note || data.tracking.note || '',
      ship_date: data.tracking.etsy.ship_date !== undefined ? data.tracking.etsy.ship_date : 0,
      has_selected_tracking_exclusion: data.tracking.etsy.has_selected_tracking_exclusion || false,
      selected_tracking_exclusion_reason: data.tracking.etsy.selected_tracking_exclusion_reason || '',
      other_tracking_exclusion_reason_desc: data.tracking.etsy.other_tracking_exclusion_reason_desc || ''
    }];
  } else if (data.orders && Array.isArray(data.orders)) {
    orders = data.orders;
  } else if (data.trackingOrders && Array.isArray(data.trackingOrders)) {
    orders = data.trackingOrders;
  } else if (data.message && data.message.orders) {
    orders = data.message.orders;
  }

  console.log('[processSendTracking] Orders array:', JSON.stringify(orders, null, 2));

  if (!Array.isArray(orders) || orders.length === 0) {
    console.error('[processSendTracking] No orders provided for tracking');
    if (statusPath) await callMeraAdmin('POST', '/v1/extension/' + statusPath, { status: 'FAILED' });
    return;
  }

  // Get shopId - if 0 or null, let batchCompleteOrders fetch it
  let shopId = data.shopId || (data.tracking && data.tracking.etsy && data.tracking.etsy.shop_id) || null;
  if (shopId === 0) shopId = null; // Treat 0 as missing
  
  console.log('[processSendTracking] Shop ID:', shopId);
  
  const referer = data.referer || 'https://www.etsy.com/your/orders/sold/completed';

  try {
    console.log('[processSendTracking] Calling batchCompleteOrders with shopId:', shopId, 'orders:', orders.length, 'referer:', referer);
    
    let result;
    if (typeof batchCompleteOrders === 'function') {
      result = await batchCompleteOrders(shopId, orders, referer);
    } else if (typeof window !== 'undefined' && typeof window.batchCompleteOrders === 'function') {
      result = await window.batchCompleteOrders(shopId, orders, referer);
    } else {
      throw new Error('batchCompleteOrders is not available in this context');
    }

    console.log('[processSendTracking] Tracking sent successfully:', result);
    if (statusPath) {
      const doneResp = await callMeraAdmin('POST', '/v1/extension/' + statusPath, { tracking: result, status: 'DONE' });
      console.log('[processSendTracking] Set status to DONE:', doneResp);
    }
  } catch (error) {
    console.error('[processSendTracking] Error sending tracking:', error);
    if (statusPath) {
      await callMeraAdmin('POST', '/v1/extension/' + statusPath, { status: 'FAILED' });
    }
  }
}

// Expose for manual testing from console
if (typeof window !== 'undefined') {
  window.processSendTracking = processSendTracking;
}