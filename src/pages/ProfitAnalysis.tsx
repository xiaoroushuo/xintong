import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Quotation, QuotationItem, TIME_FILTERS, TimeFilter } from '../lib/types';
import { formatCurrency, formatPercent, isInRange } from '../lib/utils';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Award, Package } from 'lucide-react';

export default function ProfitAnalysis() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, QuotationItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimeFilter>('month');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: quotes } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
      if (quotes) {
        setQuotations(quotes);
        const details: Record<string, QuotationItem[]> = {};
        for (const q of quotes) {
          const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id);
          if (items) details[q.id] = items;
        }
        setItemDetails(details);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredQuotes = quotations.filter(q => isInRange(q.created_at, period));

  const totalSales = filteredQuotes.reduce((s, q) => s + Number(q.total_amount), 0);
  const totalCost = filteredQuotes.reduce((s, q) => {
    const items = itemDetails[q.id] || [];
    return s + items.reduce((si, i) => si + Number(i.cost_price) * i.quantity, 0);
  }, 0);
  const totalProfit = totalSales - totalCost;
  const profitRate = totalSales > 0 ? totalProfit / totalSales : 0;
  const acceptedQuotes = filteredQuotes.filter(q => q.status === 'accepted');
  const acceptedAmount = acceptedQuotes.reduce((s, q) => s + Number(q.total_amount), 0);

  // Hot equipment ranking (by quantity)
  const equipStats: Record<string, { model: string; name: string; qty: number; sales: number; profit: number }> = {};
  filteredQuotes.forEach(q => {
    (itemDetails[q.id] || []).forEach(i => {
      const key = i.equipment_model || i.equipment_name;
      if (!equipStats[key]) equipStats[key] = { model: i.equipment_model || '-', name: i.equipment_name, qty: 0, sales: 0, profit: 0 };
      equipStats[key].qty += i.quantity;
      equipStats[key].sales += Number(i.subtotal);
      equipStats[key].profit += Number(i.subtotal) - Number(i.cost_price) * i.quantity;
    });
  });
  const hotEquipments = Object.values(equipStats).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const profitEquipments = Object.values(equipStats).sort((a, b) => b.profit - a.profit).slice(0, 10);

  // Customer ranking
  const fetchCustomerName = async (id: string) => {
    const { data } = await supabase.from('customers').select('name').eq('id', id).single();
    return data?.name || '未知';
  };

  const [custRanking, setCustRanking] = useState<{ name: string; quotes: number; amount: number }[]>([]);

  useEffect(() => {
    const buildRanking = async () => {
      const tempCustStats: Record<string, { name: string; quotes: number; amount: number }> = {};
      for (const q of filteredQuotes) {
        if (!q.customer_id) continue;
        if (!tempCustStats[q.customer_id]) {
          const name = await fetchCustomerName(q.customer_id);
          tempCustStats[q.customer_id] = { name, quotes: 0, amount: 0 };
        }
        tempCustStats[q.customer_id].quotes += 1;
        tempCustStats[q.customer_id].amount += Number(q.total_amount);
      }
      setCustRanking(Object.values(tempCustStats).sort((a, b) => b.amount - a.amount).slice(0, 10));
    };
    buildRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, quotations.length]);

  if (loading) return <div className="text-center py-12 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TIME_FILTERS.map(f => (
            <button key={f.key} onClick={() => setPeriod(f.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                period === f.key ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs text-slate-500">销售金额</span>
          </div>
          <div className="text-xl font-bold text-slate-800">{formatCurrency(totalSales)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-orange-600" /></div>
            <span className="text-xs text-slate-500">采购成本</span>
          </div>
          <div className="text-xl font-bold text-slate-800">{formatCurrency(totalCost)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 ${totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
              {totalProfit >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
            </div>
            <span className="text-xs text-slate-500">利润金额</span>
          </div>
          <div className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-indigo-600" /></div>
            <span className="text-xs text-slate-500">利润率</span>
          </div>
          <div className={`text-xl font-bold ${profitRate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPercent(profitRate)}</div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-4 shadow-sm text-white">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-blue-200 text-xs">已成交金额</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(acceptedAmount)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">报价单数</p>
            <p className="text-xl font-bold mt-1">{filteredQuotes.length}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">已成交单数</p>
            <p className="text-xl font-bold mt-1">{acceptedQuotes.length}</p>
          </div>
        </div>
      </div>

      {/* Hot Equipment Ranking (by quantity) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-700">热销设备排行</h3>
        </div>
        {hotEquipments.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">暂无数据</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {hotEquipments.map((eq, idx) => (
              <div key={eq.model} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    idx < 3 ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{idx + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{eq.model}</p>
                    <p className="text-xs text-slate-400">{eq.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-700">{eq.qty}台 · {formatCurrency(eq.sales)}</div>
                  <div className="text-xs text-emerald-600">利润: {formatCurrency(eq.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Highest Profit Product Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-slate-700">利润最高产品排行</h3>
        </div>
        {profitEquipments.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">暂无数据</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {profitEquipments.map((eq, idx) => {
              const profitRate = eq.sales > 0 ? eq.profit / eq.sales : 0;
              return (
                <div key={eq.model} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      idx < 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{eq.model}</p>
                      <p className="text-xs text-slate-400">{eq.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-emerald-600">{formatCurrency(eq.profit)}</div>
                    <div className="text-xs text-slate-400">利润率: {formatPercent(profitRate)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-700">客户成交排行</h3>
        </div>
        {custRanking.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">暂无数据</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {custRanking.map((c, idx) => (
              <div key={c.name} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    idx < 3 ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{idx + 1}</span>
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-700">{formatCurrency(c.amount)}</div>
                  <div className="text-xs text-slate-400">{c.quotes}个报价</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
