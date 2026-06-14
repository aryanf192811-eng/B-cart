import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import { E } from '../api/endpoints';

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], sales: [], purchase: [], manufacturing: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ products: [], sales: [], purchase: [], manufacturing: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      
      const flatResults = getFlatResults();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatResults[activeIndex];
        if (selected) {
          navigate(selected.link);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, results, navigate, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], sales: [], purchase: [], manufacturing: [] });
      return;
    }
    
    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const [p, s, pu, m] = await Promise.all([
          api.get(`${E.products()}?search=${query}&limit=5`),
          api.get(`${E.sales()}?search=${query}&limit=5`),
          api.get(`${E.purchase()}?search=${query}&limit=5`),
          api.get(`${E.mo()}?search=${query}&limit=5`)
        ]);
        setResults({
          products: (p.data.rows || p.data || []).slice(0,5),
          sales: (s.data.rows || s.data || []).slice(0,5),
          purchase: (pu.data.rows || pu.data || []).slice(0,5),
          manufacturing: (m.data.rows || m.data || []).slice(0,5)
        });
        setActiveIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(debounce);
  }, [query]);

  const getFlatResults = () => {
    return [
      ...results.products.map(r => ({ ...r, type: 'Product', link: `/products/${r.id}`, title: r.name, sub: r.sku })),
      ...results.sales.map(r => ({ ...r, type: 'Sales', link: `/sales/${r.id}`, title: r.so_number, sub: r.customer_name })),
      ...results.purchase.map(r => ({ ...r, type: 'Purchase', link: `/purchase/${r.id}`, title: r.po_number, sub: r.vendor_name })),
      ...results.manufacturing.map(r => ({ ...r, type: 'Manufacturing', link: `/manufacturing/${r.id}`, title: r.mo_number, sub: r.product_name }))
    ];
  };

  if (!isOpen) return null;

  const flatResults = getFlatResults();

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0" style={{ background: 'rgba(15,20,25,0.4)' }} onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-[600px] rounded-md border-[0.5px] border-rule flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b-[0.5px] border-rule gap-3">
          <Search size={18} className="text-steel" />
          <input 
            ref={inputRef}
            className="flex-1 outline-none text-ink text-[15px] bg-transparent"
            placeholder="Search products, orders, documents... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="font-mono text-[10px] text-steel border-[0.5px] border-rule px-1.5 py-0.5 rounded bg-paper2">ESC</div>
        </div>
        
        <div className="max-h-[350px] overflow-y-auto p-2">
          {!query.trim() && (
            <div className="p-8 text-center text-steel2 text-[13px]">
              Type to start searching...
            </div>
          )}
          {query.trim() && loading && (
            <div className="p-8 text-center text-steel2 text-[13px] animate-pulse">
              Searching...
            </div>
          )}
          {query.trim() && !loading && flatResults.length === 0 && (
            <div className="p-8 text-center text-steel2 text-[13px]">
              No results found for "{query}"
            </div>
          )}
          {query.trim() && !loading && flatResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {['Product', 'Sales', 'Purchase', 'Manufacturing'].map(type => {
                const group = flatResults.filter(r => r.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type} className="mb-2">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-steel uppercase tracking-wider">{type}</div>
                    {group.map(item => {
                      const idx = flatResults.indexOf(item);
                      const active = idx === activeIndex;
                      return (
                        <div 
                          key={item.link}
                          className={`px-3 py-2 mx-1 flex items-center justify-between rounded cursor-pointer ${active ? 'bg-rust text-white' : 'hover:bg-paper2 text-ink'}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => { navigate(item.link); onClose(); }}
                        >
                          <span className={active ? 'text-white' : 'font-medium'}>{item.title}</span>
                          <span className={`text-[13px] ${active ? 'text-white/80' : 'text-steel'}`}>{item.sub}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
