/**
 * Send a batch-complete request to Etsy to mark orders as shipped/completed.
 * @param {number} shopId - Etsy shop id
 * @param {Array<Object>} orders - Array of order objects. Each object should contain:
 *   - order_id (number|string)
 *   - carrier (number|string) use -1 if other_carrier provided
 *   - other_carrier (string) optional
 *   - tracking_number (string) optional
 *   - note (string) optional
 *   - has_selected_tracking_exclusion (boolean) optional
 *   - selected_tracking_exclusion_reason (string) optional
 *   - other_tracking_exclusion_reason_desc (string) optional
 *   - ship_date (number) optional (0 for none)
 * @param {string} [referer] - optional referer URL to include
 */
async function batchCompleteOrders(shopId, orders = [], referer = 'https://www.etsy.com/your/orders/sold/completed') {
	if (!shopId) {
		try {
			if (typeof getShopId === 'function') {
				shopId = await getShopId();
			}
		} catch (e) {
			console.error('Unable to determine shopId for batchCompleteOrders', e);
		}
	}

	if (!shopId) {
		throw new Error('shopId is required for batchCompleteOrders');
	}

	if (!Array.isArray(orders) || orders.length === 0) {
		throw new Error('orders must be a non-empty array');
	}

	// Build urlencoded body like: orders[0][order_id]=...&orders[0][note]=...&orders[0][carrier]=...
	const parts = [];
	orders.forEach((o, idx) => {
		const base = `orders%5B${idx}%5D`;
		const push = (key, value) => {
			if (value === undefined || value === null) return;
			parts.push(`${base}%5B${encodeURIComponent(key)}%5D=${encodeURIComponent(String(value))}`);
		};

		push('order_id', o.order_id);
		push('note', o.note || '');
		push('carrier', (o.carrier !== undefined) ? o.carrier : -1);
		push('other_carrier', o.other_carrier || '');
		push('tracking_number', o.tracking_number || '');
		push('has_selected_tracking_exclusion', (o.has_selected_tracking_exclusion === true));
		push('selected_tracking_exclusion_reason', o.selected_tracking_exclusion_reason || '');
		push('other_tracking_exclusion_reason_desc', o.other_tracking_exclusion_reason_desc || '');
		push('ship_date', (o.ship_date !== undefined) ? o.ship_date : 0);
	});

	const body = parts.join('&');

	const url = `https://www.etsy.com/api/v3/ajax/bespoke/shop/${shopId}/mission-control/order-state/batch-complete`;

	// Try to get CSRF token if helper available
	let csrf = null;
	try {
		if (typeof getCsrf === 'function') csrf = await getCsrf();
	} catch (e) {
		console.warn('getCsrf() failed or not available:', e);
	}

	const headers = {
		'accept': '*/*',
		'accept-language': 'en-US,en;q=0.9',
		'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
		'sec-fetch-dest': 'empty',
		'sec-fetch-mode': 'cors',
		'sec-fetch-site': 'same-origin',
		'x-requested-with': 'XMLHttpRequest'
	};

	if (csrf) headers['x-csrf-token'] = csrf;
	if (referer) headers['Referer'] = referer;

	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers,
			body
		});

		if (!resp.ok) {
			const text = await resp.text().catch(() => '');
			throw new Error(`HTTP ${resp.status} - ${text}`);
		}

		const data = await resp.json();
		console.log('[batchCompleteOrders] response:', data);
		return data;
	} catch (error) {
		console.error('Error in batchCompleteOrders:', error);
		throw error;
	}
}

// Expose function for other scripts if running in browser context
if (typeof window !== 'undefined') {
	window.batchCompleteOrders = batchCompleteOrders;
}

/**
 * Example usage:
 * await batchCompleteOrders(54238021, [{ order_id: 3822936345, tracking_number: 'AU0000004226830', other_carrier: 'Australia Post' }]);
 * await fetchShipmentsByOrder(54238021, [3822936345]);
 */

/**
 * Lấy thông tin shipment và tracking của orders từ Etsy.
 * @param {number} [shopId] - ID shop Etsy. Nếu không truyền sẽ tự động lấy từ getShopId().
 * @param {Array<number|string>} orderIds - Mảng order ID cần lấy tracking.
 * @param {string} [referer] - Referer URL, mặc định là /your/orders/sold.
 * @returns {Promise<Object>} { shipments: [], ordersToShipments: {} }
 */
async function fetchShipmentsByOrder(shopId, orderIds = [], referer = 'https://www.etsy.com/your/orders/sold') {
	if (!shopId) {
		try {
			if (typeof getShopId === 'function') {
				shopId = await getShopId();
			}
		} catch (e) {
			console.error('Unable to determine shopId for fetchShipmentsByOrder', e);
		}
	}

	if (!shopId) {
		throw new Error('shopId is required for fetchShipmentsByOrder');
	}

	if (!Array.isArray(orderIds) || orderIds.length === 0) {
		throw new Error('orderIds must be a non-empty array');
	}

	const params = orderIds.map(id => `order_ids%5B%5D=${encodeURIComponent(id)}`).join('&');
	const url = `https://www.etsy.com/api/v3/ajax/shop/${shopId}/shipments/by-order?${params}`;

	const headers = {
		'accept': '*/*',
		'accept-language': 'en-US,en;q=0.9',
		'content-type': 'application/json',
		'sec-fetch-dest': 'empty',
		'sec-fetch-mode': 'cors',
		'sec-fetch-site': 'same-origin',
		'x-requested-with': 'XMLHttpRequest',
		'x-transform-response': 'camel-case'
	};

	if (referer) headers['Referer'] = referer;

	try {
		const resp = await fetch(url, {
			method: 'GET',
			headers
		});

		if (!resp.ok) {
			const text = await resp.text().catch(() => '');
			throw new Error(`HTTP ${resp.status} - ${text}`);
		}

		const data = await resp.json();
		console.log('[fetchShipmentsByOrder] response:', data);
		return data;
	} catch (error) {
		console.error('Error in fetchShipmentsByOrder:', error);
		throw error;
	}
}

// Expose function for other scripts if running in browser context
if (typeof window !== 'undefined') {
	window.fetchShipmentsByOrder = fetchShipmentsByOrder;
}

