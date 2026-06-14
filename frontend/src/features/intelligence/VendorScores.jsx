import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import Toolbar from '../../components/Toolbar';

export default function VendorScores() {
  const { data: vendors } = useQuery({
    queryKey: ['vendor-scores'],
    queryFn: async () => (await api.get('/intelligence/vendor-scores')).data
  });

  const chartData = (vendors?.rows || []).map(v => ({
    name: v.name,
    score: v.reliability_score,
    fill: v.reliability_score >= 85 ? '#067647' : v.reliability_score >= 70 ? '#DC6803' : '#B42318' // success, warn, danger hex
  })).sort((a,b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-6 h-full">
      <Toolbar title="Vendor reliability scores" />
      
      <div className="card p-6 h-[300px]">
        <div className="text-[11px] font-semibold text-steel uppercase tracking-wider mb-4">Overall Score Distribution</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 50, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475467' }} />
            <Tooltip cursor={{ fill: '#FAFAF7' }} contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '0.5px solid #E4E4E1' }} />
            <ReferenceLine x={85} stroke="#067647" strokeDasharray="3 3" />
            <ReferenceLine x={70} stroke="#B42318" strokeDasharray="3 3" />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden mt-4">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-paper2">
              <th className="px-4 py-3 font-mono">RANK</th>
              <th className="px-4 py-3">VENDOR</th>
              <th className="px-4 py-3 text-right">ORDERS</th>
              <th className="px-4 py-3 text-right">ON-TIME %</th>
              <th className="px-4 py-3 text-right">FULFILLMENT %</th>
              <th className="px-4 py-3 text-right">QUALITY %</th>
              <th className="px-4 py-3 text-right">SCORE</th>
            </tr>
          </thead>
          <tbody>
            {(vendors?.rows || []).sort((a,b) => b.reliability_score - a.reliability_score).map((v, i) => {
              const color = v.reliability_score >= 85 ? 'border-success' : v.reliability_score >= 70 ? 'border-warn' : 'border-danger';
              return (
                <tr key={v.vendor_id} className={`border-b-[0.5px] border-rule border-l-2 ${color}`}>
                  <td className="px-4 py-3 font-mono">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-ink">{v.name}</td>
                  <td className="px-4 py-3 font-mono text-right">{v.total_orders}</td>
                  <td className="px-4 py-3 font-mono text-right">{Math.round(v.on_time_rate)}%</td>
                  <td className="px-4 py-3 font-mono text-right">{Math.round(v.fulfillment_rate)}%</td>
                  <td className="px-4 py-3 font-mono text-right">{Math.round(v.quality_rate)}%</td>
                  <td className="px-4 py-3 font-mono text-right font-bold text-ink">{Math.round(v.reliability_score)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
