import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useState, useEffect } from 'react';
import Chatbot from '../components/Chatbot';
import CommandPalette from '../components/CommandPalette';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Home, ShoppingCart, Truck, Factory, Package, 
  FileText, Building2, UserCircle, Cog, LineChart, 
  Award, Activity, Layers, BadgeCheck, Users, ScrollText,
  MessageSquare, X
} from 'lucide-react';
import clsx from 'clsx';
import { useSocket } from '../hooks/useSocket';

const NAV_CONFIG = [
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Dashboard', icon: Home, path: '/' }
    ]
  },
  {
    label: 'TRANSACTIONS',
    items: [
      { name: 'Sales', icon: ShoppingCart, path: '/sales' },
      { name: 'Purchase', icon: Truck, path: '/purchase' },
      { name: 'Manufacturing', icon: Factory, path: '/manufacturing' }
    ]
  },
  {
    label: 'MASTER DATA',
    items: [
      { name: 'Products', icon: Package, path: '/products' },
      { name: 'Bills of Materials', icon: FileText, path: '/bom' },
      { name: 'Vendors', icon: Building2, path: '/vendors' },
      { name: 'Customers', icon: UserCircle, path: '/customers' },
      { name: 'Work Centers', icon: Cog, path: '/work-centers' }
    ]
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'Smart Procurement', icon: LineChart, path: '/intelligence/procurement' },
      { name: 'Vendor Scores', icon: Award, path: '/intelligence/vendors' },
      { name: 'Bottleneck Radar', icon: Activity, path: '/intelligence/bottlenecks' },
      { name: 'Stock Ledger', icon: Layers, path: '/inventory' },
      { name: 'Product Passports', icon: BadgeCheck, path: '/passports' }
    ]
  }
];

const ADMIN_NAV = [
  { name: 'Users', icon: Users, path: '/users' },
  { name: 'Audit Logs', icon: ScrollText, path: '/audit' }
];

