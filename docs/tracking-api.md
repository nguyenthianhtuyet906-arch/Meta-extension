# Dora Extension — Etsy Tracking API

Tài liệu cho hệ thống ngoài tích hợp với Dora Extension để **lấy tracking** và **gửi tracking** lên Etsy.

---

## 1. GET Tracking — Lấy thông tin shipment từ Etsy

Lấy toàn bộ thông tin shipment và tracking của một hoặc nhiều order.

### 1.1. Gọi qua Extension (từ browser console hoặc script trong extension)

```js
// Không cần shopId — tự detect
const result = await window.fetchShipmentsByOrder(null, [4047674171]);

// Hoặc truyền shopId cụ thể
const result = await window.fetchShipmentsByOrder(54076614, [4047674171, 4047674172]);

// Với referer tùy chỉnh
const result = await window.fetchShipmentsByOrder(54076614, [4047674171], 'https://www.etsy.com/your/orders/sold?search_query=4047674171');
```

**Function signature:**
```js
fetchShipmentsByOrder(shopId, orderIds, referer?)
```
- `shopId` — ID shop Etsy. Truyền `null`/`0` để tự động lấy từ `getShopId()`.
- `orderIds` — Mảng order ID cần lấy tracking.
- `referer` _(optional)_ — Referer URL. Mặc định: `https://www.etsy.com/your/orders/sold`.

### 1.2. Gọi trực tiếp Etsy API (nếu hệ thống ngoài tự gọi)

```
GET https://www.etsy.com/api/v3/ajax/shop/{shop_id}/shipments/by-order?order_ids[]={order_id}&order_ids[]={order_id2}
```

**Headers:**

| Header | Value |
|---|---|
| `accept` | `*/*` |
| `accept-language` | `en-US,en;q=0.9` |
| `content-type` | `application/json` |
| `sec-fetch-dest` | `empty` |
| `sec-fetch-mode` | `cors` |
| `sec-fetch-site` | `same-origin` |
| `x-requested-with` | `XMLHttpRequest` |
| `x-transform-response` | `camel-case` |
| `Referer` | `https://www.etsy.com/your/orders/sold` |

> **Quan trọng:** API yêu cầu cookie session Etsy hợp lệ. Gọi từ trong browser đã login Etsy thì cookie tự động gửi kèm.

### 1.3. Response

```json
{
    "shipments": [
        {
            "shipmentId": "1485137141586",
            "isFutureShipment": false,
            "isInternational": true,
            "mailingDate": 1778256000,
            "note": "",
            "noteDate": 1778234775,
            "carrierName": "DHL",
            "carrierId": 4,
            "carrierUrl": "https://www.dhl.com/global-en/home.html",
            "shippingLabelId": null,
            "actions": [
                {
                    "name": "EditTracking",
                    "actionType": "EditTracking"
                }
            ],
            "tracking": {
                "code": "00340434775432605887",
                "url": "https://www.dhl.com/global-en/home.html",
                "isDelivered": false,
                "isInTransit": false,
                "isOutForDelivery": false,
                "isShipped": true,
                "shouldHaveEvents": true,
                "isEtsyOnlyTracking": false,
                "majorTrackingState": "Pre-transit",
                "events": [
                    {
                        "trackingEventId": 306416382357,
                        "date": 1778278282,
                        "location": "",
                        "eventType": "The instruction data for this shipment have been provided by the sender to DHL electronically"
                    }
                ]
            },
            "fromAddress": {
                "name": "",
                "firstLine": "",
                "secondLine": "",
                "city": "",
                "state": "",
                "zip": "",
                "country": "Vietnam",
                "countryId": 212
            },
            "toAddress": {
                "name": "Denise Frank",
                "firstLine": "An den Gartenäckern 5",
                "secondLine": "",
                "city": "Alsfeld",
                "state": "",
                "zip": "36304",
                "country": "Germany",
                "countryId": 91
            }
        }
    ],
    "ordersToShipments": {
        "4047674171": [
            "1485137141586",
            "1485137141564"
        ]
    }
}
```

### 1.4. Các trường quan trọng

