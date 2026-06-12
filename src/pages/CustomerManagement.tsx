import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Quotation } from '../lib/types';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { QUOTATION_STATUS_MAP } from '../lib/types';
import {
  Plus, Search, Edit2, Trash2, X, Save, Users, Phone, MapPin,
  Briefcase, Building2, ChevronRight, ArrowLeft,
} from 'lucide-react';

const emptyCustomer: Partial<Customer> = {
  name: '', contact_person: '', phone: '', email: '',
  company: '', project_name: '', address: '', notes: '',
};

export default function CustomerManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [customerQuotes, setCustomerQuotes] = useState<Quotation[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%,project_name.ilike.%${search}%,company.ilike.%${search}%`);
    }
    const { data } = await query;
    setCustomers(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyCustomer });
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ ...c });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      company: form.company || null,
      project_name: form.project_name || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editing.id);
      if (error) toast('保存失败', 'error'); else toast('客户已更新', 'success');
    } else {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) toast('添加失败', 'error'); else toast('客户已添加', 'success');
    }
    setShowForm(false);
    setSaving(false);
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此客户吗？')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast('删除失败', 'error'); else toast('客户已删除', 'success');
    fetchCustomers();
  };

  const viewCustomer = async (c: Customer) => {
    setViewing(c);
    const { data } = await supabase.from('quotations').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
    setCustomerQuotes(data || []);
  };

  // Customer Detail View
  if (viewing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewing(null)} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">{viewing.name}</h2>
            <p className="text-sm text-slate-500">客户详情</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {viewing.contact_person && (
              <div className="flex items-center gap-2 text-slate-600"><Users className="w-4 h-4 text-slate-400" /> {viewing.contact_person}</div>
            )}
            {viewing.phone && (
              <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-slate-400" /> {viewing.phone}</div>
            )}
            {viewing.company && (
              <div className="flex items-center gap-2 text-slate-600"><Building2 className="w-4 h-4 text-slate-400" /> {viewing.company}</div>
            )}
            {viewing.project_name && (
              <div className="flex items-center gap-2 text-slate-600"><Briefcase className="w-4 h-4 text-slate-400" /> {viewing.project_name}</div>
            )}
            {viewing.address && (
              <div className="flex items-center gap-2 text-slate-600 col-span-2"><MapPin className="w-4 h-4 text-slate-400" /> {viewing.address}</div>
            )}
            {viewing.notes && <p className="text-xs text-slate-400 italic col-span-2">{viewing.notes}</p>}
          </div>
        </div>

        {/* Linked Quotations */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">历史报价记录 ({customerQuotes.length})</h3>
          </div>
          {customerQuotes.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">暂无报价记录</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {customerQuotes.map(q => {
                const status = QUOTATION_STATUS_MAP[q.status];
                return (
                  <div key={q.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{q.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <span className="text-xs text-slate-400">{q.quote_number} · {formatDate(q.created_at)}</span>
                    </div>
                    <span className="font-semibold text-blue-700">{formatCurrency(q.total_amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜索客户名称、联系人、项目、公司 ..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition shadow-sm">
              <Plus className="w-4 h-4" /> 添加客户
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无客户数据</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {customers.map(c => (
            <div key={c.id} onClick={() => viewCustomer(c)}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800">{c.name}</h3>
                  {c.company && <div className="flex items-center gap-1 mt-0.5 text-xs text-blue-600"><Building2 className="w-3 h-3" /> {c.company}</div>}
                  {c.project_name && <div className="flex items-center gap-1 mt-0.5 text-xs text-emerald-600"><Briefcase className="w-3 h-3" /> {c.project_name}</div>}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                {c.contact_person && <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-slate-400" /> {c.contact_person}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}</div>}
                {c.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {c.address}</div>}
              </div>
              {isAdmin && (
                <div className="flex gap-1 mt-3 pt-2 border-t border-slate-50">
                  <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '编辑客户' : '添加客户'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">客户名称 *</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">联系人</label>
                  <input value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">电话</label>
                  <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">公司</label>
                  <input value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">项目名称</label>
                  <input value={form.project_name || ''} onChange={e => setForm({ ...form, project_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">地址</label>
                <input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">备注</label>
                <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50 transition">
                <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
