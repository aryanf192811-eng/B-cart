import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { E } from '../api/endpoints';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], sales: [], purchase: [], manufacturing: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handleCmdK = (e) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  // Debounced Search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], sales: [], purchase: [], manufacturing: [] });
      setLoading(false);
      return;
    }
    
    setIsOpen(true);
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

  const flatResults = getFlatResults();

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (!isOpen || flatResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatResults[activeIndex];
      if (selected) {
        navigate(selected.link);
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Input Field matching original AppLayout design */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search SO, PO, MO, product..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          if (query.trim()) setIsOpen(true);
        }}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        style={{
          height: '34px',
          padding: '0 36px 0 14px',
          background: isFocused ? 'var(--surface-container-lowest)' : 'var(--surface-container-low)',
          border: '1px solid',
          borderColor: isFocused ? 'var(--secondary)' : 'var(--outline-variant)',
          borderRadius: '9999px',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: 'var(--on-surface)',
          width: isFocused ? '340px' : '280px',
          boxShadow: isFocused ? '0 0 0 3px rgba(78,97,110,0.12)' : 'none',
          transition: 'all 150ms',
          outline: 'none',
        }}
      />
      <div style={{
        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
        fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'var(--outline)',
        padding: '1px 5px', border: '1px solid var(--outline-variant)', borderRadius: '5px',
        pointerEvents: 'none',
      }}>
        ⌘K
      </div>

      {/* Dropdown Menu */}
      {isOpen && query.trim() && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: 'var(--surface-container-lowest)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          padding: '8px',
          fontFamily: 'var(--font-sans)'
        }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              Searching...
            </div>
          )}
          
          {!loading && flatResults.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              No results found for "{query}"
            </div>
          )}

          {!loading && flatResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['Product', 'Sales', 'Purchase', 'Manufacturing'].map(type => {
                const group = flatResults.filter(r => r.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type} style={{ marginBottom: '8px' }}>
                    <div style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--outline)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {type}
                    </div>
                    {group.map(item => {
                      const idx = flatResults.indexOf(item);
                      const active = idx === activeIndex;
                      return (
                        <div
                          key={item.link}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onMouseDown={(e) => {
                            // Prevent input blur before click fires
                            e.preventDefault(); 
                            navigate(item.link);
                            setIsOpen(false);
                            setQuery('');
                          }}
                          style={{
                            padding: '8px 12px',
                            margin: '0 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: active ? 'var(--primary)' : 'transparent',
                            color: active ? 'var(--on-primary)' : 'var(--on-surface)',
                          }}
                        >
                          <span style={{ fontWeight: active ? 600 : 500, fontSize: '13px' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '12px', color: active ? 'rgba(255,255,255,0.8)' : 'var(--on-surface-variant)' }}>
                            {item.sub}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
