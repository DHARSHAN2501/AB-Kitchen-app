import { 
  getOrders as ajaxGetOrders, 
  getOrderById as ajaxGetOrderById, 
  getCustomerOrders as ajaxGetCustomerOrders, 
  createOrder as ajaxCreateOrder, 
  updateOrderStatus as ajaxUpdateOrderStatus, 
  requestBill as ajaxRequestBill, 
  markBillPaid as ajaxMarkBillPaid,
  createOrderItems as ajaxCreateOrderItems
} from './api.js';
import { supabase, isSupabaseConfigured, localDB } from './supabase.js';

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
    let localList = [];
    try {
      localList = localDB.getOrders() || [];
    } catch (e) {}

    try {
      const remoteData = await ajaxGetOrders();
      if (remoteData && Array.isArray(remoteData)) {
        try {
          localDB.saveOrders(remoteData);
        } catch (e) {}
        return remoteData.sort((a, b) => {
          return new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now());
        });
      }
    } catch (e) {
      console.warn('AJAX getOrders failed, using localDB fallback:', e.message);
    }
    return localList;
  },

  getOrdersByTable: async (tableNumber) => {
    try {
      const data = await ajaxGetCustomerOrders(tableNumber);
      if (data && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {}
    const list = await orderService.getOrders();
    return list.filter(o => Number(o.table_number) === Number(tableNumber));
  },

  getOrderById: async (orderId) => {
    try {
      const data = await ajaxGetOrderById(orderId);
      if (data) return data;
    } catch (e) {}
    const list = await orderService.getOrders();
    return list.find(o => o.id === orderId || o.order_number === orderId);
  },

  createOrder: async (orderPayload) => {
    // 1. Create in localDB first to guarantee instant UI response & cross-tab BroadcastChannel events
    const localOrder = localDB.createOrder(orderPayload);

    // 2. Format items list for both JSONB storage and relational table
    const formattedItems = (orderPayload.items || []).map(i => ({
      menu_item_id: i.menu_item_id || i.menuItem?.id || '',
      item_name: i.item_name || i.menuItem?.name || 'Food Item',
      quantity: Number(i.quantity || 1),
      price: Number(i.price || i.menuItem?.price || 0),
      special_instruction: i.special_instruction || ''
    }));

    // 3. Insert into Supabase via AJAX REST API
    try {
      const dbOrderPayload = {
        id: localOrder.id,
        order_number: localOrder.order_number,
        table_number: Number(orderPayload.table_number),
        customer_name: orderPayload.customer_name || 'Guest Customer',
        subtotal: Number(orderPayload.subtotal || 0),
        tax: Number(orderPayload.tax || 0),
        total_amount: Number(orderPayload.total_amount || 0),
        order_status: 'PENDING',
        bill_status: 'NOT_REQUESTED',
        notes: orderPayload.notes || '',
        items: formattedItems
      };

      const res = await ajaxCreateOrder(dbOrderPayload);
      const insertedOrder = Array.isArray(res) ? res[0] : res;

      if (insertedOrder && formattedItems.length > 0) {
        const itemsToInsert = formattedItems.map(i => ({
          order_id: insertedOrder.id || localOrder.id,
          menu_item_id: i.menu_item_id,
          item_name: i.item_name,
          quantity: i.quantity,
          price: i.price,
          special_instruction: i.special_instruction
        }));
        await ajaxCreateOrderItems(itemsToInsert);
      }
    } catch (e) {
      console.warn('AJAX createOrder error:', e.message);
    }

    return localOrder;
  },

  updateOrderStatus: async (orderId, status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'CANCELLED' || s === 'CANCEL_REQUESTED') {
      const existing = await orderService.getOrderById(orderId);
      if (existing) {
        const isBulk = isBulkOrder(existing);
        const current = String(existing.order_status || '').toUpperCase();
        const bill = String(existing.bill_status || '').toUpperCase();
        if (current === 'SERVED' || current === 'DELIVERED' || current === 'COMPLETED' || bill === 'PAID') {
          console.warn('Cannot cancel an order that has already been served or delivered successfully.');
          return false;
        }
        if (isBulk && current !== 'PENDING' && current !== 'CANCEL_REQUESTED') {
          console.warn('Bulk orders in progress (ACCEPTED/PREPARING/READY/DISPATCHED) cannot be cancelled online. Contact Arunachala Bhavan: +65 8226 1646, +65 8452 1058');
          return false;
        }
      }
    }
    localDB.updateOrderStatus(orderId, status);
    try {
      await ajaxUpdateOrderStatus(orderId, status);
    } catch (e) {
      console.warn('AJAX updateOrderStatus error:', e.message);
    }
    return true;
  },

  requestBillForTable: async (tableNumber) => {
    const list = await orderService.getOrdersByTable(tableNumber);
    list.forEach(o => {
      if (o.bill_status !== 'PAID') {
        localDB.updateBillStatus(o.id, 'REQUESTED');
        ajaxRequestBill(o.id).catch(() => {});
      }
    });
    return true;
  },

  markBillAsPaid: async (orderId) => {
    localDB.updateBillStatus(orderId, 'PAID');
    try {
      await ajaxMarkBillPaid(orderId);
    } catch (e) {}
    return true;
  },

  subscribeToOrders: (callback) => {
    const cleanups = [];

    // Supabase Realtime Channel with Reconnect Reconciliation
    if (isSupabaseConfigured()) {
      try {
        let channelConnected = false;
        const sub = supabase
          .channel('public:orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            callback(payload);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              if (channelConnected) {
                // Reconnected after disconnect — reconcile fresh kitchen orders immediately
                orderService.getOrders().then(fresh => {
                  callback({ eventType: 'RECONNECT_RESYNC', orders: fresh });
                }).catch(() => {});
              }
              channelConnected = true;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              channelConnected = false;
            }
          });
        cleanups.push(() => supabase.removeChannel(sub));
      } catch (e) {}
    }

    // BroadcastChannel (Instant cross-tab real-time sync)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('smart_rest_bc_orders');
        bc.onmessage = (event) => {
          callback({ eventType: 'UPDATE', detail: event.data?.detail });
        };
        cleanups.push(() => bc.close());
      } catch (e) {}
    }

    // Local CustomEvent Listener
    const customListener = (e) => callback({ eventType: 'UPDATE', detail: e.detail });
    window.addEventListener('smart_rest_event_orders', customListener);
    cleanups.push(() => window.removeEventListener('smart_rest_event_orders', customListener));

    // Native Storage Event (Fires across all open browser tabs/apps)
    const storageListener = (e) => {
      if (e.key === 'smart_rest_orders') {
        callback({ eventType: 'UPDATE' });
      }
    };
    window.addEventListener('storage', storageListener);
    cleanups.push(() => window.removeEventListener('storage', storageListener));

    // Adaptive Ajax Auto-Refresh Interval (Fallback polling when tab is visible, passing data directly)
    let isPolling = false;
    const pollInterval = setInterval(async () => {
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
    }, 8000);
    cleanups.push(() => clearInterval(pollInterval));

    return () => {
      cleanups.forEach(fn => fn());
    };
  }
};
