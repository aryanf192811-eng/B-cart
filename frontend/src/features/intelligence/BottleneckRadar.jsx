import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Toolbar from '../../components/Toolbar';

export default function BottleneckRadar() {
  const navigate = useNavigate();
  const { data: bottlenecks } = useQuery({
    queryKey: ['bottlenecks'],
    queryFn: async () => (await api.get('/intelligence/bottleneck-radar')).data
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      <Toolbar title="Bottleneck Radar" count={bottlenecks?.length || 0} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(bottlenecks || []).map((b, i) => {
          const utilColor = b.utilizationPercentage > 80 ? 'bg-rust' : b.utilizationPercentage > 60 ? 'bg-warn' : 'bg-success';
          return (
            <div key={i} className="card p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="font-mono font-bold text-ink">{b.workCenterName}</div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-paper2 rounded-full overflow-hidden">
                  <div className={`h-full ${utilColor}`} style={{ width: `${b.utilizationPercentage}%` }}></div>
                </div>
                <div className="font-mono text-sm text-steel w-12 text-right">{b.utilizationPercentage}%</div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-[11px] text-steel uppercase tracking-wider">Pending</span>
                  <span className="font-mono text-ink text-lg">{b.pendingWorkOrders}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-steel uppercase tracking-wider">Active</span>
                  <span className="font-mono text-ink text-lg">{b.activeWorkOrders}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-steel uppercase tracking-wider">Queued (mins)</span>
                  <span className="font-mono text-ink text-lg">{b.queuedMinutes}</span>
                </div>
              </div>

              <div className="border-t-[0.5px] border-rule pt-3 mt-1 text-right">
                <span 
                  className="text-[12px] text-ink hover:underline cursor-pointer font-medium"
                  onClick={() => navigate('/manufacturing')}
                >
                  View work orders ↗
                </span>
              </div>
            </div>
          );
        })}
        {bottlenecks?.length === 0 && (
          <div className="col-span-2 p-12 text-center text-steel2">No bottleneck data available.</div>
        )}
      </div>
    </div>
  );
}
