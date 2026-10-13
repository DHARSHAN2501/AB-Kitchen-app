import React, { useState, useEffect } from 'react';
import { orderService } from '../services/orderService';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { 
  CheckCircle2, 
  Utensils, 
  XCircle, 
  Truck, 
  MapPin, 
  Phone,
  PackageCheck,
  ChefHat
} from 'lucide-react';

import { FEMALE_CHEF_IMAGE_BASE64 } from '../assets/female_chef_b64';

export const KitchenDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playChimeSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('Play chime error:', e);
    }
  };

  const loadOrders = async () => {
    const data = await orderService.getOrders();
    setOrders(data || []);
  };

  const playedOrderIdsRef = React.useRef(new Set());
  const initialLoadedRef = React.useRef(false);

  useEffect(() => {
    const fetchInitial = async () => {
      const data = await orderService.getOrders();
      if (data) {
        setOrders(data);
        data.forEach(o => {
          if (o.id) playedOrderIdsRef.current.add(String(o.id));
          if (o.order_number) playedOrderIdsRef.current.add(String(o.order_number));
        });
        initialLoadedRef.current = true;
      }
    };
    fetchInitial();

    const unsub = orderService.subscribeToOrders(async (payload) => {
      const updated = payload?.orders || await orderService.getOrders();
      if (!updated) return;

      if (initialLoadedRef.current) {
        let hasBrandNewOrder = false;
        updated.forEach(o => {
          const key = String(o.id || o.order_number || '');
          const isPending = String(o.order_status || '').toUpperCase() === 'PENDING';
          if (key && isPending && !playedOrderIdsRef.current.has(key)) {
            hasBrandNewOrder = true;
            playedOrderIdsRef.current.add(key);
          }
        });

        if (hasBrandNewOrder && soundEnabled) {
          playChimeSound();
        }
      } else {
        updated.forEach(o => {
          if (o.id) playedOrderIdsRef.current.add(String(o.id));
          if (o.order_number) playedOrderIdsRef.current.add(String(o.order_number));
        });
      }

      setOrders(updated);
    });

    return () => unsub();
  }, [soundEnabled]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (newStatus === 'CANCELLED') {
      const target = orders.find(o => o.id === orderId || o.order_number === orderId);
      if (target) {
        const isBulk = checkIsBulkOrder(target);
        const s = String(target.order_status || '').toUpperCase();
        if (s === 'SERVED' || s === 'DELIVERED' || s === 'COMPLETED' || String(target.bill_status || '').toUpperCase() === 'PAID') {
          return;
        }
        if (isBulk && s !== 'PENDING' && s !== 'CANCEL_REQUESTED') {
          return;
        }
      }
    }
    await orderService.updateOrderStatus(orderId, newStatus);
    const data = await orderService.getOrders();
    if (data) setOrders(data);
  };

  // Order filters memoized for optimal React rendering performance
  const checkIsHomeDelivery = (o) => {
    return o.order_type === 'HOME_DELIVERY' || Number(o.table_number) === 0 || Boolean(o.delivery_address && String(o.delivery_address).trim().length > 0);
  };

  const checkIsBulkOrder = (o) => {
    if (!o) return false;
    if (o.is_bulk === true || String(o.is_bulk) === 'true') return true;
    if (checkIsHomeDelivery(o)) return true;
    const rawItems = Array.isArray(o.items)
      ? o.items
      : (typeof o.items === 'string' ? JSON.parse(o.items || '[]') : []);
    const count = rawItems.reduce((acc, it) => acc + Number(it.quantity || it.qty || 1), 0);
    return count >= 25;
  };

  const { newOrders, preparingOrders, readyOrders, homeDeliveryOrders, cancelledOrders, displayedOrders } = React.useMemo(() => {
    const newOrds = orders.filter(o => String(o.order_status || '').toUpperCase() === 'PENDING');
    const prepOrds = orders.filter(o => {
      const s = String(o.order_status || '').toUpperCase();
      return s === 'ACCEPTED' || s === 'PREPARING';
    });
    const readyOrds = orders.filter(o => String(o.order_status || '').toUpperCase() === 'READY');
    const homeOrds = orders.filter(o => {
      const s = String(o.order_status || '').toUpperCase();
      return checkIsHomeDelivery(o) && s !== 'COMPLETED' && s !== 'SERVED' && s !== 'CANCELLED';
    });
    const cancelOrds = orders.filter(o => {
      const s = String(o.order_status || '').toUpperCase();
      return s === 'CANCELLED' || s === 'CANCEL_REQUESTED';
    });

    const dispOrds = 
      activeTab === 'NEW' ? newOrds :
      activeTab === 'PREPARING' ? prepOrds :
      activeTab === 'READY' ? readyOrds :
      activeTab === 'HOME_DELIVERY' ? homeOrds :
      activeTab === 'CANCELLED' ? cancelOrds :
      orders.filter(o => {
        const s = String(o.order_status || '').toUpperCase();
        return s !== 'COMPLETED' && s !== 'SERVED' && s !== 'CANCELLED';
      });

    return {
      newOrders: newOrds,
      preparingOrders: prepOrds,
      readyOrders: readyOrds,
      homeDeliveryOrders: homeOrds,
      cancelledOrders: cancelOrds,
      displayedOrders: dispOrds
    };
  }, [orders, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Brand Header Bar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs mb-6">
        <div className="h-1.5 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-700 w-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-slate-900 via-blue-900 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-slate-950 text-lg sm:text-2xl tracking-tight leading-none">
                Arunachala <span className="text-blue-700">Bhavan</span>
              </h1>
              <p className="text-xs text-blue-700 font-bold flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Kitchen
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white rounded-3xl p-5 sm:p-6 border border-slate-800/80 shadow-xl flex flex-row items-center justify-between gap-4">
          {/* Left Content Area */}
          <div className="z-10 space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Kitchen Display
            </h1>
            <p className="text-blue-200/80 text-xs font-medium mt-0.5">Real-time order fulfillment & dispatch monitor</p>
          </div>

          {/* Right Image Area (Increased Size) */}
          <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 shrink-0 flex items-center justify-center -my-6 -mr-4 sm:-my-8 sm:-mr-6 relative">
            <img 
              src={FEMALE_CHEF_IMAGE_BASE64} 
              alt="Kitchen Female Chef" 
              className="w-full h-full object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] hover:scale-105 transition duration-300 transform scale-110"
            />
          </div>
        </div>

      {/* 5 KPI METRICS CARDS (ROW 1: NEW & PREPARING | ROW 2: READY & CANCELLED | ROW 3: FULL WIDTH HOME DELIVERY) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: NEW ORDERS */}
        <div 
          onClick={() => setActiveTab('NEW')} 
          className={`rounded-3xl p-4 border shadow-md cursor-pointer transition duration-300 text-white ${
            activeTab === 'NEW' 
              ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 border-amber-300 ring-4 ring-amber-500/30 scale-102' 
              : 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400/80 hover:brightness-110'
          }`}
        >
          <span className="text-[11px] font-black uppercase tracking-wider block text-amber-100 flex items-center justify-between">
            <span>NEW ORDERS</span>
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs inline-block animate-pulse" />
          </span>
          <span className="text-3xl font-black text-white mt-2 block tracking-tight">{newOrders.length}</span>
        </div>

        {/* Card 2: PREPARING */}
        <div 
          onClick={() => setActiveTab('PREPARING')} 
          className={`rounded-3xl p-4 border shadow-md cursor-pointer transition duration-300 text-white ${
            activeTab === 'PREPARING' 
              ? 'bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-900 border-blue-300 ring-4 ring-blue-500/30 scale-102' 
              : 'bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 border-blue-500/80 hover:brightness-110'
          }`}
        >
          <span className="text-[11px] font-black uppercase tracking-wider block text-blue-100 flex items-center justify-between">
            <span>PREPARING</span>
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs inline-block animate-pulse" />
          </span>
          <span className="text-3xl font-black text-white mt-2 block tracking-tight">{preparingOrders.length}</span>
        </div>

        {/* Card 3: READY TO SERVE */}
        <div 
          onClick={() => setActiveTab('READY')} 
          className={`rounded-3xl p-4 border shadow-md cursor-pointer transition duration-300 text-white ${
            activeTab === 'READY' 
              ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 border-emerald-300 ring-4 ring-emerald-500/30 scale-102' 
              : 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 border-emerald-500/80 hover:brightness-110'
          }`}
        >
          <span className="text-[11px] font-black uppercase tracking-wider block text-emerald-100 flex items-center justify-between">
            <span>READY</span>
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs inline-block animate-pulse" />
          </span>
          <span className="text-3xl font-black text-white mt-2 block tracking-tight">{readyOrders.length}</span>
        </div>

        {/* Card 4: CANCELLED */}
        <div 
          onClick={() => setActiveTab('CANCELLED')} 
          className={`rounded-3xl p-4 border shadow-md cursor-pointer transition duration-300 text-white ${
            activeTab === 'CANCELLED' 
              ? 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-800 border-rose-300 ring-4 ring-rose-500/30 scale-102' 
              : 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 border-rose-500/80 hover:brightness-110'
          }`}
        >
          <span className="text-[11px] font-black uppercase tracking-wider block text-rose-100 flex items-center justify-between">
            <span>CANCELLED</span>
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs inline-block animate-pulse" />
          </span>
          <span className="text-3xl font-black text-white mt-2 block tracking-tight">{cancelledOrders.length}</span>
        </div>

        {/* Card 5: HOME DELIVERY (SPANS FULL ROW WIDTH = 2 COLUMNS) */}
        <div 
          onClick={() => setActiveTab('HOME_DELIVERY')} 
          className={`col-span-2 rounded-3xl p-4 border shadow-md cursor-pointer transition duration-300 text-white flex items-center justify-between ${
            activeTab === 'HOME_DELIVERY' 
              ? 'bg-gradient-to-r from-purple-600 via-indigo-700 to-cyan-700 border-cyan-300 ring-4 ring-cyan-500/30 scale-101' 
              : 'bg-gradient-to-r from-purple-700 via-indigo-800 to-cyan-800 border-purple-400/80 hover:brightness-110'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
              <Truck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider block text-cyan-200">
                HOME DELIVERY ORDERS
              </span>
              <p className="text-[10px] text-cyan-100 font-medium">Bulk Home Delivery Dispatches</p>
            </div>
          </div>
          <span className="text-3xl font-black text-white tracking-tight">{homeDeliveryOrders.length}</span>
        </div>
      </div>



      {/* Orders Grid */}
      <div className="row g-4">
        {displayedOrders.length === 0 ? (
          <div className="col-12 py-12 text-center text-slate-400 font-extrabold text-sm">
            No orders found in this category.
          </div>
        ) : (
          displayedOrders.map(order => {
            const isHomeDelivery = checkIsHomeDelivery(order);
            const isPending = order.order_status === 'PENDING';
            const isPreparing = order.order_status === 'PREPARING' || order.order_status === 'ACCEPTED';
            const isReady = order.order_status === 'READY';

            const cardBgClass = 
              isHomeDelivery ? 'bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-blue-50/60 border-2 border-indigo-200/90 shadow-md' :
              isPending ? 'bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/70 border-2 border-amber-300/80 shadow-md' :
              isPreparing ? 'bg-gradient-to-br from-blue-50 via-indigo-50/90 to-cyan-50/70 border-2 border-blue-300/80 shadow-md' :
              isReady ? 'bg-gradient-to-br from-emerald-50 via-teal-50/90 to-emerald-100/70 border-2 border-emerald-300/80 shadow-md' :
              'bg-gradient-to-br from-rose-50 via-red-50/90 to-pink-50/70 border-2 border-rose-300/80 shadow-md';

            const tableBadgeClass =
              isPending ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs' :
              isPreparing ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs' :
              isReady ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' :
              'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xs';

            const itemBoxClass =
              isHomeDelivery ? 'bg-white/95 backdrop-blur-sm border border-indigo-200/80' :
              isPending ? 'bg-white/95 backdrop-blur-sm border border-amber-200/80' :
              isPreparing ? 'bg-white/95 backdrop-blur-sm border border-blue-200/80' :
              isReady ? 'bg-white/95 backdrop-blur-sm border border-emerald-200/80' :
              'bg-white/95 backdrop-blur-sm border border-rose-200/80';

            return (
              <div key={order.id} className="col-12 col-md-6 col-lg-4">
                <div className={`rounded-3xl border-2 shadow-lg p-5 flex flex-col justify-between h-100 space-y-4 transition duration-300 ${cardBgClass}`}>
                  <div>
                    {/* Top Row: Order Type Badge & Status Badge Side-by-Side */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5 mb-2.5">
                      {isHomeDelivery ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-purple-700 via-indigo-700 to-cyan-600 text-white shadow-xs whitespace-nowrap">
                          <Truck className="w-3.5 h-3.5 text-cyan-300" /> Home Delivery
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full ${tableBadgeClass} whitespace-nowrap`}>
                          <Utensils className="w-3.5 h-3.5" /> Table {String(order.table_number || 0).padStart(2, '0')}
                        </span>
                      )}
                      <StatusBadge status={order.order_status} />
                    </div>

                    {/* Order Number on its own clean line */}
                    <h3 className="font-black text-slate-950 text-base tracking-tight mb-3">{order.order_number}</h3>

                    {/* Bulk Delivery Info Card */}
                    {isHomeDelivery && (
                      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 border border-indigo-800/80 mb-3 space-y-2 shadow-xs">
                        <div className="text-[10px] font-black text-cyan-300 uppercase tracking-wider flex items-center justify-between border-b border-indigo-900/80 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-cyan-400" /> Bulk Delivery Details
                          </span>
                          <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md text-[9px] font-extrabold border border-cyan-500/30">
                            Bulk Order
                          </span>
                        </div>
                        <div className="text-xs space-y-1.5 font-semibold">
                          <div className="flex items-center justify-between text-slate-200">
                            <span className="text-indigo-300 text-[11px]">Customer:</span>
                            <span className="font-black text-white bg-indigo-900/80 px-2 py-0.5 rounded-lg border border-indigo-700/70">{order.customer_name || 'Home Guest'}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-200">
                            <span className="text-indigo-300 text-[11px] flex items-center gap-1">
                              <Phone className="w-3 h-3 text-cyan-400" /> Phone:
                            </span>
                            <span className="font-extrabold text-cyan-200">{order.phone_number || 'N/A'}</span>
                          </div>
                          <div className="flex items-start gap-1.5 text-indigo-200 pt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span className="leading-snug text-[11px] text-white font-medium">{order.delivery_address || 'Delivery Address'} {order.postal_code ? `(Postal: ${order.postal_code})` : ''}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <div className="bg-white/95 backdrop-blur-sm text-slate-800 text-xs p-2.5 rounded-2xl border border-slate-200/80 mb-3 font-medium shadow-2xs">
                        Note: "{order.notes}"
                      </div>
                    )}

                    <div className="space-y-2">
                      {order.items?.map((it, idx) => (
                        <div key={idx} className={`p-2.5 rounded-2xl flex justify-between items-start text-xs shadow-2xs ${itemBoxClass}`}>
                          <div>
                            <span className="font-extrabold text-slate-900">{it.item_name}</span>
                            {it.special_instruction && <div className="text-[10px] text-indigo-700 font-semibold italic mt-0.5">"{it.special_instruction}"</div>}
                          </div>
                          <span className="bg-slate-950 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-xs shrink-0">× {it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-200/70 flex flex-col gap-2">
                    {order.order_status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="flex-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-98 transition">
                          <CheckCircle2 className="w-4 h-4" /> Accept Order
                        </button>
                        <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} className="bg-rose-100 hover:bg-rose-200 text-rose-700 p-2.5 rounded-2xl text-xs font-bold border border-rose-300 transition">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {order.order_status === 'CANCEL_REQUESTED' && (
                      <div className="space-y-2">
                        <div className="bg-rose-100/90 border border-rose-300 text-rose-900 text-xs font-bold p-2.5 rounded-2xl text-center animate-pulse shadow-2xs">
                          🚫 Customer Requested Cancellation
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateStatus(order.id, 'CANCELLED')} className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 transition">
                            <XCircle className="w-4 h-4" /> Approve Cancel
                          </button>
                          <button onClick={() => handleUpdateStatus(order.id, 'PREPARING')} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1 transition">
                            Keep Order
                          </button>
                        </div>
                      </div>
                    )}

                    {order.order_status === 'CANCELLED' && (
                      <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-black p-2.5 rounded-2xl text-center shadow-md">
                        ❌ Order Cancelled
                      </div>
                    )}

                    {(order.order_status === 'PREPARING' || order.order_status === 'ACCEPTED') && (
                      <button onClick={() => handleUpdateStatus(order.id, 'READY')} className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-98 transition">
                        {isHomeDelivery ? <PackageCheck className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                        <span>{isHomeDelivery ? 'Mark Packed for Home Delivery' : 'Mark Food Ready'}</span>
                      </button>
                    )}

                    {order.order_status === 'READY' && (
                      <button onClick={() => handleUpdateStatus(order.id, 'SERVED')} className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 active:scale-98 transition">
                        {isHomeDelivery ? <Truck className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>{isHomeDelivery ? 'Mark Dispatched / Delivered' : 'Mark Served by Staff'}</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
};

export default KitchenDashboard;
