import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Device, DeviceCategory, DEVICE_CATEGORIES, PriceUploadLog } from '../lib/types';
import { formatCurrency, formatPercent, formatDateTime } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  Plus, Search, Edit2, Trash2, X, Save, Filter, Package,
  Upload, History, RotateCcw, Download, TrendingUp, Info,
} from 'lucide-react';

const emptyDevice: Partial<Device> = {
  model: '', product_name: '', category: '交换机', brand: '华为',
  purchase_price: 0, unit_price: 0, cost_price: 0, discount_rate: 1,
  stock_quantity: 0, unit: '台', notes: '', specs: {},
};

export default function DeviceLibrary() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DeviceCategory | '全部'>('全部');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<Partial<Device>>(emptyDevice);
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLogs, setUploadLogs] = useState<PriceUploadLog[]>([]);
  const [showUploadHistory, setShowUploadHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('equipment').select('*').order('category').order('model');
    if (search.trim()) {
      query = query.or(`model.ilike.%${search}%,product_name.ilike.%${search}%,name.ilike.%${search}%`);
    }
    if (categoryFilter !== '全部') {
      query = query.eq('category', categoryFilter);
    }
    const { data, error } = await query;
    if (error) toast('加载设备数据失败', 'error');
    setDevices(data || []);
    setLoading(false);
  }, [search, categoryFilter, toast]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const fetchUploadLogs = async () => {
    const { data } = await supabase.from('price_upload_logs').select('*').order('created_at', { ascending: false }).limit(20);
    setUploadLogs(data || []);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyDevice });
    setShowForm(true);
  };

  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ ...d });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.model || !form.product_name) return;
    setSaving(true);
    const payload = {
      model: form.model,
      product_name: form.product_name,
      name: form.product_name,
      category: form.category,
      brand: form.brand || '华为',
      purchase_price: Number(form.purchase_price) || 0,
      unit_price: Number(form.unit_price) || 0,
      cost_price: Number(form.purchase_price) || 0,
      discount_rate: Number(form.discount_rate) || 1,
      stock_quantity: Number(form.stock_quantity) || 0,
      unit: form.unit || '台',
      notes: form.notes,
      specs: form.specs || {},
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from('equipment').update(payload).eq('id', editing.id)
      : await supabase.from('equipment').upsert(payload, { onConflict: 'model' });
    if (error) {
      toast('保存失败: ' + error.message, 'error');
    } else {
      toast(editing ? '设备已更新' : '设备已添加', 'success');
    }
    setShowForm(false);
    setSaving(false);
    fetchDevices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此设备吗？')) return;
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) toast('删除失败', 'error');
    else toast('设备已删除', 'success');
    fetchDevices();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      const dataRows = rows.slice(1).filter(r => r[0]);

      // Snapshot current prices for rollback
      const { data: currentDevices } = await supabase.from('equipment').select('model, purchase_price, unit_price');
      const snapshotData = (currentDevices || []).map(d => ({ model: d.model, purchase_price: Number(d.purchase_price), unit_price: Number(d.unit_price) }));

      let updatedCount = 0;
      let insertedCount = 0;

      // Batch process using upsert for efficiency
      const upsertRows = dataRows.map(row => {
        const model = String(row[0] || '').trim();
        const productName = String(row[1] || '').trim();
        const category = String(row[2] || '交换机').trim();
        const purchasePrice = parseFloat(String(row[3])) || 0;
        const salePrice = parseFloat(String(row[4])) || 0;
        const brand = String(row[5] || '华为').trim();
        if (!model) return null;
        return {
          model, product_name: productName, name: productName, category, brand,
          purchase_price: purchasePrice, cost_price: purchasePrice,
          unit_price: salePrice, discount_rate: 1, stock_quantity: 0, unit: '台',
          updated_at: new Date().toISOString(),
        };
      }).filter(Boolean) as Record<string, unknown>[];

      // Check existing models for counting
      const existingModels = new Set((currentDevices || []).map(d => d.model));
      for (const row of upsertRows) {
        const m = row.model as string;
        if (existingModels.has(m)) updatedCount++;
        else insertedCount++;
      }

      const { error: upsertError } = await supabase.from('equipment').upsert(upsertRows, { onConflict: 'model' });
      if (upsertError) {
        toast('上传失败: ' + upsertError.message, 'error');
      } else {
        await supabase.from('price_upload_logs').insert({
          uploaded_by: 'admin',
          file_name: file.name,
          total_rows: dataRows.length,
          updated_rows: updatedCount,
          inserted_rows: insertedCount,
          status: 'completed',
          snapshot: { [new Date().toISOString()]: snapshotData },
        });
        toast(`上传成功: 更新${updatedCount}条, 新增${insertedCount}条`, 'success');
        fetchDevices();
        setShowUpload(false);
      }
    } catch (err) {
      toast('Excel解析失败，请检查文件格式', 'error');
      console.error(err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRollback = async (log: PriceUploadLog) => {
    if (!confirm('确定回滚到此次上传前的价格？')) return;
    if (!log.snapshot) return;
    const entries = Object.values(log.snapshot)[0];
    if (!entries) return;
    let rollbackCount = 0;
    for (const entry of entries) {
      const { error } = await supabase.from('equipment').update({
        purchase_price: entry.purchase_price,
        cost_price: entry.purchase_price,
        unit_price: entry.unit_price,
        updated_at: new Date().toISOString(),
      }).eq('model', entry.model);
      if (!error) rollbackCount++;
    }
    toast(`已回滚${rollbackCount}条设备价格`, 'success');
    fetchDevices();
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const header = ['型号', '产品名称', '分类', '采购价', '销售价', '品牌'];
    const examples = [
      ['S5735-L24T4X-A1', 'CloudEngine S5735-L24T4X-A1', '交换机', 4200, 5800, '华为'],
      ['USG6625F-C', 'HiSecEngine USG6625F-C', '防火墙', 18500, 26000, '华为'],
      ['AP8050DN', 'AirEngine AP8050DN', 'AP', 2200, 3200, '华为'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...examples]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '价格模板');
    XLSX.writeFile(wb, '设备价格更新模板.xlsx');
  };

  const categoryColors: Record<string, string> = {
    '交换机': 'bg-blue-100 text-blue-700',
    '防火墙': 'bg-orange-100 text-orange-700',
    '路由器': 'bg-cyan-100 text-cyan-700',
    'AC': 'bg-purple-100 text-purple-700',
    'AP': 'bg-green-100 text-green-700',
    '光模块': 'bg-amber-100 text-amber-700',
    '服务器': 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜索型号，如 S5735-L24T4X-A1 / USG6625F-C / AP8050DN ..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as DeviceCategory | '全部')}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
              <option value="全部">全部分类</option>
              {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm">
                <Upload className="w-4 h-4" /> 上传Excel
              </button>
              <button onClick={() => { fetchUploadLogs(); setShowUploadHistory(true); }}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition shadow-sm">
                <History className="w-4 h-4" /> 上传记录
              </button>
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition shadow-sm">
                <Plus className="w-4 h-4" /> 添加设备
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-4 gap-3 md:grid-cols-7">
        {DEVICE_CATEGORIES.map(cat => {
          const count = devices.filter(d => d.category === cat).length;
          return (
            <div key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '全部' : cat)}
              className={`rounded-xl p-3 text-center cursor-pointer transition border ${
                categoryFilter === cat
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-white border-slate-100 shadow-sm hover:border-blue-200'
              }`}>
              <div className={`text-2xl font-bold ${categoryFilter === cat ? 'text-white' : 'text-blue-800'}`}>{count}</div>
              <div className={`text-xs mt-0.5 ${categoryFilter === cat ? 'text-blue-200' : 'text-slate-500'}`}>{cat}</div>
            </div>
          );
        })}
      </div>

      {/* Device Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无设备数据</p>
          <p className="text-slate-400 text-sm mt-1">{isAdmin ? '点击"添加设备"或"上传Excel"开始录入' : '暂无可用设备'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">分类</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">型号</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">产品名称</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">品牌</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-600">采购价</th>}
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">销售价</th>
                  {isAdmin && <><th className="text-right px-4 py-3 font-semibold text-slate-600">利润</th><th className="text-right px-4 py-3 font-semibold text-slate-600">利润率</th></>}
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">更新时间</th>
                  {isAdmin && <><th className="text-right px-4 py-3 font-semibold text-slate-600">库存</th><th className="text-center px-4 py-3 font-semibold text-slate-600">操作</th></>}
                </tr>
              </thead>
              <tbody>
                {devices.map(d => {
                  const profit = d.unit_price - (d.purchase_price || d.cost_price);
                  const profitRate = d.unit_price > 0 ? profit / d.unit_price : 0;
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${categoryColors[d.category] || 'bg-slate-100 text-slate-600'}`}>{d.category}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-800 font-medium">{d.model}</td>
                      <td className="px-4 py-3 text-slate-600">{d.product_name || d.name}</td>
                      <td className="px-4 py-3 text-slate-500">{d.brand || '华为'}</td>
                      {isAdmin && <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(d.purchase_price || d.cost_price)}</td>}
                      <td className="px-4 py-3 text-right text-blue-700 font-semibold">{formatCurrency(d.unit_price)}</td>
                      {isAdmin && <>
                        <td className={`px-4 py-3 text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(profit)}</td>
                        <td className={`px-4 py-3 text-right ${profitRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatPercent(profitRate)}</td>
                      </>}
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(d.updated_at)}</td>
                      {isAdmin && <>
                        <td className="px-4 py-3 text-right"><span className={`font-medium ${d.stock_quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{d.stock_quantity}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(d)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">上传Excel更新价格</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700 space-y-1">
                    <p className="font-semibold">Excel格式要求</p>
                    <p>型号 | 产品名称 | 分类 | 采购价 | 销售价 | 品牌</p>
                    <p className="text-xs text-blue-500">型号已存在则更新价格，不存在则自动新增</p>
                  </div>
                </div>
              </div>
              <button onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-blue-400 hover:text-blue-600 transition">
                <Download className="w-5 h-5" /> 下载Excel模板
              </button>
              <div className="relative">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
                  <Upload className="w-5 h-5" /> {uploading ? '正在处理...' : '选择Excel文件上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload History Modal */}
      {showUploadHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUploadHistory(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800">上传历史记录</h2>
              <button onClick={() => setShowUploadHistory(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {uploadLogs.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无上传记录</p>
              ) : (
                <div className="space-y-3">
                  {uploadLogs.map(log => (
                    <div key={log.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-800 text-sm">{log.file_name}</span>
                        <span className="text-xs text-slate-400">{formatDateTime(log.created_at)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500 mb-3">
                        <span>总行数: {log.total_rows}</span>
                        <span>更新: <span className="text-blue-600">{log.updated_rows}</span></span>
                        <span>新增: <span className="text-emerald-600">{log.inserted_rows}</span></span>
                      </div>
                      {log.snapshot && (
                        <button onClick={() => handleRollback(log)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition">
                          <RotateCcw className="w-3 h-3" /> 回滚此版本
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '编辑设备' : '添加设备'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">分类</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as DeviceCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {DEVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">型号</label>
                  <input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="如 S5735-L24T4X-A1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">产品名称</label>
                  <input value={form.product_name || ''} onChange={e => setForm({ ...form, product_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">品牌</label>
                  <input value={form.brand || '华为'} onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">采购价</label>
                  <input type="number" value={form.purchase_price || ''} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value), cost_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">销售价</label>
                  <input type="number" value={form.unit_price || ''} onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">折扣率</label>
                  <input type="number" step="0.01" value={form.discount_rate ?? ''} onChange={e => setForm({ ...form, discount_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">库存数量</label>
                  <input type="number" value={form.stock_quantity ?? ''} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">单位</label>
                  <input value={form.unit || '台'} onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">备注</label>
                <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              {(form.unit_price ?? 0) > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">
                    利润: {formatCurrency((form.unit_price ?? 0) - (form.purchase_price || 0))} |
                    利润率: {formatPercent((form.unit_price ?? 0) > 0 ? ((form.unit_price ?? 0) - (form.purchase_price || 0)) / (form.unit_price ?? 0) : 0)}
                  </span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
              <button onClick={handleSave} disabled={saving || !form.model || !form.product_name}
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
