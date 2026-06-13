import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';

export default function SmartProcurement() {
  const navigate = useNavigate();
  const { data: alerts } = useQuery({
    queryKey: ['procurement-alerts'],
    queryFn: async () => (await api.get('/intelligence/procurement-alerts')).data
  });

  const productsAtRisk = alerts?.filter(a => a.daysLeft <= a.leadTimeDays)?.length || 0;
  const stockOutSoon = alerts?.filter(a => a.daysLeft < 7)?.length || 0;
  const avgLeadTime = alerts?.length ? Math.round(alerts.reduce((acc, a) => acc + a.leadTimeDays, 0) / alerts.length) : 0;

  return (
    <div className="flex flex-col gap-6 h-full">
      <Toolbar title="Smart procurement" count={alerts?.length || 0} />
      
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-block border-l-2 border-warn">
          <div className="stat-label">Products at risk</div>
          <div className="stat-value">{productsAtRisk}</div>
        </div>
        <div className="stat-block border-l-2 border-danger">
          <div className="stat-label">Stock-out in &lt;7d</div>
          <div className="stat-value">{stockOutSoon}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Avg lead time</div>
          <div className="stat-value">{avgLeadTime} days</div>
        </div>
      </div>

      <div className="card overflow-hidden mt-2 flex-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-paper2">
              <th className="px-4 py-3">PRODUCT</th>
              <th className="px-4 py-3 text-right">CURRENT STOCK</th>
              <th className="px-4 py-3 text-right">AVG DAILY USE</th>
              <th className="px-4 py-3 text-right">DAYS LEFT</th>
              <th className="px-4 py-3 text-right">RECOMMENDED ORDER</th>
              <th className="px-4 py-3">DEFAULT VENDOR</th>
              <th className="px-4 py-3 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {(alerts || []).map((a, i) => {
              const riskColor = a.daysLeft <= a.leadTimeDays ? 'bg-dangerBg text-danger border-danger' : 
                                a.daysLeft <= a.leadTimeDays * 2 ? 'bg-warnBg text-warn border-warn' : 
                                'bg-paper2 text-steel border-rule';

              return (
                <tr key={i} className="border-b-[0.5px] border-rule">
                  <td className="px-4 py-3 font-medium text-ink">{a.productName}</td>
                  <td className="px-4 py-3 font-mono text-right">{a.currentStock}</td>
                  <td className="px-4 py-3 font-mono text-right">{a.avgDailyUse}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono px-2 py-0.5 rounded border-[0.5px] ${riskColor}`}>
                      {a.daysLeft}d
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-right font-bold text-ink">{a.recommendedOrderQty}</td>
                  <td className="px-4 py-3 text-steel">{a.vendorName || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      className="btn btn-rust btn-sm"
                      onClick={() => navigate('/purchase/new')}
                    >
                      Create PO
                    </button>
                  </td>
                </tr>
              );
            })}
            {alerts?.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-steel2">No procurement alerts.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
