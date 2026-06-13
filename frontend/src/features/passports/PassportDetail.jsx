import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import StatusBadge from '../../components/StatusBadge';
import FormShell from '../../components/FormShell';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../store/auth';

export default function PassportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [qcAction, setQcAction] = useState(null); // 'pass' | 'fail'

  const { data: p, isLoading } = useQuery({
    queryKey: ['passports', id],
    queryFn: async () => (await api.get(E.passportOne(id))).data
  });

  const qcMutation = useMutation({
    mutationFn: async (action) => (await api.post(`/passports/${id}/qc`, { action })).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['passports']);
      toast.success('QC status updated');
      setQcAction(null);
    },
    onError: () => toast.error('Failed to update QC status')
  });

  if (isLoading) return <div className="p-8 text-steel">Loading...</div>;
  if (!p) return <div className="p-8 text-steel">Not found</div>;

  const isAdmin = user?.role === 'admin';

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={p.passportId}
          subtitle={<span className="font-mono text-[13px]">{p.batchNumber}</span>}
          status={p.qcStatus}
          reference={<span className="text-[14px] font-sans">MO: <a href={`/manufacturing/${p.manufacturingOrder}`} className="font-mono text-rust hover:underline">{p.manufacturingOrderRef}</a></span>}
        />
        
        <FormShell.Tabs tabs={[{ id: 'trace', label: 'Traceability' }]} active="trace" onChange={()=>{}} />

        <FormShell.Body>
          <div className="card p-6 grid grid-cols-3 gap-6">
            <div><div className="text-[11px] text-steel mb-1">PRODUCT</div><div className="font-medium text-ink">{p.product?.name}</div></div>
            <div><div className="text-[11px] text-steel mb-1">BATCH</div><div className="font-mono text-ink">{p.batchNumber}</div></div>
            <div><div className="text-[11px] text-steel mb-1">MFG DATE</div><div className="text-ink">{format(new Date(p.manufacturedDate), 'dd MMM yyyy HH:mm')}</div></div>
            <div><div className="text-[11px] text-steel mb-1">QTY PRODUCED</div><div className="font-mono text-ink">{p.quantity}</div></div>
            <div><div className="text-[11px] text-steel mb-1">MANUFACTURED BY</div><div className="text-ink">{p.manufacturedBy?.name || '—'}</div></div>
            <div>
              <div className="text-[11px] text-steel mb-1">QC REVIEWED</div>
              <div className="text-ink">
                {p.qcReviewedBy?.name ? `${p.qcReviewedBy.name} on ${format(new Date(p.qcReviewedAt), 'dd MMM yyyy')}` : '—'}
              </div>
            </div>
          </div>

          <div className="card mt-6">
            <div className="px-6 py-4 border-b-[0.5px] border-rule font-semibold text-ink">Component traceability</div>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-paper2">
                  <th className="px-4 py-3">COMPONENT</th>
                  <th className="px-4 py-3 text-right">QTY USED</th>
                  <th className="px-4 py-3">SOURCE VENDOR</th>
                  <th className="px-4 py-3">SOURCE PO</th>
                  <th className="px-4 py-3">BATCH REF</th>
                </tr>
              </thead>
              <tbody>
                {p.components?.map((c, i) => (
                  <tr key={i} className="border-b-[0.5px] border-rule">
                    <td className="px-4 py-3">{c.product?.name}</td>
                    <td className="px-4 py-3 font-mono text-right">{c.quantityUsed}</td>
                    <td className="px-4 py-3">{c.sourceVendor?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {c.sourcePurchaseOrder ? <a href={`/purchase/${c.sourcePurchaseOrder}`} className="font-mono text-rust hover:underline">{c.sourcePurchaseOrderRef}</a> : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">{c.batchRef || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {p.qcNotes && (
            <div className="card p-6 mt-6 bg-paper2">
              <div className="text-[11px] font-semibold text-steel uppercase mb-2">QC Notes</div>
              <div className="text-[13px] text-ink">{p.qcNotes}</div>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          {p.qcStatus === 'pending' && isAdmin && (
            <div className="flex flex-col gap-2 mb-4">
              <button className="btn btn-success justify-center" onClick={() => setQcAction('pass')}>Pass QC</button>
              <button className="btn btn-danger justify-center" onClick={() => setQcAction('fail')}>Fail QC</button>
            </div>
          )}
          
          <a href={`${import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'}${E.passportPdf(id)}`} target="_blank" rel="noreferrer" className="btn justify-center">
            Download PDF
          </a>
        </FormShell.Side>
      </FormShell>

      <ConfirmDialog
        isOpen={!!qcAction}
        onClose={() => setQcAction(null)}
        title={qcAction === 'pass' ? 'Pass Quality Control' : 'Fail Quality Control'}
        message={`Are you sure you want to mark this passport as ${qcAction === 'pass' ? 'PASSED' : 'FAILED'}?`}
        confirmText="Confirm"
        isDanger={qcAction === 'fail'}
        onConfirm={() => qcAction && qcMutation.mutateAsync(qcAction)}
      />
    </div>
  );
}
