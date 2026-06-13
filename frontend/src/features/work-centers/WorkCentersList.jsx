import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function WorkCentersList() {
  const { data: listData, isLoading } = useQuery({
    queryKey: ['workCenters'],
    queryFn: async () => (await api.get(E.workCenters())).data
  });

  const columns = [
    { key: 'name', label: 'WORK CENTER' },
    { key: 'capacityPerHour', label: 'CAPACITY/HR', render: (r) => <span className="font-mono">{r.capacity_per_hour || r.capacityPerHour}</span> },
    { key: 'costPerHour', label: 'COST/HR', render: (r) => <span className="font-mono">₹ {r.hourly_cost || r.costPerHour}</span> },
    { key: 'utilization', label: 'UTILIZATION', render: (r) => {
        // Stable mock utilization based on ID
        const util = (r.id * 17) % 100;
        const isHigh = util > 80;
        return (
          <div className="flex items-center gap-2 w-32">
            <div className="h-1.5 flex-1 bg-paper2 rounded-full overflow-hidden">
              <div className={`h-full ${isHigh ? 'bg-rust' : 'bg-steel2'}`} style={{ width: `${util}%` }}></div>
            </div>
            <span className="font-mono text-[11px] text-steel">{util}%</span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar title="Work Centers" />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData?.rows || (Array.isArray(listData) ? listData : [])}
            loading={isLoading}
            emptyMessage="No work centers found."
          />
        </div>
      </div>
    </div>
  );
}