function NavItem({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      style={{ textDecoration: 'none' }}
      className={({ isActive }) => clsx(
        'flex items-center gap-2.5 mx-2 px-3 rounded-xl transition-all duration-150 group relative',
        isActive
          ? 'bg-white text-ink shadow-sm font-semibold'
          : 'text-[var(--on-surface-variant)] hover:bg-white/60 hover:text-[var(--on-surface)]'
      )}
      style={{ height: '34px', fontSize: '13px', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span style={{
              position: 'absolute', left: 0, top: '5px', bottom: '5px',
              width: '3px', background: 'var(--primary)',
              borderRadius: '0 9999px 9999px 0',
            }} />
          )}
          <item.icon
            size={15}
            style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0, transition: 'opacity 150ms' }}
          />
          <span>{item.name}</span>
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  // Command palette hotkey
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine current section name for breadcrumbs
  let currentSection = 'Dashboard';
  for (const group of NAV_CONFIG) {
    const active = group.items.find(i =>
      i.path === '/' ? location.pathname === '/' : location.pathname.startsWith(i.path)
    );
    if (active) currentSection = active.name;
  }
  if (location.pathname.startsWith('/users')) currentSection = 'Users';
  if (location.pathname.startsWith('/audit')) currentSection = 'Audit Logs';

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'AD';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: '220px',
        background: 'var(--surface-container-low)',
        borderRight: '1px solid var(--outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}>
        {/* Brand wordmark */}
        <div style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid var(--outline-variant)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '23px',
            fontWeight: 600,
            color: 'var(--primary)',
            letterSpacing: '-0.02em',
            userSelect: 'none',
          }}>B-cart</span>
          <span style={{
            marginLeft: '6px',
            marginTop: '2px',
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--outline)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>ERP</span>
        </div>

        {/* Nav scroll area */}
        <div className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '8px 0' }}>
          {NAV_CONFIG.map((group, idx) => (
            <div key={idx} style={{ marginBottom: '2px' }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--outline)',
                padding: idx === 0 ? '6px 20px 5px' : '14px 20px 5px',
                borderTop: idx > 0 ? '1px solid var(--outline-variant)' : 'none',
                marginTop: idx > 0 ? '6px' : 0,
              }}>
                {group.label}
              </div>
              {group.items.map(item => <NavItem key={item.path} item={item} />)}
            </div>
          ))}

          {/* Admin section */}
          {user?.role === 'Admin' && (
            <div style={{ marginTop: '6px', borderTop: '1px solid var(--outline-variant)', paddingTop: '6px' }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--outline)',
                padding: '14px 20px 5px',
              }}>
                ADMIN
              </div>
              {ADMIN_NAV.map(item => <NavItem key={item.path} item={item} />)}
            </div>
          )}
        </div>

        {/* Sidebar footer — user info */}
        <div style={{
          borderTop: '1px solid var(--outline-variant)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            background: 'var(--primary-container)',
            color: 'var(--inverse-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            fontWeight: 700,
            flexShrink: 0,
            letterSpacing: '0.05em',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--on-surface)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-sans)' }}>
              {user?.role || 'Administrator'}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--outline)', padding: '2px',
              transition: 'color 150ms',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--outline)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTAINER ── */}
      <div style={{ marginLeft: '220px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>

        {/* ── TOPBAR ── */}
        <header style={{
          height: '56px',
          position: 'sticky',
          top: 0,
          background: 'var(--surface-container-lowest)',
          borderBottom: '1px solid var(--outline-variant)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '0 28px',
          zIndex: 10,
        }}>
          {/* Page section name */}
          <div style={{
            flex: 1, minWidth: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--on-surface-variant)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentSection}
          </div>

          {/* Search bar (pill shape) */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search SO, PO, MO, product..."
              style={{
                height: '34px',
                padding: '0 36px 0 14px',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '9999px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--on-surface)',
                width: '280px',
                transition: 'all 150ms',
                outline: 'none',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--secondary)';
                e.target.style.width = '340px';
                e.target.style.boxShadow = '0 0 0 3px rgba(78,97,110,0.12)';
                e.target.style.background = 'var(--surface-container-lowest)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--outline-variant)';
                e.target.style.width = '280px';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'var(--surface-container-low)';
              }}
              onKeyDown={e => { if (e.metaKey && e.key === 'k') { e.preventDefault(); setIsCmdOpen(true); } }}
            />
            <div style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'var(--outline)',
              padding: '1px 5px', border: '1px solid var(--outline-variant)', borderRadius: '5px',
              pointerEvents: 'none',
            }}>
              ⌘K
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Live indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '9999px',
              background: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '9999px',
                background: connected ? '#15803d' : '#ba1a1a',
                boxShadow: connected ? '0 0 6px rgba(21,128,61,0.5)' : 'none',
              }} />
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: '10px',
                letterSpacing: '0.05em',
                color: connected ? '#15803d' : '#ba1a1a',
                fontWeight: 600,
              }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            {/* User avatar + dropdown */}
            <div className="relative group cursor-pointer">
              <div style={{
                width: '32px', height: '32px', borderRadius: '9999px',
                background: 'var(--primary-container)', color: 'var(--inverse-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
                userSelect: 'none', letterSpacing: '0.05em',
                transition: 'opacity 150ms',
              }}>
                {initials}
              </div>
              {/* Dropdown */}
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                width: '168px', background: 'var(--surface-container-lowest)',
                border: '1px solid var(--outline-variant)', borderRadius: '14px',
                boxShadow: 'var(--shadow-lg)', zIndex: 50, overflow: 'hidden',
              }} className="opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name}
                </div>
                <NavLink to="/users/me" style={{ display: 'block', padding: '8px 14px', fontSize: '13px', color: 'var(--on-surface)', textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.background = 'var(--surface-container-low)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  My Profile
                </NavLink>
                <button onClick={logout} style={{
                  width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '13px',
                  color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                  onMouseEnter={e => e.target.style.background = 'var(--error-container)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main style={{
          flex: 1,
          padding: '28px 32px',
          animation: 'fadeInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── FLOATING CHATBOT FAB ── */}
      <>
        {/* Chatbot drawer — Drawer handles its own fixed inset-0 z-50 positioning */}
        <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        {/* FAB button */}
        <button
          onClick={() => setIsChatOpen(prev => !prev)}
          aria-label={isChatOpen ? 'Close AI assistant' : 'Open AI assistant'}
          title="B-cart AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '54px',
            height: '54px',
            borderRadius: '9999px',
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.15)',
            zIndex: 1000,
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.30), 0 12px 40px rgba(0,0,0,0.20)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.15)';
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'; }}
        >
          {isChatOpen
            ? <X size={22} />
            : <MessageSquare size={22} />
          }
        </button>
      </>

      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
    </div>
  );
}
