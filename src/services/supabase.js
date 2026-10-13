
const memoryStore = new Map();

export const safeStorage = {
  getItem: (key) => {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {}
    return memoryStore.get(key) || null;
  },
  setItem: (key, val) => {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {}
    memoryStore.set(key, val);
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
    memoryStore.delete(key);
  }
};
import { createClient } from '@supabase/supabase-js';

const REAL_SUPABASE_URL = 'https://thsuvmauyksxiltzutwx.supabase.co';
const REAL_SUPABASE_KEY = 'sb_publishable_9EfDMt_QKs7oaYPYCp_h-w_to0VizR6';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://sample-restaurant.supabase.co') 
  ? import.meta.env.VITE_SUPABASE_URL 
  : REAL_SUPABASE_URL;

const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta?.env?.VITE_SUPABASE_ANON_KEY || import.meta?.env?.VITE_SUPABASE_PUBLISHABLE_KEY))
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) 
  : REAL_SUPABASE_KEY;

export const isSupabaseConfigured = () => true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: safeStorage, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

const INITIAL_ORDERS = [];

const INITIAL_EMPLOYEES = [];

const INITIAL_ATTENDANCE = [];

const getStore = (key, init) => {
  try {
    const data = safeStorage.getItem(`smart_rest_${key}`);
    if (!data) return init;
    const parsed = JSON.parse(data);
    if (key === 'orders' && Array.isArray(parsed)) {
      const sanitized = parsed.filter(o => {
        const idStr = String(o.id || o.order_number || '').toLowerCase();
        const cust = String(o.customer_name || '').toLowerCase();
        return idStr !== 'ord-1024' && idStr !== 'ord1024' && idStr !== 'ord-1023' && idStr !== 'ord1023' && cust !== 'rahul s.' && cust !== 'anita m.';
      });
      if (sanitized.length !== parsed.length) {
        safeStorage.setItem('smart_rest_orders', JSON.stringify(sanitized));
        return sanitized;
      }
      return sanitized;
    }
    if (key === 'menu_items' && Array.isArray(parsed)) {
      const sanitized = parsed.map(item => {
        if (item.name && item.name.includes('Mock ')) {
          return { ...item, name: item.name.replace(/Mock /g, 'Soya ') };
        }
        return item;
      });
      return sanitized;
    }
    return parsed;
  } catch (e) {
    return init;
  }
};

const setStore = (key, data) => {
  try {
    safeStorage.setItem(`smart_rest_${key}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(`smart_rest_event_${key}`, { detail: data }));
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(`smart_rest_bc_${key}`);
        bc.postMessage({ type: 'UPDATE', detail: data });
        bc.close();
      } catch (e) {}
    }
  } catch (e) {}
};

export const localDB = {
  getOrders: () => getStore('orders', INITIAL_ORDERS),
  saveOrders: (ordersList) => setStore('orders', ordersList || []),
  updateOrderStatus: (orderId, order_status) => {
    const list = getStore('orders', INITIAL_ORDERS);
    const matchKey = String(orderId || '').toLowerCase();
    const updated = list.map(o => {
      const idStr = String(o.id || '').toLowerCase();
      const numStr = String(o.order_number || '').toLowerCase();
      return (idStr === matchKey || numStr === matchKey || matchKey.includes(numStr)) ? { ...o, order_status } : o;
    });
    setStore('orders', updated);
    return updated;
  },

  // Employees & Attendance
  getEmployees: () => getStore('employees', INITIAL_EMPLOYEES),
  getAttendance: () => getStore('attendance', INITIAL_ATTENDANCE),
  recordEmployeeLogin: (employeeName) => {
    const list = getStore('attendance', INITIAL_ATTENDANCE);
    const now = new Date();
    const newEntry = {
      id: `att-${Date.now()}`,
      employee_name: employeeName,
      date: now.toISOString().split('T')[0],
      login_time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      logout_time: null,
      status: 'ACTIVE'
    };
    const updated = [newEntry, ...list];
    setStore('attendance', updated);
    return newEntry;
  },
  recordEmployeeLogout: (attendanceId, employeeName) => {
    const list = getStore('attendance', INITIAL_ATTENDANCE);
    const now = new Date();
    const logoutTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updated = list.map(att => {
      if (att.id === attendanceId || (att.employee_name === employeeName && att.status === 'ACTIVE')) {
        return { ...att, logout_time: logoutTimeStr, status: 'COMPLETED' };
      }
      return att;
    });
    setStore('attendance', updated);
    return updated;
  }
};
