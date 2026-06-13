import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, AlertCircle, Clock, Truck, Activity } from 'lucide-react';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../store/auth';
import { useEffect, useState } from 'react';

export default function ControlTower() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [seconds, setSeconds] = useState(0);

  const { data, refetch } = useQuery({
    queryKey: ['controlTower'],
    queryFn: async () => (await api.get(E.controlTower())).data,
    refetchInterval: 30000
  });

  const alerts = data?.alerts || [];

  useEffect(() => {
    if (!socket) return;
    const handler = () => refetch();
    socket.on('sales:update', handler);
    socket.on('purchase:update', handler);
    socket.on('mo:update', handler);
    socket.on('stock:update', handler);
    return () => {
      socket.off('sales:update', handler);
      socket.off('purchase:update', handler);
      socket.off('mo:update', handler);
      socket.off('stock:update', handler);
    };
  }, [socket, refetch]);

  useEffect(() => {
    const int = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => {
      clearInterval(int);
      setSeconds(0);
    };
  }, [alerts]);

  const stats = [
    { type: 'STOCK_CRITICAL', label: 'Stock critical', color: 'rust' },
    { type: 'BOTTLENECK', label: 'Bottleneck', color: 'warn' },
    { type: 'DELAYED_ORDER', label: 'Delayed orders', color: 'danger' },
    { type: 'SUPPLIER_RISK', label: 'Supplier risk', color: 'info' }
  ];

  const getCount = (type) => alerts?.filter(a => a.alert_type === type).length || 0;

  const ICONS = {
    STOCK_CRITICAL: AlertCircle,
    BOTTLENECK: AlertTriangle,
    DELAYED_ORDER: Clock,
    SUPPLIER_RISK: Truck
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1000px] mx-auto pb-12">
      {/* Hero Banner with Background Image */}
      <div className="relative rounded-xl overflow-hidden bg-ink text-white shadow-lg border border-rule min-h-[220px] flex">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop')" }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-r from-rust/95 via-rust/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent"></div>
        
        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
          <div className="max-w-md">
            <div className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#198754] animate-pulse"></span>
              SYSTEM LIVE • {seconds}s AGO
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2 drop-shadow-sm">
              Welcome back, {user?.name?.split(' ')[0] || 'Admin'}.
            </h1>
            <p className="text-[15px] text-white/90 drop-shadow-sm">
              {alerts?.length 
                ? `There are currently ${alerts.length} items demanding your attention across the supply chain.` 
                : 'All automated systems are stable. No active bottlenecks detected.'}
            </p>
          </div>

          {/* Glassmorphic Stats */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            {stats.map(s => {
              const count = getCount(s.type);
              return (
                <div key={s.type} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-4 flex flex-col justify-between min-w-[140px]">
                  <div className="text-[12px] font-medium text-white/80 uppercase tracking-wide">{s.label}</div>
                  <div className="text-[32px] font-bold mt-1 text-white">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-[18px] font-bold text-ink flex items-center gap-2">
          <Activity className="text-rust" size={20} />
          Priority Intelligence Feed
        </h2>
        
        {!alerts || alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[250px] border border-rule rounded-xl bg-white shadow-sm">
            <ShieldCheck size={56} className="text-[#198754] opacity-80 mb-4" />
            <div className="text-[18px] font-bold text-ink">Zero Critical Alerts</div>
            <div className="text-[14px] text-steel mt-1">Operations are running smoothly across all facilities.</div>
          </div>
        ) : (
          alerts.map((a, i) => {
            const color = stats.find(s => s.type === a.alert_type)?.color || 'steel';
            const Icon = ICONS[a.alert_type] || AlertCircle;
            
            return (
              <div key={i} className={`card flex flex-col sm:flex-row justify-between gap-4 border-l-4 border-l-${color} shadow-sm hover:shadow transition-shadow`} style={{ padding: '16px 20px' }}>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-steel">
                    <Icon size={16} className={`text-${color}`} />
                    {a.alert_type.replace('_', ' ')}
                  </div>
                  <div className="text-[16px] font-bold text-ink">{a.subject}</div>
                  <div className="text-[14px] text-steel max-w-[600px] leading-relaxed">{a.message}</div>
                </div>
                
                <div className="flex flex-col items-end justify-between min-w-[130px]">
                  <div className="font-mono text-[12px] text-ink font-bold bg-paper2 px-2 py-1 rounded border border-rule">
                    URGENCY: {a.urgency || 50}
                  </div>
                  {(() => {
                    let link = '/';
                    if (a.entity_type === 'product') link = `/products/${a.entity_id}`;
                    if (a.entity_type === 'work_center') link = `/work-centers/${a.entity_id}`;
                    if (a.entity_type === 'sales_order') link = `/sales/${a.entity_id}`;
                    if (a.entity_type === 'vendor') link = `/vendors/${a.entity_id}`;
                    return (
                      <button className="btn btn-rust mt-4" onClick={() => navigate(link)}>
                        Take Action
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
