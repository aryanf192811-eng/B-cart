import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useState, useEffect } from 'react';
import Chatbot from '../components/Chatbot';
import CommandPalette from '../components/CommandPalette';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Home, Radar, ShoppingCart, Truck, Factory, Package, 
  FileText, Building2, UserCircle, Cog, LineChart, 
  Award, Activity, Layers, BadgeCheck, Users, ScrollText,
  MessageSquare
} from 'lucide-react';
import clsx from 'clsx';
import { useSocket } from '../hooks/useSocket';

const NAV_CONFIG = [
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Dashboard', icon: Home, path: '/' },
      { name: 'Control Tower', icon: Radar, path: '/control-tower' }
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

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'AD';

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-[220px] bg-white border-r-[0.5px] border-rule text-ink2 flex flex-col z-20">
        <div className="h-[48px] flex flex-col justify-center px-4 mb-4 bg-rust">
          <div className="font-mono text-[15px] font-bold text-white tracking-widest">B-Card</div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6 space-y-6">
          {NAV_CONFIG.map((group, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="text-[11px] font-bold text-steel px-4 mb-1 tracking-wide">
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink 
                  key={item.path} 
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => clsx(
                    "flex items-center h-[32px] px-[14px] text-[13px] transition-colors rounded-r-full mr-2",
                    isActive ? "bg-paper2 text-ink font-semibold" : "hover:bg-paper text-ink2"
                  )}
                >
                  <item.icon size={16} className="mr-3 opacity-80" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {user?.role === 'Admin' && (
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-bold text-steel px-4 mb-1 tracking-wide">
                ADMIN
              </div>
              <NavLink to="/users" className={({ isActive }) => clsx(
                "flex items-center h-[32px] px-[14px] text-[13px] transition-colors rounded-r-full mr-2",
                isActive ? "bg-paper2 text-ink font-semibold" : "hover:bg-paper text-ink2"
              )}>
                <Users size={16} className="mr-3 opacity-80" />
                <span>Users</span>
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => clsx(
                "flex items-center h-[32px] px-[14px] text-[13px] transition-colors rounded-r-full mr-2",
                isActive ? "bg-paper2 text-ink font-semibold" : "hover:bg-paper text-ink2"
              )}>
                <ScrollText size={16} className="mr-3 opacity-80" />
                <span>Audit Logs</span>
              </NavLink>
            </div>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="ml-[220px] flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="h-[48px] sticky top-0 bg-rust z-10 flex items-center justify-between px-6 text-white shadow-sm">
          <div className="text-[15px] font-semibold flex items-center">
            {currentSection}
          </div>

          <div className="flex-1 max-w-md mx-6 relative">
            <input 
              type="text" 
              placeholder="Search SO, PO, MO, product..." 
              className="w-full h-8 bg-rust2 border-[0.5px] border-rust2 rounded px-3 text-[13px] text-white placeholder:text-white/70 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-white/80 px-1 border-[0.5px] border-white/20 rounded bg-rust2">
              ⌘K
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-rust2">
              <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-[#198754]" : "bg-[#DC3545]")}></div>
              <span className="font-mono text-[10px] tracking-wider text-white font-medium">
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <button 
              onClick={() => setIsChatOpen(true)}
              className="text-white/80 hover:text-white transition-colors p-1"
            >
              <MessageSquare size={18} />
            </button>

            <div className="relative group cursor-pointer ml-1">
              <div className="w-[28px] h-[28px] bg-white text-rust rounded-sm flex items-center justify-center text-[11px] font-bold tracking-wider select-none">
                {initials}
              </div>
              
              <div className="absolute right-0 top-full mt-1 w-40 bg-white text-ink border-[0.5px] border-rule rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-1">
                  <div className="px-3 py-2 text-[12px] text-steel border-b-[0.5px] border-rule truncate">
                    {user?.name}
                  </div>
                  <NavLink to="/users/me" className="block px-3 py-1.5 text-[13px] hover:bg-paper2">My Profile</NavLink>
                  <button onClick={logout} className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-paper2 text-danger">Sign out</button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
