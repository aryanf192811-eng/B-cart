import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

// Backend /inventory/summary returns { rows: [{id, name, sku, unit, cost_price, on_hand_qty, free_to_use_qty, total_value, incoming_30d, outgoing_30d}] }
// Backend /inventory/ledger returns { rows: [{id, product_id, move_type, qty, reference_type, reference_number, balance_after, notes, created_at, product_name, sku, user_name}] }

const MOVE_TYPE_LABEL = {
  IN: 'Receipt',
  OUT: 'Delivery',
  RESERVE: 'Reservation',
  UNRESERVE: 'Unreserved',
  ADJUST: 'Adjustment',
};

const MOVE_TYPE_COLOR = {
  IN: 'bg-successBg text-success border-success',
  OUT: 'bg-dangerBg text-danger border-danger',
  RESERVE: 'bg-warnBg text-warn border-warn',
  UNRESERVE: 'bg-paper2 text-steel border-rule',
  ADJUST: 'bg-paper2 text-ink border-rule',
};

export default function StockLedger() {
  const [activeTab, setActiveTab] = useState('summary');

  // Backend returns { rows: [...] }
  const { data: summaryData, isLoading: sumLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => (await api.get(E.invSummary())).data
  });

  const { data: ledgerData, isLoading: ledLoading } = useQuery({
    queryKey: ['inventory-ledger'],
    queryFn: async () => (await api.get(E.ledger())).data
  });

  const summaryRows = summaryData?.rows || [];
  const ledgerRows = ledgerData?.rows || [];

  const sumColumns = [
    { key: 'name', label: 'PRODUCT' },
    { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-[12px]">{r.sku}</span> },
    { key: 'unit', label: 'UNIT' },
    {
      key: 'on_hand_qty', label: 'ON HAND', align: 'right',
      render: (r) => <span className="font-mono">{parseFloat(r.on_hand_qty).toFixed(3)}</span>
    },
    {
      key: 'free_to_use_qty', label: 'FREE TO USE', align: 'right',
      render: (r) => <span className="font-mono text-success">{parseFloat(r.free_to_use_qty).toFixed(3)}</span>
    },
    {
      key: 'total_value', label: 'TOTAL VALUE', align: 'right',
      render: (r) => <span className="font-mono">₹ {parseFloat(r.total_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    },
    {
      key: 'incoming_30d', label: 'IN (30d)', align: 'right',
      render: (r) => <span className="font-mono text-success">+{parseFloat(r.incoming_30d).toFixed(3)}</span>
    },
    {
      key: 'outgoing_30d', label: 'OUT (30d)', align: 'right',
      render: (r) => <span className="font-mono text-rust">-{parseFloat(r.outgoing_30d).toFixed(3)}</span>
    },
  ];

  const ledColumns = [
    {
      key: 'created_at', label: 'TIMESTAMP',
      render: (r) => <span className="font-mono text-[12px]">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</span>
    },
    { key: 'product_name', label: 'PRODUCT' },
    {
      key: 'move_type', label: 'TYPE',
      render: (r) => (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border-[0.5px] ${MOVE_TYPE_COLOR[r.move_type] || 'bg-paper2 text-steel border-rule'}`}>
          {MOVE_TYPE_LABEL[r.move_type] || r.move_type}
        </span>
      )
    },
    {
      key: 'qty', label: 'QTY', align: 'right',
      render: (r) => {
        const isOut = ['OUT', 'RESERVE'].includes(r.move_type);
        return (
          <span className={`font-mono font-semibold ${isOut ? 'text-rust' : 'text-success'}`}>
            {isOut ? '-' : '+'}{parseFloat(r.qty).toFixed(3)}
          </span>
        );
      }
    },
    {
      key: 'reference_number', label: 'REFERENCE',
      render: (r) => <span className="font-mono text-[12px]">{r.reference_number || '—'}</span>
    },
    {
      key: 'balance_after', label: 'BALANCE AFTER', align: 'right',
      render: (r) => <span className="font-mono">{parseFloat(r.balance_after).toFixed(3)}</span>
    },
    {
      key: 'user_name', label: 'BY',
      render: (r) => <span className="text-steel text-[12px]">{r.user_name || 'System'}</span>
    },
  ];

  const totalVal = summaryRows.reduce((acc, r) => acc + parseFloat(r.total_value || 0), 0);

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar title="Stock Ledger" />

      <div className="flex border-b-[0.5px] border-rule gap-0">
        {['summary', 'ledger'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-rust text-rust' : 'border-transparent text-steel hover:text-ink'}`}
          >
            {tab === 'summary' ? 'Stock Summary' : 'Transaction Ledger'}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        {activeTab === 'summary' ? (
          <div className="flex flex-col flex-1">
            <div className="flex-1 overflow-auto">
              <DataTable columns={sumColumns} rows={summaryRows} loading={sumLoading} />
            </div>
            <div className="bg-paper2 border-t-[0.5px] border-rule p-4 flex justify-between items-center">
              <span className="text-[12px] text-steel uppercase font-semibold tracking-wider">Total Inventory Value</span>
              <span className="font-mono font-bold text-ink text-lg">
                ₹ {totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <DataTable columns={ledColumns} rows={ledgerRows} loading={ledLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