| Đường dẫn | Type | Mô tả |
|---|---|---|
| `shipments[].shipmentId` | string | ID của shipment |
| `shipments[].carrierName` | string | Tên hãng vận chuyển |
| `shipments[].carrierId` | number | Mã carrier Etsy |
| `shipments[].mailingDate` | number | Unix timestamp ngày gửi |
| `shipments[].tracking.code` | string | Mã tracking number |
| `shipments[].tracking.url` | string | URL xem tracking |
| `shipments[].tracking.isShipped` | boolean | Đã ship |
| `shipments[].tracking.isDelivered` | boolean | Đã giao |
| `shipments[].tracking.isInTransit` | boolean | Đang vận chuyển |
| `shipments[].tracking.isOutForDelivery` | boolean | Đang đi giao |
| `shipments[].tracking.majorTrackingState` | string | Trạng thái chính: `Pre-transit`, `In Transit`, `Delivered`... |
| `shipments[].tracking.events` | array | Danh sách sự kiện tracking |
| `shipments[].tracking.events[].date` | number | Unix timestamp sự kiện |
| `shipments[].tracking.events[].eventType` | string | Mô tả sự kiện |
| `shipments[].tracking.events[].location` | string | Địa điểm sự kiện |
| `shipments[].fromAddress` | object | Địa chỉ người gửi |
| `shipments[].toAddress` | object | Địa chỉ người nhận |
| `ordersToShipments` | object | Map `order_id` → mảng `shipment_id` |

---

## 2. POST Tracking — Gửi tracking lên Etsy

Đánh dấu order đã được ship (batch complete) kèm carrier và tracking number.

### 2.1. Gọi qua Extension

```js
await window.batchCompleteOrders(54076614, [
    {
        order_id: 4047674171,
        carrier: 4,
        tracking_number: '00340434775432605887',
        note: '',
        ship_date: 0
    }
]);

// Dùng carrier tùy chỉnh (other_carrier)
await window.batchCompleteOrders(54076614, [
    {
        order_id: 4047674171,
        carrier: -1,
        other_carrier: 'Australia Post',
        tracking_number: 'AU0000004226830'
    }
]);
```

**Function signature:**
```js
batchCompleteOrders(shopId, orders, referer?)
```
- `shopId` — ID shop Etsy. Truyền `null`/`0` để tự động lấy từ `getShopId()`.
- `orders` — Mảng order, mỗi phần tử có các trường bên dưới.
- `referer` _(optional)_ — Referer URL. Mặc định: `https://www.etsy.com/your/orders/sold/completed`.

### 2.2. Parameters mỗi order

| Parameter | Type | Required | Mặc định | Mô tả |
|---|---|---|---|---|
| `order_id` | number/string | **Yes** | — | ID của order Etsy |
| `carrier` | number | No | `-1` | Mã carrier Etsy. Đặt `-1` nếu dùng `other_carrier` |
| `other_carrier` | string | No | `""` | Tên carrier tùy chỉnh (VD: `"Australia Post"`) |
| `tracking_number` | string | No | `""` | Mã tracking |
| `note` | string | No | `""` | Ghi chú cho order |
| `ship_date` | number | No | `0` | Unix timestamp ngày ship. `0` = không chọn |
| `has_selected_tracking_exclusion` | boolean | No | `false` | Đánh dấu không cần tracking |
| `selected_tracking_exclusion_reason` | string | No | `""` | Lý do miễn tracking |
| `other_tracking_exclusion_reason_desc` | string | No | `""` | Mô tả lý do khác |

### 2.3. Gọi trực tiếp Etsy API

```
POST https://www.etsy.com/api/v3/ajax/bespoke/shop/{shop_id}/mission-control/order-state/batch-complete
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
x-csrf-token: {csrf_token}
x-requested-with: XMLHttpRequest

orders%5B0%5D%5Border_id%5D=4047674171&orders%5B0%5D%5Bnote%5D=&orders%5B0%5D%5Bcarrier%5D=4&orders%5B0%5D%5Bother_carrier%5D=&orders%5B0%5D%5Btracking_number%5D=00340434775432605887&orders%5B0%5D%5Bhas_selected_tracking_exclusion%5D=false&orders%5B0%5D%5Bselected_tracking_exclusion_reason%5D=&orders%5B0%5D%5Bother_tracking_exclusion_reason_desc%5D=&orders%5B0%5D%5Bship_date%5D=0
```

**Body format (urlencoded):**
```
orders[0][order_id]=...
orders[0][note]=...
orders[0][carrier]=...
orders[0][other_carrier]=...
orders[0][tracking_number]=...
orders[0][has_selected_tracking_exclusion]=...
orders[0][selected_tracking_exclusion_reason]=...
orders[0][other_tracking_exclusion_reason_desc]=...
orders[0][ship_date]=...
```

> **Quan trọng:** API POST yêu cầu CSRF token (lấy từ `Etsy.Context.csrfToken` trong DOM trang Etsy) và cookie session hợp lệ.

### 2.4. Danh sách carrierId phổ biến

| ID | Carrier |
|----|---------|
| `-1` | Other (dùng kèm `other_carrier`) |
| `1` | USPS |
| `2` | FedEx |
| `3` | UPS |
| `4` | DHL |
| `5` | Canada Post |
| `6` | Australia Post |
| `7` | Royal Mail |
| `8` | Deutsche Post |
| `9` | La Poste |
| `10` | Japan Post |

