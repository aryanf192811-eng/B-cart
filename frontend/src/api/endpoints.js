export const E = {
  // Auth
  login: () => '/auth/login',
  signup: () => '/auth/signup',
  refresh: () => '/auth/refresh',
  logout: () => '/auth/logout',
  me: () => '/auth/me',
  // Users
  users: () => '/users',
  user: (id) => `/users/${id}`,
  userMe: () => '/users/me',
  userAccess: (id) => `/users/${id}/access`,
  avatarUpload: () => '/users/me/avatar',
  // Master data
  categories: () => '/categories',
  products: () => '/products',
  product: (id) => `/products/${id}`,
  productBreakdown: (id) => `/products/${id}/inventory-breakdown`,
  productImage: (id) => `/products/${id}/image`,
  vendors: () => '/vendors',
  vendor: (id) => `/vendors/${id}`,
  vendorPerformance: (id) => `/vendors/${id}/performance`,
  customers: () => '/customers',
  customer: (id) => `/customers/${id}`,
  workCenters: () => '/work-centers',
  workCenter: (id) => `/work-centers/${id}`,
  bom: () => '/bom',
  bomOne: (id) => `/bom/${id}`,
  // Sales
  sales: () => '/sales',
  salesOne: (id) => `/sales/${id}`,
  salesCounts: () => '/sales/counts',
  salesConfirm: (id) => `/sales/${id}/confirm`,
  salesDeliver: (id) => `/sales/${id}/deliver`,
  salesCancel: (id) => `/sales/${id}/cancel`,
  salesPdf: (id) => `/sales/${id}/pdf`,
  // Purchase
  purchase: () => '/purchase',
  purchaseOne: (id) => `/purchase/${id}`,
  purchaseCounts: () => '/purchase/counts',
  purchaseConfirm: (id) => `/purchase/${id}/confirm`,
  purchaseReceive: (id) => `/purchase/${id}/receive`,
  purchaseCancel: (id) => `/purchase/${id}/cancel`,
  purchasePay: (id) => `/purchase/${id}/pay`,
  purchaseVerify: () => '/purchase/payment/verify',
  purchasePdf: (id) => `/purchase/${id}/pdf`,
  // Manufacturing
  mo: () => '/manufacturing',
  moOne: (id) => `/manufacturing/${id}`,
  moCounts: () => '/manufacturing/counts',
  moConfirm: (id) => `/manufacturing/${id}/confirm`,
  moProduce: (id) => `/manufacturing/${id}/produce`,
  moCancel: (id) => `/manufacturing/${id}/cancel`,
  woStart: (mo, wo) => `/manufacturing/${mo}/work-orders/${wo}/start`,
  woPause: (mo, wo) => `/manufacturing/${mo}/work-orders/${wo}/pause`,
  woResume: (mo, wo) => `/manufacturing/${mo}/work-orders/${wo}/resume`,
  woDone: (mo, wo) => `/manufacturing/${mo}/work-orders/${wo}/done`,
  moPdf: (id) => `/manufacturing/${id}/pdf`,
  // Inventory
  ledger: () => '/inventory/ledger',
  invSummary: () => '/inventory/summary',
  invAdjust: () => '/inventory/adjust',
  // Passports
  passports: () => '/passports',
  passport: (id) => `/passports/${id}`,
  passportQc: (id) => `/passports/${id}/qc`,
  passportPdf: (id) => `/passports/${id}/pdf`,
  // Intelligence
  intelProc: () => '/intelligence/procurement-alerts',
  intelVendors: () => '/intelligence/vendor-scores',
  intelBottlenecks: () => '/intelligence/bottlenecks',
  controlTower: () => '/intelligence/control-tower',
  // Dashboard
  kpis: () => '/dashboard/kpis', 
  // Audit
  audit: () => '/audit',
  auditStats: () => '/audit/stats',
  // Chat
  chat: () => '/chat',
  chatSnapshot: () => '/chat/snapshot.json',
  // Reports
  reportStock: () => '/reports/stock/pdf',
  reportVendor: () => '/reports/vendor/pdf'
};
