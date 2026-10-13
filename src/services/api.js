import { safeStorage } from './supabase.js';

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL) || 'https://thsuvmauyksxiltzutwx.supabase.co';
const SUPABASE_KEY = (typeof import.meta !== 'undefined' && (import.meta?.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta?.env?.VITE_SUPABASE_ANON_KEY)) || 'sb_publishable_9EfDMt_QKs7oaYPYCp_h-w_to0VizR6';

// ==========================================
// LATEST-REQUEST-WINS REQUEST MANAGER
// ==========================================
class RequestManager {
  constructor() {
    this.controllers = new Map();
    this.requestCounters = new Map();
  }

  getSignal(requestKey, externalSignal = null) {
    if (!requestKey) return { signal: externalSignal, requestId: null, isLatest: () => true, cleanup: () => {} };

    if (this.controllers.has(requestKey)) {
      try {
        this.controllers.get(requestKey).abort();
      } catch (e) {}
    }

    const controller = new AbortController();
    this.controllers.set(requestKey, controller);

    const currentId = (this.requestCounters.get(requestKey) || 0) + 1;
    this.requestCounters.set(requestKey, currentId);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => {
          try { controller.abort(); } catch (e) {}
        });
      }
    }

    return {
      signal: controller.signal,
      requestId: currentId,
      isLatest: () => this.requestCounters.get(requestKey) === currentId,
      cleanup: () => {
        if (this.controllers.get(requestKey) === controller) {
          this.controllers.delete(requestKey);
        }
      }
    };
  }

  isAbortError(err) {
    return (
      err && (
        err.name === 'AbortError' || 
        (err.message === 'Failed to fetch' && err.signal?.aborted) ||
        String(err).includes('AbortError')
      )
    );
  }
}

export const requestManager = new RequestManager();

export async function supabaseRequest(endpoint, options = {}) {
  const { requestKey, signal: externalSignal, ...fetchOptions } = options;

  let requestHelper = null;
  let signalToUse = externalSignal;

  if (requestKey) {
    requestHelper = requestManager.getSignal(requestKey, externalSignal);
    signalToUse = requestHelper.signal;
  }

  let authHeader = `Bearer ${SUPABASE_KEY}`;
  try {
    const sessionStr = safeStorage.getItem('sb-thsuvmauyksxiltzutwx-auth-token') || safeStorage.getItem('smart_rest_auth_token');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session?.access_token) {
        authHeader = `Bearer ${session.access_token}`;
      }
    }
  } catch (e) {}

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: signalToUse,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": authHeader,
        "Prefer": "return=representation",
        ...(fetchOptions.headers || {})
      }
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.warn("Supabase API Warning:", { status: response.status, endpoint, data });
      throw new Error(data?.message || data?.details || `Supabase request failed: ${response.status}`);
    }

    if (requestHelper && !requestHelper.isLatest()) {
      const staleError = new Error('Stale response ignored in favor of newer request');
      staleError.name = 'AbortError';
      throw staleError;
    }

    if (requestHelper) requestHelper.cleanup();
    return data;
  } catch (err) {
    if (requestHelper) requestHelper.cleanup();
    if (requestManager.isAbortError(err)) {
      return null;
    }
    throw err;
  }
}

// ==========================================
// CATEGORY AJAX API
// ==========================================
export async function getCategories() {
  try {
    const items = await supabaseRequest("menu_items?select=category_id", { requestKey: "categories_fetch" });
    const uniqueCats = Array.from(new Set((items || []).map(i => i.category_id).filter(Boolean)));
    if (uniqueCats.length > 0) {
      return uniqueCats.map((name, idx) => ({ id: name, name: name, display_order: idx, is_active: true }));
    }
  } catch (e) {}
  return [];
}

export async function getAllCategories() {
  return getCategories();
}

export async function createCategory(category) { return category; }
export async function updateCategory(id, category) { return category; }
export async function deleteCategory(id) { return true; }

// ==========================================
// MENU ITEMS AJAX API (Cancellable Reads)
// ==========================================
export async function getMenuItems() {
  return supabaseRequest("menu_items?select=*&order=name.asc", { requestKey: "menu_items_list" });
}

export async function getAvailableMenuItems() {
  return supabaseRequest("menu_items?select=*&order=name.asc", { requestKey: "menu_items_available" });
}

