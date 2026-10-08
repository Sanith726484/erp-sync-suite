export const DEFAULT_ERP_HOST = 'https://suntek-dev.m.frappe.cloud';

export interface ErpConnectionConfig {
  host: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiSecret?: string;
  mode: 'frappe' | 'mock';
  gpsInterval?: number;
}

export const DEFAULT_ERP_CONFIG: ErpConnectionConfig = {
  host: DEFAULT_ERP_HOST,
  mode: 'frappe',
  gpsInterval: 900,
};

export interface Customer {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
}

export interface Product {
  id: string;
  name: string;
  rate: number;
  description?: string;
}

export interface OrderItem {
  itemCode: string;
  itemName: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Order {
  id?: string;
  customer: string;
  customerName?: string;
  transactionDate: string;
  deliveryDate?: string;
  branch?: string;
  state?: string;
  loanApproved?: string;
  typeOfProperty?: string;
  notes?: string;
  items: OrderItem[];
  grandTotal: number;
  status?: string;
  docstatus?: 0 | 1;
  currency?: string;
  baseCurrency?: string;
  baseGrandTotal?: number;
}

export interface GpsLog {
  id?: string;
  user: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  distanceFromPrevious?: number | string;
}

export interface Visit {
  id?: string;
  customer: string;
  visitType: string;
  date: string;
  time: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  status: 'Checked In' | 'Checked Out';
}

export interface CompanyBranding {
  companyName: string;
  logoUrl?: string;
  appIconUrl?: string;
  splashScreenUrl?: string;
  defaultCurrency?: string;
}

export interface AttendanceLog {
  id?: string;
  employee: string;
  logType: 'IN' | 'OUT';
  time: string;
  latitude?: number;
  longitude?: number;
}

export interface UserProfile {
  username: string;
  fullName: string;
  email: string;
  userImage?: string;
  mobileNo?: string;
  roleProfile?: string;
  userType?: string;
  timeZone?: string;
}


export interface ExpenseClaimItem {
  expenseType: string;
  expenseDate: string;
  amount: number;
  sanctionedAmount?: number;
  description?: string;
}

export interface ExpenseClaim {
  id?: string;
  employee?: string;
  postingDate: string;
  expenses: ExpenseClaimItem[];
  totalClaimedAmount: number;
  totalSanctionedAmount?: number;
  approvalStatus: 'Draft' | 'Approved' | 'Rejected';
  status?: string;
  docstatus?: 0 | 1 | 2;
  remark?: string;
  expenseApprover?: string;
  currency?: string;
  exchangeRate?: number;
  costCenter?: string;
  payableAccount?: string;
}

export interface ExpenseApprover {
  id: string;
  fullName?: string;
}

// Values the HRMS PWA pre-fills before showing a new Expense Claim form.
export interface ExpenseClaimDefaults {
  employee: string;
  employeeName?: string;
  company: string;
  currency?: string;
  companyCurrency?: string;
  exchangeRate: number;
  expenseApprover?: string;
  approvers: ExpenseApprover[];
  approverMandatory: boolean;
  costCenter?: string;
  payableAccount?: string;
}

export interface EmployeeAdvance {
  id: string;
  purpose: string;
  postingDate: string;
  advanceAmount: number;
  paidAmount: number;
  claimedAmount: number;
  returnAmount: number;
  balanceAmount: number;
  status?: string;
}
