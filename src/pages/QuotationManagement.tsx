import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Device, Customer, Quotation, QuotationItem, QUOTATION_STATUS_MAP } from '../lib/types';
import { formatCurrency, generateQuoteNumber, calcSubtotal, calcTax } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  Plus, Search, X, Save, FileText, ChevronRight,
  Download, FileDown, ArrowLeft, Send, CheckCircle, XCircle,
  Share2,
} from 'lucide-react';

interface QuotationFormItem {
  equipment_id: string;
  equipment_name: string;
  equipment_model: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
}

const emptyItem: QuotationFormItem = {
  equipment_id: '', equipment_name: '', equipment_model: '',
  quantity: 1, unit_price: 0, cost_price: 0, discount_percent: 0,
};

interface QuotationForm {
  customer_id: string;
  title: string;
  tax_rate: number;
  discount_percent: number;
  notes: string;
  items: QuotationFormItem[];
}

export default function QuotationManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [viewing, setViewing] = useState<Quotation | null>(null);
  const [viewItems, setViewItems] = useState<QuotationItem[]>([]);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [form, setForm] = useState<QuotationForm>({
    customer_id: '', title: '', tax_rate: 13, discount_percent: 0, notes: '', items: [{ ...emptyItem }],
  });
  const [saving, setSaving] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [addingItemIndex, setAddingItemIndex] = useState<number | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('quotations').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      query = query.or(`quote_number.ilike.%${search}%,title.ilike.%${search}%`);
    }
    const { data } = await query;
    setQuotations(data || []);
    setLoading(false);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers(data || []);
  }, []);

  const fetchDevices = useCallback(async () => {
    const { data } = await supabase.from('equipment').select('*').order('model');
    setDevices(data || []);
  }, []);

  useEffect(() => { fetchQuotations(); fetchCustomers(); fetchDevices(); }, [fetchQuotations, fetchCustomers, fetchDevices]);

  const openAdd = () => {
    if (!isAdmin) return;
    setEditing(null);
    setForm({ customer_id: '', title: '', tax_rate: 13, discount_percent: 0, notes: '', items: [{ ...emptyItem }] });
    setShowForm(true);
  };

  const openEdit = async (q: Quotation) => {
    if (!isAdmin) return;
    const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id);
    setEditing(q);
    setForm({
      customer_id: q.customer_id || '',
      title: q.title,
      tax_rate: q.tax_rate || 13,
      discount_percent: q.discount_percent || 0,
      notes: q.notes || '',
      items: (items || []).map(i => ({
        equipment_id: i.equipment_id || '',
        equipment_name: i.equipment_name,
        equipment_model: i.equipment_model || '',
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        cost_price: Number(i.cost_price),
        discount_percent: Number(i.discount_percent),
      })),
    });
    setShowForm(true);
  };

  const viewDetail = async (q: Quotation) => {
    const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id).order('created_at');
    setViewItems(items || []);
    const cust = customers.find(c => c.id === q.customer_id);
    setViewCustomer(cust || null);
    setViewing(q);
  };

  const handleSave = async () => {
    if (!form.title || form.items.length === 0) return;
    setSaving(true);
    const totalAmount = form.items.reduce((sum, it) => sum + calcSubtotal(it.unit_price, it.quantity, it.discount_percent), 0);
    const totalCost = form.items.reduce((sum, it) => sum + it.cost_price * it.quantity, 0);
    const discountAmount = totalAmount * form.discount_percent / 100;
    const netAmount = totalAmount - discountAmount;
    const tax = calcTax(netAmount, form.tax_rate);
    const finalAmount = netAmount + tax;
    const profit = netAmount - totalCost;

    const payload = {
      quote_number: editing?.quote_number || generateQuoteNumber(),
      customer_id: form.customer_id || null,
      title: form.title,
      tax_rate: form.tax_rate,
      discount_percent: form.discount_percent,
      total_amount: finalAmount,
      total_cost: totalCost,
      profit_amount: profit,
      notes: form.notes || null,
    };

    let quoteId: string;
    if (editing) {
      const { error } = await supabase.from('quotations').update(payload).eq('id', editing.id);
      if (error) { toast('更新报价单失败', 'error'); setSaving(false); return; }
      await supabase.from('quotation_items').delete().eq('quotation_id', editing.id);
      quoteId = editing.id;
    } else {
      const { data, error } = await supabase.from('quotations').insert(payload).select().single();
      if (error || !data) { toast('创建报价单失败', 'error'); setSaving(false); return; }
      quoteId = data.id;
    }

    const itemPayloads = form.items.map(it => ({
      quotation_id: quoteId,
      equipment_id: it.equipment_id || null,
      equipment_name: it.equipment_name,
      equipment_model: it.equipment_model || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      cost_price: it.cost_price,
      discount_percent: it.discount_percent,
      subtotal: calcSubtotal(it.unit_price, it.quantity, it.discount_percent),
    }));
    await supabase.from('quotation_items').insert(itemPayloads);
    toast(editing ? '报价单已更新' : '报价单已创建', 'success');
    setShowForm(false);
    setSaving(false);
    fetchQuotations();
  };

  const updateStatus = async (id: string, status: Quotation['status']) => {
    await supabase.from('quotations').update({ status }).eq('id', id);
    fetchQuotations();
    if (viewing?.id === id) setViewing({ ...viewing, status });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此报价单吗？')) return;
    await supabase.from('quotation_items').delete().eq('quotation_id', id);
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) toast('删除失败', 'error'); else toast('报价单已删除', 'success');
    fetchQuotations();
    if (viewing?.id === id) setViewing(null);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const updateItem = (idx: number, field: keyof QuotationFormItem, value: string | number) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };
  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const selectDevice = (idx: number, d: Device) => {
    const items = [...form.items];
    items[idx] = {
      ...items[idx],
      equipment_id: d.id,
      equipment_name: d.product_name || d.name,
      equipment_model: d.model,
      unit_price: d.unit_price,
      cost_price: d.purchase_price || d.cost_price,
    };
    setForm({ ...form, items });
    setAddingItemIndex(null);
    setDeviceSearch('');
  };

  const filteredDevices = addingItemIndex !== null
    ? devices.filter(d => d.model.toLowerCase().includes(deviceSearch.toLowerCase()) || (d.product_name || d.name).toLowerCase().includes(deviceSearch.toLowerCase()))
    : [];

  const formTotalAmount = form.items.reduce((sum, it) => sum + calcSubtotal(it.unit_price, it.quantity, it.discount_percent), 0);
  const formTotalCost = form.items.reduce((sum, it) => sum + it.cost_price * it.quantity, 0);
  const formDiscountAmt = formTotalAmount * form.discount_percent / 100;
  const formNetAmount = formTotalAmount - formDiscountAmt;
  const formTax = calcTax(formNetAmount, form.tax_rate);
  const formFinalAmount = formNetAmount + formTax;
  const formProfit = formNetAmount - formTotalCost;

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text('QUOTATION', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Quote No: ${viewing?.quote_number}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString('zh-CN')}`, 14, 36);
    if (viewCustomer) {
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(12);
      doc.text(`Customer: ${viewCustomer.name}`, 14, 44);
      doc.setTextColor(100);
      doc.setFontSize(10);
      if (viewCustomer.contact_person) doc.text(`Contact: ${viewCustomer.contact_person}  Tel: ${viewCustomer.phone || '-'}`, 14, 50);
      if (viewCustomer.company) doc.text(`Company: ${viewCustomer.company}`, 14, 56);
    }

    autoTable(doc, {
      startY: viewCustomer?.company ? 62 : 44,
      head: [['#', 'Model', 'Product Name', 'Qty', 'Unit Price (CNY)', 'Disc%', 'Amount (CNY)']],
      body: viewItems.map((i, idx) => [
        idx + 1,
        i.equipment_model || '-',
        i.equipment_name,
        i.quantity,
        Number(i.unit_price).toFixed(2),
        `${i.discount_percent}%`,
        Number(i.subtotal).toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 12 }, 4: { halign: 'right' }, 6: { halign: 'right' } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const totalAmt = viewItems.reduce((s, i) => s + Number(i.subtotal), 0);
    const taxAmt = calcTax(totalAmt, viewing?.tax_rate || 13);
    const startY = finalY + 8;
    doc.text(`Subtotal: CNY ${totalAmt.toFixed(2)}`, 140, startY);
    doc.text(`Tax (${viewing?.tax_rate || 13}%): CNY ${taxAmt.toFixed(2)}`, 140, startY + 6);
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(`TOTAL: CNY ${(totalAmt + taxAmt).toFixed(2)}`, 140, startY + 14);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by Network Equipment ERP System', 14, 285);
    doc.save(`quotation-${viewing?.quote_number}.pdf`);
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const totalAmt = viewItems.reduce((s, i) => s + Number(i.subtotal), 0);
    const taxAmt = calcTax(totalAmt, viewing?.tax_rate || 13);
    const wsData = [
      ['报价单', viewing?.title],
      ['报价编号', viewing?.quote_number],
      ['客户', viewCustomer?.name || ''],
      ['联系人', viewCustomer?.contact_person || ''],
      ['电话', viewCustomer?.phone || ''],
      ['公司', viewCustomer?.company || ''],
      [''],
      ['序号', '型号', '产品名称', '数量', '单价', '折扣', '金额'],
      ...viewItems.map((i, idx) => [idx + 1, i.equipment_model || '', i.equipment_name, i.quantity, Number(i.unit_price), `${i.discount_percent}%`, Number(i.subtotal)]),
      [''],
      ['设备总价', totalAmt],
      ['税金', taxAmt],
      ['最终报价', totalAmt + taxAmt],
      ['利润', viewing?.profit_amount || 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '报价单');
    XLSX.writeFile(wb, `quotation-${viewing?.quote_number}.xlsx`);
  };

  const copyShareLink = () => {
    const text = `报价单 ${viewing?.quote_number}\n客户: ${viewCustomer?.name || '-'}\n总金额: ${formatCurrency(viewItems.reduce((s, i) => s + Number(i.subtotal), 0) + calcTax(viewItems.reduce((s, i) => s + Number(i.subtotal), 0), viewing?.tax_rate || 13))}\n\n${viewItems.map(i => `${i.equipment_model || '-'} ${i.equipment_name} x${i.quantity} = ${formatCurrency(Number(i.subtotal))}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    alert('报价信息已复制，可粘贴到微信发送');
  };

  // Detail View
  if (viewing) {
    const totalAmt = viewItems.reduce((s, i) => s + Number(i.subtotal), 0);
    const taxAmt = calcTax(totalAmt, viewing.tax_rate || 13);
    const finalAmt = totalAmt + taxAmt;
    const statusInfo = QUOTATION_STATUS_MAP[viewing.status];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewing(null)} className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">{viewing.title}</h2>
            <p className="text-sm text-slate-500">{viewing.quote_number}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        {viewCustomer && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-700 mb-2">客户信息</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
              <div>名称: {viewCustomer.name}</div>
              <div>联系人: {viewCustomer.contact_person || '-'}</div>
              <div>电话: {viewCustomer.phone || '-'}</div>
              <div>公司: {viewCustomer.company || '-'}</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">型号</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">产品名称</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">数量</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">单价</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">折扣</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">金额</th>
              </tr>
            </thead>
            <tbody>
              {viewItems.map(it => (
                <tr key={it.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-800">{it.equipment_model || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{it.equipment_name}</td>
                  <td className="px-4 py-3 text-right">{it.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(it.unit_price))}</td>
                  <td className="px-4 py-3 text-right">{it.discount_percent}%</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{formatCurrency(Number(it.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-500">设备总价</span><span className="text-slate-700">{formatCurrency(totalAmt)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">税金 ({viewing.tax_rate || 13}%)</span><span className="text-slate-700">{formatCurrency(taxAmt)}</span></div>
          {isAdmin && (
            <div className="flex justify-between text-sm"><span className="text-slate-500">利润</span>
              <span className={(viewing.profit_amount || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(viewing.profit_amount || 0)}</span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
            <span className="text-slate-800">最终报价</span>
            <span className="text-blue-700 text-lg">{formatCurrency(finalAmt)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={exportPDF} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition">
            <Download className="w-4 h-4" /> 导出PDF
          </button>
          <button onClick={exportExcel} className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition">
            <FileDown className="w-4 h-4" /> 导出Excel
          </button>
          <button onClick={copyShareLink} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Share2 className="w-4 h-4" /> 微信分享
          </button>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <button onClick={() => openEdit(viewing)} className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition">编辑</button>
            <button onClick={() => handleDelete(viewing.id)} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 transition">删除</button>
            {viewing.status === 'draft' && (
              <button onClick={() => updateStatus(viewing.id, 'sent')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200 transition">
                <Send className="w-4 h-4" /> 发送
              </button>
            )}
            {viewing.status === 'sent' && (
              <>
                <button onClick={() => updateStatus(viewing.id, 'accepted')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200 transition">
                  <CheckCircle className="w-4 h-4" /> 接受
                </button>
                <button onClick={() => updateStatus(viewing.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition">
                  <XCircle className="w-4 h-4" /> 拒绝
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜索报价编号、标题 ..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition shadow-sm">
              <Plus className="w-4 h-4" /> 新建报价
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : quotations.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无报价单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotations.map(q => {
            const status = QUOTATION_STATUS_MAP[q.status];
            const cust = customers.find(c => c.id === q.customer_id);
            return (
              <div key={q.id} onClick={() => viewDetail(q)}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 truncate">{q.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{q.quote_number}</span>
                      {cust && <span>客户: {cust.name}</span>}
                      <span>{new Date(q.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-700">{formatCurrency(q.total_amount)}</span>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '编辑报价单' : '新建报价单'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">报价标题 *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">客户</label>
                  <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">选择客户</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">税率 (%)</label>
                  <input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">整体折扣 (%)</label>
                  <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">设备列表</label>
                  <button onClick={addItem} className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
                    <Plus className="w-3 h-3" /> 添加设备
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200 relative">
                      {form.items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-slate-500">#{idx + 1}</span>
                        <div className="relative flex-1">
                          <input value={item.equipment_model || ''} readOnly placeholder="点击搜索选择设备..."
                            onClick={() => { setAddingItemIndex(idx); setDeviceSearch(''); }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {item.equipment_name && <span className="ml-2 text-xs text-slate-500">{item.equipment_name}</span>}
                        </div>
                      </div>
                      {addingItemIndex === idx && (
                        <div className="mb-2 bg-white border border-slate-200 rounded-lg p-2 shadow-lg">
                          <input value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)}
                            placeholder="搜索型号或名称..." autoFocus
                            className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {filteredDevices.slice(0, 10).map(d => (
                              <button key={d.id} onClick={() => selectDevice(idx, d)}
                                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-blue-50 flex justify-between">
                                <span className="font-mono text-slate-700">{d.model}</span>
                                <span className="text-slate-500">{d.product_name || d.name} | {formatCurrency(d.unit_price)}</span>
                              </button>
                            ))}
                            {filteredDevices.length === 0 && <p className="text-xs text-slate-400 px-2">无匹配设备</p>}
                          </div>
                          <button onClick={() => setAddingItemIndex(null)} className="text-xs text-slate-400 mt-1 hover:text-slate-600">关闭</button>
                        </div>
                      )}
                      <div className={`grid gap-2 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">数量</label>
                          <input type="number" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">单价</label>
                          <input type="number" value={item.unit_price || ''} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        {isAdmin && (
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">采购价</label>
                            <input type="number" value={item.cost_price || ''} onChange={e => updateItem(idx, 'cost_price', Number(e.target.value))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">折扣%</label>
                          <input type="number" value={item.discount_percent || ''} onChange={e => updateItem(idx, 'discount_percent', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="mt-2 text-right text-sm font-semibold text-blue-700">
                        小计: {formatCurrency(calcSubtotal(item.unit_price, item.quantity, item.discount_percent))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-slate-600">设备总价</span><span>{formatCurrency(formTotalAmount)}</span></div>
                {form.discount_percent > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-slate-600">折扣 ({form.discount_percent}%)</span><span>-{formatCurrency(formDiscountAmt)}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-slate-600">税金 ({form.tax_rate}%)</span><span>{formatCurrency(formTax)}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-blue-200 pt-1.5">
                  <span className="text-blue-800">最终报价</span><span className="text-blue-800">{formatCurrency(formFinalAmount)}</span>
                </div>
                {isAdmin && (
                  <div className="flex justify-between text-sm"><span className="text-slate-600">利润</span>
                    <span className={formProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(formProfit)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">备注</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">取消</button>
              <button onClick={handleSave} disabled={saving || !form.title}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50 transition">
                <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存报价单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
