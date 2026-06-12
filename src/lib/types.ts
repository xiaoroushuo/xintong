export type UserRole = 'admin' | 'employee';
export type DeviceCategory = '交换机' | '防火墙' | '路由器' | 'AC' | 'AP' | '光模块' | '服务器';

export interface Device {
  id: string;
  model: string;
  product_name: string;
  name: string;
  category: DeviceCategory;
  brand: string;
  purchase_price: number;
  unit_price: number;
  cost_price: number;
  discount_rate: number;
  stock_quantity: number;
  unit: string;
  notes: string | null;
  specs: Record<string, string>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  project_name: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  quote_number: string;
  customer_id: string | null;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  total_amount: number;
  total_cost: number;
  discount_percent: number;
  tax_rate: number;
  profit_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  equipment_id: string | null;
  equipment_name: string;
  equipment_model: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
  subtotal: number;
  created_at: string;
}

export interface PriceUploadLog {
  id: string;
  uploaded_by: string;
  file_name: string;
  total_rows: number;
  updated_rows: number;
  inserted_rows: number;
  status: string;
  snapshot: Record<string, { model: string; purchase_price: number; unit_price: number }[]> | null;
  created_at: string;
}

export const DEVICE_CATEGORIES: DeviceCategory[] = ['交换机', '防火墙', '路由器', 'AC', 'AP', '光模块', '服务器'];

export const QUOTATION_STATUS_MAP: Record<Quotation['status'], { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-700' },
  sent: { label: '已发送', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: '已接受', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
};

export const TIME_FILTERS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季度' },
  { key: 'all', label: '全部' },
] as const;

export type TimeFilter = typeof TIME_FILTERS[number]['key'];
