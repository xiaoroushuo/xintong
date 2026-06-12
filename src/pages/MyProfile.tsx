import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { UserRole } from '../lib/types';
import {
  User, Shield, ShieldCheck, LogOut, Database,
  FileText, Users, BarChart3, Info,
} from 'lucide-react';

export default function MyProfile() {
  const { role, isLoggedIn, userName, login, logout, isAdmin } = useAuth();
  const { toast } = useToast();

  if (!isLoggedIn) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            {isAdmin ? <ShieldCheck className="w-8 h-8" /> : <User className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-xl font-bold">{userName || (isAdmin ? '管理员' : '员工')}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isAdmin ? 'bg-amber-400/30 text-amber-200' : 'bg-blue-300/30 text-blue-200'
              }`}>
                {isAdmin ? '管理员' : '员工'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Info */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" /> 权限说明
        </h3>
        <div className="space-y-2">
          {[
            { icon: Database, label: '搜索查看设备价格', admin: true, employee: true },
            { icon: FileText, label: '创建和管理报价单', admin: true, employee: false },
            { icon: Users, label: '管理客户信息', admin: true, employee: false },
            { icon: BarChart3, label: '查看利润分析', admin: true, employee: false },
            { icon: Info, label: '上传Excel更新价格', admin: true, employee: false },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <item.icon className="w-4 h-4 text-slate-400" />
                {item.label}
              </div>
              <div className="flex gap-3 text-xs">
                <span className={item.admin ? 'text-emerald-600' : 'text-slate-300'}>管理员</span>
                <span className={item.employee ? 'text-emerald-600' : 'text-slate-300'}>员工</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3">系统信息</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between py-1">
            <span>系统版本</span><span className="text-slate-400">v2.0 ERP</span>
          </div>
          <div className="flex justify-between py-1">
            <span>数据存储</span><span className="text-slate-400">Supabase Cloud</span>
          </div>
          <div className="flex justify-between py-1">
            <span>当前角色</span><span className={isAdmin ? 'text-blue-600' : 'text-slate-600'}>{isAdmin ? '管理员 (全权限)' : '员工 (只读)'}</span>
          </div>
        </div>
      </div>

      {/* Switch Role */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3">切换角色</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => login('employee', '销售员工')}
            className={`p-4 rounded-xl border-2 transition text-center ${role === 'employee' ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <User className="w-8 h-8 mx-auto mb-2 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">员工模式</p>
            <p className="text-xs text-slate-400 mt-1">只读，快速查价</p>
          </button>
          <button onClick={() => login('admin', '系统管理员')}
            className={`p-4 rounded-xl border-2 transition text-center ${role === 'admin' ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-blue-700" />
            <p className="text-sm font-medium text-slate-700">管理员模式</p>
            <p className="text-xs text-slate-400 mt-1">全权限管理</p>
          </button>
        </div>
      </div>

      {/* Logout */}
      <button onClick={() => { logout(); toast('已退出登录', 'info'); }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition">
        <LogOut className="w-4 h-4" /> 退出登录
      </button>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (role: UserRole, name: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="w-20 h-20 bg-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
        <ShieldCheck className="w-10 h-10 text-white" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">网络设备销售ERP</h1>
        <p className="text-slate-400 text-sm mt-1">请选择登录身份</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <button onClick={() => onLogin('admin', '系统管理员')}
          className="w-full flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-700" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-800">管理员登录</p>
            <p className="text-xs text-slate-400">全权限：设备管理、报价、客户、利润、Excel上传</p>
          </div>
        </button>
        <button onClick={() => onLogin('employee', '销售员工')}
          className="w-full flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:shadow-md transition shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-emerald-700" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-800">员工登录</p>
            <p className="text-xs text-slate-400">只读：快速查询设备价格、分类筛选</p>
          </div>
        </button>
      </div>
    </div>
  );
}
