import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import AppLayout from './layouts/AppLayout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import SalesList from './features/sales/SalesList';
import SalesForm from './features/sales/SalesForm';
import PurchaseList from './features/purchase/PurchaseList';
import PurchaseForm from './features/purchase/PurchaseForm';
import ManufacturingList from './features/manufacturing/ManufacturingList';
import ManufacturingForm from './features/manufacturing/ManufacturingForm';
import BomList from './features/bom/BomList';
import BomForm from './features/bom/BomForm';
import ProductsList from './features/products/ProductsList';
import ProductForm from './features/products/ProductForm';
import StockLedger from './features/inventory/StockLedger';
import VendorsList from './features/vendors/VendorsList';
import VendorForm from './features/vendors/VendorForm';
import CustomersList from './features/customers/CustomersList';
import CustomerForm from './features/customers/CustomerForm';
import WorkCentersList from './features/work-centers/WorkCentersList';
import ControlTower from './features/intelligence/ControlTower';
import SmartProcurement from './features/intelligence/SmartProcurement';
import VendorScores from './features/intelligence/VendorScores';
import BottleneckRadar from './features/intelligence/BottleneckRadar';
import PassportsList from './features/passports/PassportsList';
import PassportDetail from './features/passports/PassportDetail';
import AuditLogs from './features/audit/AuditLogs';
import UsersList from './features/users/UsersList';
import UserForm from './features/users/UserForm';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-paper text-steel text-sm">
        Initializing Ops Console...
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/control-tower" replace />} />
        
        {/* Sales */}
        <Route path="sales" element={<SalesList />} />
        <Route path="sales/new" element={<SalesForm mode="new" />} />
        <Route path="sales/:id" element={<SalesForm mode="detail" />} />
        
        {/* Purchase */}
        <Route path="purchase" element={<PurchaseList />} />
        <Route path="purchase/new" element={<PurchaseForm mode="new" />} />
        <Route path="purchase/:id" element={<PurchaseForm mode="detail" />} />
        
        {/* Manufacturing */}
        <Route path="manufacturing" element={<ManufacturingList />} />
        <Route path="manufacturing/new" element={<ManufacturingForm mode="new" />} />
        <Route path="manufacturing/:id" element={<ManufacturingForm mode="detail" />} />
        
        {/* BoM */}
        <Route path="bom" element={<BomList />} />
        <Route path="bom/new" element={<BomForm mode="new" />} />
        <Route path="bom/:id" element={<BomForm mode="detail" />} />
        
        {/* Products */}
        <Route path="products" element={<ProductsList />} />
        <Route path="products/new" element={<ProductForm mode="new" />} />
        <Route path="products/:id" element={<ProductForm mode="detail" />} />
        
        {/* Inventory */}
        <Route path="inventory" element={<StockLedger />} />
        
        {/* Vendors */}
        <Route path="vendors" element={<VendorsList />} />
        <Route path="vendors/new" element={<VendorForm mode="new" />} />
        <Route path="vendors/:id" element={<VendorForm mode="detail" />} />
        
        {/* Customers */}
        <Route path="customers" element={<CustomersList />} />
        <Route path="customers/new" element={<CustomerForm mode="new" />} />
        <Route path="customers/:id" element={<CustomerForm mode="detail" />} />
        
        {/* Work Centers */}
        <Route path="work-centers" element={<WorkCentersList />} />

        {/* Intelligence */}
        <Route path="control-tower" element={<ControlTower />} />
        <Route path="intelligence/procurement" element={<SmartProcurement />} />
        <Route path="intelligence/vendors" element={<VendorScores />} />
        <Route path="intelligence/bottlenecks" element={<BottleneckRadar />} />
        
        {/* Passports */}
        <Route path="passports" element={<PassportsList />} />
        <Route path="passports/:id" element={<PassportDetail />} />
        
        {/* Audit */}
        <Route path="audit" element={<AuditLogs />} />
        
        {/* Users */}
        <Route path="users" element={<UsersList />} />
        <Route path="users/new" element={<UserForm mode="new" />} />
        <Route path="users/me" element={<UserForm mode="me" />} />
        <Route path="users/:id" element={<UserForm mode="detail" />} />
      </Route>
    </Routes>
  );
}
