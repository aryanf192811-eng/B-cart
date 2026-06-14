import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { Network, ArrowRight, ArrowLeft, Package, User, PenTool, Hash } from 'lucide-react';
import { format } from 'date-fns';

export default function MaterialTraceability({ productId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['products', productId, 'traceability'],
    queryFn: async () => (await api.get(E.productTraceability(productId))).data,
    enabled: !!productId
  });

  if (isLoading) return <div className="p-4 text-steel">Loading traceability...</div>;
  if (!data) return null;

  const { current_stock, sources, consumers } = data;

  const renderIcon = (type) => {
    switch (type) {
      case 'PO': return <User size={16} />;
      case 'SO': return <User size={16} />;
      case 'MO': return <PenTool size={16} />;
      case 'MANUAL': return <Hash size={16} />;
      default: return <Package size={16} />;
    }
  };

  return (
    <div className="card p-6 mt-4">
      <div className="flex items-center gap-2 mb-6">
        <Network size={20} className="text-rust" />
        <h3 className="text-sm font-semibold text-ink">Material Traceability (Current Stock: {current_stock})</h3>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sources */}
        <div className="flex-1 bg-paper2 p-4 rounded-lg border-[0.5px] border-rule w-full">
          <h4 className="text-xs font-semibold text-steel uppercase tracking-wider mb-4 flex items-center gap-2">
            <ArrowRight size={14} className="text-success" />
            Stock Origins
          </h4>
          {sources?.length === 0 ? (
            <div className="text-xs text-steel italic">No recent stock origins found.</div>
          ) : (
            <div className="space-y-3">
              {sources?.map((s, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-rule/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-paper flex items-center justify-center text-steel">
                      {renderIcon(s.reference_type)}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-ink">
                        {s.reference_type === 'MANUAL' ? 'Manual Adjustment' : `${s.reference_type} #${s.reference_number}`}
                      </div>
                      <div className="text-[11px] text-steel">{format(new Date(s.created_at), 'dd MMM yyyy, HH:mm')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-mono text-success">+{s.attributed_qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consumers */}
        <div className="flex-1 bg-paper2 p-4 rounded-lg border-[0.5px] border-rule w-full">
          <h4 className="text-xs font-semibold text-steel uppercase tracking-wider mb-4 flex items-center gap-2">
            <ArrowLeft size={14} className="text-rust" />
            Recent Consumers
          </h4>
          {consumers?.length === 0 ? (
            <div className="text-xs text-steel italic">No recent consumers found.</div>
          ) : (
            <div className="space-y-3">
              {consumers?.map((c, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-rule/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-paper flex items-center justify-center text-steel">
                      {renderIcon(c.reference_type)}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-ink">
                        {c.reference_type === 'MANUAL' ? 'Manual Adjustment' : `${c.reference_type} #${c.reference_number}`}
                      </div>
                      <div className="text-[11px] text-steel">{format(new Date(c.created_at), 'dd MMM yyyy, HH:mm')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-mono text-rust">-{c.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
