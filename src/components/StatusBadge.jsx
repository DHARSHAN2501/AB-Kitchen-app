import React from 'react';

export const StatusBadge = ({ status }) => {
  switch (status) {
    case 'PENDING': 
      return <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-[11px] px-2.5 py-1 rounded-full font-black shadow-2xs shrink-0 whitespace-nowrap">🟡 Order Placed</span>;
    case 'ACCEPTED': 
      return <span className="bg-blue-100 text-blue-900 border border-blue-300/80 text-[11px] px-2.5 py-1 rounded-full font-black shadow-2xs shrink-0 whitespace-nowrap">🔵 Accepted</span>;
    case 'PREPARING': 
      return <span className="bg-orange-100 text-orange-900 border border-orange-300/80 text-[11px] px-2.5 py-1 rounded-full font-black animate-pulse shadow-2xs shrink-0 whitespace-nowrap">🔥 Preparing</span>;
    case 'READY': 
      return <span className="bg-emerald-100 text-emerald-900 border border-emerald-300/80 text-[11px] px-2.5 py-1 rounded-full font-black shadow-2xs shrink-0 whitespace-nowrap">🟢 Food Ready</span>;
    case 'SERVED': 
      return <span className="bg-purple-100 text-purple-900 border border-purple-300/80 text-[11px] px-2.5 py-1 rounded-full font-black shadow-2xs shrink-0 whitespace-nowrap">💜 Served</span>;
    case 'CANCEL_REQUESTED': 
      return <span className="bg-rose-100 text-rose-900 border border-rose-300/80 text-[11px] px-2.5 py-1 rounded-full font-black animate-pulse shadow-2xs shrink-0 whitespace-nowrap">🚫 Cancel Requested</span>;
    case 'CANCELLED': 
      return <span className="bg-rose-100 text-rose-900 border border-rose-300/80 text-[11px] px-2.5 py-1 rounded-full font-black shadow-2xs shrink-0 whitespace-nowrap">❌ Cancelled</span>;
    default: 
      return <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[11px] px-2.5 py-1 rounded-full font-bold shrink-0 whitespace-nowrap">{status}</span>;
  }
};

export default StatusBadge;