export async function getAllMenuItems() {
  return supabaseRequest("menu_items?select=*&order=name.asc", { requestKey: "menu_items_all" });
}

export async function getMenuItemsByCategory(categoryId) {
  return supabaseRequest(`menu_items?select=*&category_id=eq.${encodeURIComponent(categoryId)}&order=name.asc`, { requestKey: `menu_items_cat_${categoryId}` });
}

export async function getMenuItem(menuItemId) {
  const data = await supabaseRequest(`menu_items?select=*&id=eq.${menuItemId}`, { requestKey: `menu_item_${menuItemId}` });
  return Array.isArray(data) ? data[0] : data;
}

export async function createMenuItem(item) {
  return supabaseRequest("menu_items", {
    method: "POST",
    body: JSON.stringify(item)
  });
}

export async function updateMenuItem(id, item) {
  return supabaseRequest(`menu_items?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(item)
  });
}

export async function deleteMenuItem(id) {
  return supabaseRequest(`menu_items?id=eq.${id}`, {
    method: "DELETE"
  });
}

// ==========================================
// ORDERS AJAX API (Cancellable Reads)
// ==========================================
export async function getOrders() {
  return supabaseRequest("orders?select=*&order=created_at.desc&limit=100", { requestKey: "orders_list" });
}

export async function getOrderById(orderId) {
  const data = await supabaseRequest(`orders?select=*&or=(id.eq.${orderId},order_number.eq.${orderId})`, { requestKey: `order_${orderId}` });
  return Array.isArray(data) ? data[0] : data;
}

export async function getCustomerOrders(tableNumber) {
  return supabaseRequest(`orders?select=*&table_number=eq.${tableNumber}`, { requestKey: `orders_table_${tableNumber}` });
}

export async function createOrder(orderPayload) {
  return supabaseRequest("orders", {
    method: "POST",
    body: JSON.stringify(orderPayload)
  });
}

export async function updateOrderStatus(orderId, status) {
  return supabaseRequest(`orders?or=(id.eq.${orderId},order_number.eq.${orderId})`, {
    method: "PATCH",
    body: JSON.stringify({ order_status: status })
  });
}

export async function requestBill(orderId) {
  return supabaseRequest(`orders?or=(id.eq.${orderId},order_number.eq.${orderId})`, {
    method: "PATCH",
    body: JSON.stringify({ bill_status: "REQUESTED" })
  });
}

export async function markBillPaid(orderId) {
  return supabaseRequest(`orders?or=(id.eq.${orderId},order_number.eq.${orderId})`, {
    method: "PATCH",
    body: JSON.stringify({ bill_status: "PAID" })
  });
}

// ==========================================
// ORDER ITEMS AJAX API
// ==========================================
export async function getOrderItems(orderId) {
  try {
    const order = await getOrderById(orderId);
    return order?.items || [];
  } catch (e) {
    return [];
  }
}

export async function createOrderItem(orderItem) { return orderItem; }
export async function createOrderItems(orderItems) { return orderItems; }

// ==========================================
// KITCHEN AJAX API
// ==========================================
export async function getPendingOrders() {
  return supabaseRequest("orders?select=*&order_status=eq.PENDING", { requestKey: "orders_pending" });
}

export async function getPreparingOrders() {
  return supabaseRequest("orders?select=*&order_status=eq.PREPARING", { requestKey: "orders_preparing" });
}

export async function getReadyOrders() {
  return supabaseRequest("orders?select=*&order_status=eq.READY", { requestKey: "orders_ready" });
}

export async function updateKitchenOrderStatus(orderId, status) {
  return supabaseRequest(`orders?id=eq.${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ order_status: status })
  });
}

// ==========================================
// TABLES & REVIEWS AJAX API
// ==========================================
export async function getTables() {
  return Array.from({ length: 20 }, (_, i) => ({ id: i + 1, table_number: i + 1, status: "AVAILABLE" }));
}
export async function createTable(tableData) { return tableData; }
export async function updateTable(id, tableData) { return tableData; }
export async function deleteTable(id) { return true; }

export async function getReviews() { return []; }
export async function createReview(reviewData) { return reviewData; }
export async function deleteReview(id) { return true; }
