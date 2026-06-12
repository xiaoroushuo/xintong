import { useState } from 'react';
import { Database, Users, FileText, BarChart3, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import DeviceLibrary from './pages/DeviceLibrary';
import CustomerManagement from './pages/CustomerManagement';
import QuotationManagement from './pages/QuotationManagement';
import ProfitAnalysis from './pages/ProfitAnalysis';
import MyProfile from './pages/MyProfile';

type Tab = 'devices' | 'customers' | 'quotations' | 'analysis' | 'profile';

const tabs: { key: Tab; label: string; icon: typeof Database; adminOnly?: boolean }[] = [
  { key: 'devices', label: '设备库', icon: Database },
  { key: 'customers', label: '客户', icon: Users, adminOnly: true },
  { key: 'quotations', label: '报价单', icon: FileText, adminOnly: true },
  { key: 'analysis', label: '分析', icon: BarChart3, adminOnly: true },
  { key: 'profile', label: '我的', icon: User },
];

function AppContent() {
  const { isLoggedIn, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('devices');

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 text-white px-4 py-3 shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">网络设备销售ERP</h1>
              <p className="text-blue-200 text-[10px]">华为企业级网络设备销售管理平台</p>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-4">
          <MyProfile />
        </main>
      </div>
    );
  }

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);
  const currentTab = visibleTabs.find(t => t.key === activeTab) ? activeTab : visibleTabs[0].key;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 text-white px-4 py-3 shadow-lg flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold tracking-tight">网络设备销售ERP</h1>
            <p className="text-blue-200 text-[10px]">华为企业级网络设备销售管理平台</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              isAdmin ? 'bg-amber-400/30 text-amber-200' : 'bg-blue-300/30 text-blue-200'
            }`}>
              {isAdmin ? '管理员' : '员工'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {currentTab === 'devices' && <DeviceLibrary />}
          {currentTab === 'customers' && <CustomerManagement />}
          {currentTab === 'quotations' && <QuotationManagement />}
          {currentTab === 'analysis' && <ProfitAnalysis />}
          {currentTab === 'profile' && <MyProfile />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-50">
        <div className="max-w-5xl mx-auto flex">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors duration-200 relative ${
                currentTab === key ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${currentTab === key ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] ${currentTab === key ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
              {currentTab === key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-700 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