---

## 3. Tích hợp qua Ably Channel (Real-time)

Hệ thống ngoài có thể gửi tracking qua Ably channel để extension tự động xử lý.

### 3.1. Flow

```
Server của bạn → Ably Channel (tên = tên shop Etsy) → Extension
                                                          │
                                            ┌─────────────┴─────────────┐
                                            ▼                           ▼
                                   POST /trackings/status/{id}    batchCompleteOrders()
                                   { status: 'SENDING' }          (gửi tracking lên Etsy)
                                                                       │
                                                                       ▼
                                                              POST /trackings/status/{id}
                                                              { tracking: result, status: 'DONE' }
                                                              hoặc { status: 'FAILED' }
```

### 3.2. Message format gửi vào Ably channel `send-tracking`

**Format 1 — Đầy đủ (khuyến nghị):**

```json
{
    "clientId": "target-client-id",
    "tracking": {
        "id": 123,
        "etsy": {
            "order_id": 4047674171,
            "shop_id": 54076614,
            "carrier": 4,
            "tracking_number": "00340434775432605887",
            "note": "",
            "ship_date": 1778256000
        }
    },
    "shopId": 54076614,
    "referer": "https://www.etsy.com/your/orders/sold/completed"
}
```

**Format 2 — Mảng orders trực tiếp:**

```json
{
    "clientId": "target-client-id",
    "id": 123,
    "shopId": 54076614,
    "orders": [
        {
            "order_id": 4047674171,
            "carrier": 4,
            "tracking_number": "00340434775432605887"
        },
        {
            "order_id": 4047674172,
            "carrier": -1,
            "other_carrier": "Australia Post",
            "tracking_number": "AU0000004226830"
        }
    ]
}
```

### 3.3. Backend Status API

Extension gọi về backend để cập nhật trạng thái trong quá trình xử lý tracking:

```
POST {BACKEND_ENDPOINT}/trackings/status/{id}
Content-Type: application/json
```

**Các trạng thái:**

| Giai đoạn | Body |
|---|---|
| Bắt đầu xử lý | `{ "status": "SENDING" }` |
| Thành công | `{ "tracking": { ...etsy_response... }, "status": "DONE" }` |
| Thất bại | `{ "status": "FAILED" }` |

### 3.4. Các channel khác

| Channel | Event | Mô tả |
|---|---|---|
| `{shop_name}` | `send-tracking` | Nhận lệnh gửi tracking |
| `{shop_name}` | `chat-message` | Nhận lệnh gửi message |
| `{shop_name}` | `fetch-orders` | Trigger sync orders từ Etsy |
| `all-shops` | presence | Theo dõi shop nào đang online |

---

## 4. Code reference

| File | Function | Công dụng |
|---|---|---|
| [libs/etsy-tracking.js](../libs/etsy-tracking.js) | `batchCompleteOrders()` | POST tracking lên Etsy |
| [libs/etsy-tracking.js](../libs/etsy-tracking.js) | `fetchShipmentsByOrder()` | GET tracking từ Etsy |
| [libs/ably.js](../libs/ably.js) | `processSendTracking()` | Nhận message Ably → gọi batchCompleteOrders |
| [libs/etsy-api.js](../libs/etsy-api.js) | `fetchOrderList()` | GET danh sách order từ Etsy |
| [libs/backend-api.js](../libs/backend-api.js) | `callBackend()` | Gọi API về backend |
| [configs/env.json](../configs/env.json) | — | Cấu hình BACKEND_ENDPOINT, ABLY_KEY |

---

## 5. Ví dụ tích hợp hoàn chỉnh

### Từ browser console (test thủ công)

```js
// 1. Lấy tracking hiện tại của order
const result = await fetchShipmentsByOrder(null, [4047674171]);
console.log('Tracking hiện tại:', result.shipments[0]?.tracking?.code);

// 2. Gửi tracking mới
await batchCompleteOrders(null, [{
    order_id: 4047674171,
    carrier: 4,
    tracking_number: '00340434775432605887'
}]);
```

### Từ server (qua Ably)

```js
// Publish message vào Ably channel
const ably = new Ably.Realtime('YOUR_ABLY_KEY');
const channel = ably.channels.get('your_shop_name');

await channel.publish('send-tracking', {
    clientId: 'extension-client-id',  // Lấy từ Dora Admin
    id: 123,                          // Tracking status ID
    shopId: 54076614,
    orders: [{
        order_id: 4047674171,
        carrier: 4,
        tracking_number: '00340434775432605887'
    }]
});
```
