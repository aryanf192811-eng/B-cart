import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ShoppingCart, Truck, Factory, Activity, CheckCircle2, Radar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

import { api } from '../api/client';
import { E } from '../api/endpoints';
import { useAuth } from '../store/auth';
import { useSocket } from '../hooks/useSocket';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Tooltip from '../components/Tooltip';

// Map alert entity_type → frontend route
function getAlertLink(alert) {
  const id = alert.entity_id;
  switch (alert.entity_type) {
    case 'product':      return `/products/${id}`;
    case 'work_center':  return `/intelligence/bottlenecks`;
    case 'sales_order':  return `/sales/${id}`;
    case 'vendor':       return `/intelligence/vendors`;
    default:             return `/intelligence/procurement`;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState('sales');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const int = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(int);
  }, []);

  const { data: kpiData, refetch: refetchKpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const { data } = await api.get(E.kpis());
      return data;
    }
  });

  const { data: alertData, refetch: refetchAlerts } = useQuery({
    queryKey: ['control-tower-alerts'],
    queryFn: async () => {
      const { data } = await api.get(E.controlTower());
      return data.alerts?.slice(0, 5) || []; // top 5
    }
  });

  // Fetch recent items for active tab
  const { data: tabData, refetch: refetchTab } = useQuery({
    queryKey: ['dashboard-recent', activeTab],
    queryFn: async () => {
      // Need a recent items endpoint, assuming /sales?limit=8 etc exists.
      // We will map based on activeTab.
      let endpoint = '';
      if (activeTab === 'sales') endpoint = `${E.sales()}?limit=8`;
      if (activeTab === 'purchase') endpoint = `${E.purchase()}?limit=8`;
      if (activeTab === 'manufacturing') endpoint = `${E.mo()}?limit=8`;
      const res = await api.get(endpoint);
      const rows = res.data.rows || res.data;
      return rows.filter(i => !['fully_delivered', 'fully_received', 'done', 'cancelled'].includes(i.status)).slice(0, 8);
    }
  });

  // Socket listener
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      // Refetch data slightly debounced
      setTimeout(() => {
        refetchKpis();
        refetchAlerts();
        refetchTab();
      }, 500);

      // Toast notification
      toast(
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(data.link || '/')}>
          <div className="w-1.5 h-1.5 rounded-full bg-rust"></div>
          <div>
            <span className="font-mono text-[12px] font-bold">{data.ref}</span> {data.action}
          </div>
        </div>,
        { duration: 4000 }
      );
    };

    socket.on('sales:update', handleUpdate);
    socket.on('purchase:update', handleUpdate);
    socket.on('mo:update', handleUpdate);

    return () => {
      socket.off('sales:update', handleUpdate);
      socket.off('purchase:update', handleUpdate);
      socket.off('mo:update', handleUpdate);
    };
  }, [socket, refetchKpis, refetchAlerts, refetchTab, navigate]);

  // Derived state
  const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const alertsCount = alertData?.length || 0;

  // Stat blocks data parsing
  const counts = kpiData || { sales: {}, purchase: {}, manufacturing: {}, inventory: {} };
  const openSO = parseInt(counts.sales?.draft || 0) + parseInt(counts.sales?.confirmed || 0) + parseInt(counts.sales?.partially_delivered || 0);
  const openPO = parseInt(counts.purchase?.draft || 0) + parseInt(counts.purchase?.confirmed || 0) + parseInt(counts.purchase?.partially_received || 0);
  const activeMO = parseInt(counts.manufacturing?.in_progress || 0) + parseInt(counts.manufacturing?.to_close || 0);
  const lowStock = parseInt(counts.inventory?.low_stock_count || 0);

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* ROW 1: Control Tower Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-ink text-white shadow-xl min-h-[220px] flex">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop')" }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-r from-rust/95 via-rust/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent"></div>

        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center w-full">
          <div className="max-w-md">
            <div className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#198754] animate-pulse"></span>
              SYSTEM LIVE • {seconds}s AGO
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2 drop-shadow-sm">
              Good {timeOfDay}, {user?.name?.split(' ')[0] || 'Admin'}.
            </h1>
            <p className="text-[15px] text-white/90 drop-shadow-sm">
              {alertsCount > 0
                ? `There are currently ${alertsCount} items demanding your attention across the supply chain.`
                : 'All automated systems are stable. No active bottlenecks detected.'}
            </p>
          </div>

          {/* Glassmorphic Actions */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-4 flex flex-col justify-between min-w-[140px]">
              <div className="text-[12px] font-medium text-white/80 uppercase tracking-wide">Active Alerts</div>
              <div className="text-[32px] font-bold mt-1 text-white">{alertsCount}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-4 flex flex-col justify-between min-w-[140px]">
              <div className="text-[12px] font-medium text-white/80 uppercase tracking-wide">System Status</div>
              <div className="text-[16px] font-bold mt-3 text-success">Optimal</div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-block cursor-pointer hover:border-ink transition-colors" onClick={() => navigate('/sales')}>
          <div className="stat-label flex items-center justify-between">
            <div className="flex items-center gap-1.5"><ShoppingCart size={12} /> Sales · open</div>
            <Tooltip content="Total count of Sales Orders in draft, confirmed, or partially_delivered status. Calculated dynamically from sales_orders table." />
          </div>
          <div className="stat-value">{openSO}</div>
          <div className="stat-delta">late: {counts.sales?.late || 0} | rev: ₹{parseFloat(counts.sales?.revenue || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-block cursor-pointer hover:border-ink transition-colors" onClick={() => navigate('/purchase')}>
          <div className="stat-label flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Truck size={12} /> Purchase · open</div>
            <Tooltip content="Total count of Purchase Orders in draft, confirmed, or partially_received status. Revenue reflects 'total_amount' dynamically fetched from views." />
          </div>
          <div className="stat-value">{openPO}</div>
          <div className="stat-delta">rcvd: {counts.purchase?.total_received_qty || 0} | rej: {counts.purchase?.total_rejected_qty || 0}</div>
        </div>
        <div className="stat-block cursor-pointer hover:border-ink transition-colors" onClick={() => navigate('/manufacturing')}>
          <div className="stat-label flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Factory size={12} /> Manufacturing · active</div>
            <Tooltip content="Total count of active MOs (in_progress or to_close). Blocked MOs are those where required components exceed available on_hand_qty." />
          </div>
          <div className="stat-value">{activeMO}</div>
          <div className="stat-delta">late: {counts.manufacturing?.late || 0}</div>
        </div>
        <div className="stat-block cursor-pointer hover:border-ink transition-colors" onClick={() => navigate('/products?low_stock=true')}>
          <div className="stat-label flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Activity size={12} /> Inventory · low stock</div>
            <Tooltip content="Count of products where dynamically calculated on_hand_qty < min_stock_qty. Updated instantly via the stock_ledger." />
          </div>
          <div className="stat-value text-danger">{lowStock}</div>
          <div className="stat-delta">needs attention</div>
        </div>
      </div>

      {/* ROW 3: Split columns */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* LEFT: Operations queue */}
        <div className="card w-full lg:w-[60%] flex flex-col h-[400px]">
          <div className="px-6 py-4 border-b-[0.5px] border-rule flex justify-between items-center">
            <h2 className="font-semibold text-ink">Operations queue</h2>
          </div>
          <div className="tabs px-2 pt-2">
            {[
              { id: 'sales', label: 'Sales' },
              { id: 'purchase', label: 'Purchase' },
              { id: 'manufacturing', label: 'Manufacturing' }
            ].map(t => (
              <div
                key={t.id}
                className={`tab ${activeTab === t.id ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            <DataTable
              loading={!tabData && kpiData !== undefined} // simulate loading if refetching
              rows={tabData || []}
              columns={[
                { key: activeTab === 'sales' ? 'so_number' : activeTab === 'purchase' ? 'po_number' : 'mo_number', label: 'REF', render: (r) => <span className="font-mono">{r.so_number || r.po_number || r.mo_number || r.soNumber || r.poNumber || r.moNumber}</span> },
                { key: 'counterparty', label: 'COUNTERPARTY', render: (r) => r.customer_name || r.vendor_name || r.product_name || r.customerName || r.vendorName || r.finishedProduct?.name || 'Unknown' },
                { key: 'createdAt', label: 'DATE', render: (r) => <span className="text-steel">{format(new Date(r.created_at || r.createdAt || Date.now()), 'MMM d')}</span> },
                { key: 'status', label: 'STATUS', render: (r) => <StatusBadge status={r.status} /> }
              ]}
              emptyMessage="No open operations in queue."
              onRowClick={(r) => navigate(`/${activeTab}/${r.id || r._id}`)}
            />
          </div>
        </div>

        {/* RIGHT: Control tower */}
        <div className="card w-full lg:w-[40%] flex flex-col h-[400px]">
          <div className="px-6 py-4 border-b-[0.5px] border-rule">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Radar size={16} className="text-rust" />
              Control tower
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {!alertData || alertData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-steel2 text-[13px]">
                <CheckCircle2 size={24} className="mb-2 opacity-50" />
                No active alerts.
              </div>
            ) : (
              alertData.map((alert, i) => (
                <div key={i} className={`panel-band bg-paper2 py-3 pr-4 rounded-r flex flex-col gap-1 border-${alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warn' : 'info'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-[13px] text-ink">
                      <AlertCircle size={14} className={alert.severity === 'high' ? 'text-danger' : alert.severity === 'medium' ? 'text-warn' : 'text-info'} />
                      {alert.subject}
                    </div>
                  </div>
                  <div className="text-[12px] text-steel truncate pl-[20px]">
                    {alert.message}
                  </div>
                  <div className="text-[11px] text-steel2 mt-0.5 pl-[20px]">{alert.action}</div>
                  <div className="text-right mt-1">
                    <span className="text-[11px] text-ink hover:underline cursor-pointer font-medium" onClick={() => navigate(getAlertLink(alert))}>
                      Take action ↗
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t-[0.5px] border-rule p-2">
            <button className="btn btn-ghost w-full justify-center text-steel hover:text-ink" onClick={() => navigate('/intelligence/bottlenecks')}>
              See all alerts →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
