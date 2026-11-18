import {
  getOrders as ajaxGetOrders,
  updateOrderStatus as ajaxUpdateOrderStatus
} from './api.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

let cachedKitchenOrders = null;

function sortOrdersDesc(list) {
  return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function applyRealtimeOrderChange(currentList, payload) {
  if (!Array.isArray(currentList) || !payload) return null;
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'DELETE') {
    const delId = oldRow?.id;
    return delId ? currentList.filter(o => o.id !== delId) : null;
  }

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (!newRow || !newRow.id) return null;
    const idx = currentList.findIndex(o => o.id === newRow.id || (o.order_number && o.order_number === newRow.order_number));
    if (idx >= 0) {
      const next = [...currentList];
      next[idx] = { ...next[idx], ...newRow };
      return next;
    }
    return sortOrdersDesc([newRow, ...currentList]);
  }

  return null;
}

// Helper to identify bulk order (Home Delivery or >= 25 items or is_bulk flag)
export const isBulkOrder = (order) => {
  if (!order) return false;
  if (order.is_bulk === true || String(order.is_bulk) === 'true') return true;
  if (order.order_type === 'HOME_DELIVERY') return true;
  if (Number(order.table_number) === 0) return true;
  if (order.delivery_address && String(order.delivery_address).trim().length > 0) return true;
  const rawItems = Array.isArray(order.items)
    ? order.items
    : (typeof order.items === 'string' ? JSON.parse(order.items || '[]') : []);
  const count = rawItems.reduce((acc, it) => acc + Number(it.quantity || it.qty || 1), 0);
  return count >= 25;
};

export const orderService = {
  getOrders: async () => {
    try {
      const remoteData = await ajaxGetOrders();
      if (remoteData && Array.isArray(remoteData)) {
        cachedKitchenOrders = sortOrdersDesc(remoteData);
        return cachedKitchenOrders;
      }
    } catch (e) {
      console.warn('AJAX getOrders error:', e.message);
    }
    return cachedKitchenOrders || [];
  },

  updateOrderStatus: async (orderId, status) => {
    const res = await ajaxUpdateOrderStatus(orderId, status);
    const updatedRow = Array.isArray(res) ? res[0] : res;
    if (Array.isArray(cachedKitchenOrders)) {
      cachedKitchenOrders = cachedKitchenOrders.map(o =>
        (o.id === orderId || o.order_number === orderId)
          ? { ...o, ...(updatedRow || {}), order_status: status }
          : o
      );
    }
    return updatedRow || { id: orderId, order_status: status };
  },

  subscribeToOrders: (callback) => {
    const cleanups = [];
    let isRealtimeSubscribed = false;
    let hasConnectedOnce = false;

    if (isSupabaseConfigured()) {
      try {
        const sub = supabase
          .channel('public:orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            const patched = applyRealtimeOrderChange(cachedKitchenOrders, payload);
            if (patched) {
              cachedKitchenOrders = patched;
              callback({ eventType: payload.eventType, new: payload.new, old: payload.old, orders: patched });
            } else {
              callback(payload);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              isRealtimeSubscribed = true;
              if (hasConnectedOnce) {
                orderService.getOrders().then(fresh => {
                  callback({ eventType: 'RECONNECT_RESYNC', orders: fresh });
                }).catch(() => {});
              }
              hasConnectedOnce = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              isRealtimeSubscribed = false;
            }
          });
        cleanups.push(() => supabase.removeChannel(sub));
      } catch (e) {}
    }

    // Fallback poll runs ONLY when WebSocket Realtime is not SUBSCRIBED and tab is visible
    let isPolling = false;
    const pollInterval = setInterval(async () => {
      if (isRealtimeSubscribed) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isPolling) return;
      isPolling = true;
      try {
        const fresh = await orderService.getOrders();
        callback({ eventType: 'POLL_REFRESH', orders: fresh });
      } catch (e) {
      } finally {
        isPolling = false;
      }
    }, 25000);
    cleanups.push(() => clearInterval(pollInterval));

    return () => {
      cleanups.forEach(fn => fn());
    };
  }
};
