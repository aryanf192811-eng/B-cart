import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function StockLedger() {
  const [activeTab, setActiveTab] = useState('summary');

  const { data: summaryData, isLoading: sumLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => (await api.get(E.invSummary())).data
  });

  const { data: ledgerData, isLoading: ledLoading } = useQuery({
    queryKey: ['inventory-ledger'],
    queryFn: async () => (await api.get(E.ledger())).data
  });

  const sumColumns = [
    { key: 'product', label: 'PRODUCT', render: (r) => r.product?.name || r.productName },
    { key: 'unit', label: 'UNIT', render: (r) => r.product?.unitOfMeasure || 'Units' },
    { key: 'onHand', label: 'ON HAND', align: 'right', render: (r) => <span className="font-mono">{r.onHandQty || r.product?.onHandQty}</span> },
    { key: 'free', label: 'FREE TO USE', align: 'right', render: (r) => <span className="font-mono">{r.freeToUseQty || r.product?.freeToUseQty || (r.product?.onHandQty - (r.product?.reservedQty||0))}</span> },
    { key: 'val', label: 'TOTAL VALUE', align: 'right', render: (r) => <span className="font-mono">₹ {((r.onHandQty||r.product?.onHandQty||0) * (r.product?.costPrice||0)).toFixed(2)}</span> }
  ];

  const ledColumns = [
    { key: 'date', label: 'TIMESTAMP', render: (r) => format(new Date(r.date), 'dd MMM yyyy HH:mm') },
    { key: 'product', label: 'PRODUCT', render: (r) => r.product?.name },
    { key: 'move', label: 'MOVE', render: (r) => {
        let col = 'bg-paper2 text-steel border-rule';
        if(r.transactionType?.includes('Receipt') || r.transactionType?.includes('Production')) col = 'bg-successBg text-success border-success';
        else if(r.transactionType?.includes('Delivery') || r.transactionType?.includes('Consumption')) col = 'bg-dangerBg text-danger border-danger';
        else if(r.transactionType?.includes('Reservation')) col = 'bg-warnBg text-warn border-warn';
        
        return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border-[0.5px] ${col}`}>{r.transactionType}</span>;
      }
    },
    { key: 'qty', label: 'QTY', align: 'right', render: (r) => <span className={`font-mono ${r.quantityChange > 0 ? 'text-success' : r.quantityChange < 0 ? 'text-danger' : 'text-ink'}`}>{r.quantityChange > 0 ? '+' : ''}{r.quantityChange}</span> },
    { key: 'ref', label: 'REFERENCE', render: (r) => <span className="font-mono">{r.referenceDocument || '—'}</span> },
    { key: 'bal', label: 'BALANCE AFTER', align: 'right', render: (r) => <span className="font-mono">{r.onHandQuantityAfter}</span> },
  ];

  const totalVal = summaryData?.reduce((acc, r) => acc + ((r.onHandQty||r.product?.onHandQty||0) * (r.product?.costPrice||0)), 0) || 0;

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar title="Stock Ledger" />
      <div className="tabs mb-2">
        <div className={`tab ${activeTab === 'summary' ? 'tab-active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</div>
        <div className={`tab ${activeTab === 'ledger' ? 'tab-active' : ''}`} onClick={() => setActiveTab('ledger')}>Ledger</div>
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        {activeTab === 'summary' ? (
          <div className="flex flex-col flex-1">
            <div className="flex-1 overflow-auto">
              <DataTable columns={sumColumns} rows={summaryData} loading={sumLoading} />
            </div>
            <div className="bg-paper2 border-t-[0.5px] border-rule p-4 flex justify-end font-semibold text-ink">
              TOTAL INVENTORY VALUE: <span className="font-mono ml-2">₹ {totalVal.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <DataTable columns={ledColumns} rows={ledgerData} loading={ledLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
