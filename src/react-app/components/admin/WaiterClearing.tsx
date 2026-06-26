// src/react-app/components/admin/WaiterClearing.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../config/api';
import { Loader2, CheckCircle, AlertCircle, User, DollarSign, Receipt, Eye, X, ShieldAlert, Printer } from 'lucide-react';

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReceiptData {
  id: number;
  order_number: string;
  order_type: string;
  total_amount: number;
  payment_method: string;
  is_cleared: boolean;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface UnclearedStaff {
  id: number;
  name: string;
  employee_id: string;
  role: string;
  uncleared_count: number;
  total_due: number;
  is_blocked_from_pos: boolean;
}

export default function WaiterClearing() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<UnclearedStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canClear = user?.role === 'admin' || user?.role === 'manager';

  // Receipts drill-down modal
  const [selectedStaff, setSelectedStaff] = useState<UnclearedStaff | null>(null);
  const [staffReceipts, setStaffReceipts] = useState<ReceiptData[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [includeCleared, setIncludeCleared] = useState(false);
  const [modalDateRange, setModalDateRange] = useState({ start: '', end: '' });

  // Confirmation modal
  const [confirmClearingStaff, setConfirmClearingStaff] = useState<UnclearedStaff | null>(null);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/admin/uncleared-staff');
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      setStaffList(data);
    } catch (err) {
      setError('Could not load continuous waiter accountability balances.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReceipts = async (
    staff: UnclearedStaff,
    start?: string,
    end?: string,
    cleared?: boolean
  ) => {
    setIsLoadingReceipts(true);
    try {
      const useCleared = cleared ?? includeCleared;
      let url = `/api/admin/staff/${staff.id}/receipts?includeCleared=${useCleared}`;
      if (start && end) url += `&start=${start}&end=${end}`;

      const response = await apiClient.get(url);
      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setStaffReceipts(data);
    } catch (err) {
      try {
        const useCleared = cleared ?? includeCleared;
        let url = `/api/admin/uncleared-receipts/${staff.id}?includeCleared=${useCleared}`;
        if (start && end) url += `&start=${start}&end=${end}`;
        const response = await apiClient.get(url);
        if (!response.ok) throw new Error('Both receipt endpoints failed');
        const data = await response.json();
        setStaffReceipts(data);
      } catch {
        setError(`Could not load receipts for ${staff.name}. Check your route definition.`);
      }
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const handleViewReceipts = (staff: UnclearedStaff) => {
    setSelectedStaff(staff);
    setShowModal(true);
    setStaffReceipts([]);
    setModalDateRange({ start: '', end: '' });
    setIncludeCleared(false);
    fetchReceipts(staff, '', '', false);
  };

  const handleApplyFilter = () => {
    if (selectedStaff) {
      fetchReceipts(selectedStaff, modalDateRange.start, modalDateRange.end, includeCleared);
    }
  };

  const handleResetFilter = () => {
    setModalDateRange({ start: '', end: '' });
    setIncludeCleared(false);
    if (selectedStaff) fetchReceipts(selectedStaff, '', '', false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedStaff(null);
    setStaffReceipts([]);
    setModalDateRange({ start: '', end: '' });
    setIncludeCleared(false);
  };

  const handleClearStaffSubmit = async (staff: UnclearedStaff) => {
    setIsClearing(staff.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiClient.post(`/api/admin/clear-staff/${staff.id}`);
      if (!response.ok) throw new Error('Failed to clear');
      const resData = await response.json();
      setSuccess(resData.message || `Successfully cleared data for ${staff.name}`);
      setConfirmClearingStaff(null);
      handleCloseModal();
      fetchSummaryData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(`Failed to clear data for ${staff.name}`);
    } finally {
      setIsClearing(null);
    }
  };

  const handlePrintReceipt = (receipt: ReceiptData, staffName: string) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${receipt.order_number}</title>
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 20px; margin: 0 auto; font-size: 13px; }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .bold { font-weight: bold; }
            h2 { margin: 4px 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2>MARIA HAVENS</h2>
            <p style="margin:2px 0">Receipt Reprint — Audit Copy</p>
          </div>
          <div class="divider"></div>
          <div class="row"><span>Receipt:</span><span class="bold">${receipt.order_number}</span></div>
          <div class="row"><span>Date:</span><span>${new Date(receipt.created_at).toLocaleString('en-KE')}</span></div>
          <div class="row"><span>Staff:</span><span>${staffName}</span></div>
          <div class="row"><span>Type:</span><span>${receipt.order_type}</span></div>
          <div class="row"><span>Status:</span><span>${receipt.status.toUpperCase()}</span></div>
          <div class="row"><span>Payment:</span><span>${receipt.payment_method.toUpperCase()}</span></div>
          <div class="divider"></div>
          ${(receipt.items || []).map(item => `
            <div class="row">
              <span>${item.quantity}× ${item.product_name}</span>
              <span>Ksh ${Number(item.total_price).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="row bold" style="font-size:15px">
            <span>TOTAL:</span><span>Ksh ${Number(receipt.total_amount).toFixed(2)}</span>
          </div>
          <p class="center" style="font-size:11px;margin-top:16px">Accountability Audit Copy</p>
          <script>setTimeout(function(){ window.print(); window.close(); }, 400);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:   'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready:     'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  const getOrderTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      dine_in:      'Dine-In',
      takeaway:     'Takeaway',
      room_service: 'Room Service',
      bar_sale:     'Bar Sale',
      expense:      'Expense',
    };
    return map[type] || type;
  };

  const formatCurrency = (amount: number) =>
    `Ksh ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredStaff = staffList.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Continuous Waiter Clearing & Audit</h2>
        <p className="text-gray-600">
          Uncleared sales from previous shifts carry over automatically until an admin settles them.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><User className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Waiters Tracked</p>
            <p className="text-xl font-bold text-gray-900">{staffList.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><ShieldAlert className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Blocked (Past 8 AM)</p>
            <p className="text-xl font-bold text-red-600">{staffList.filter(s => s.is_blocked_from_pos).length}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Outstanding</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(staffList.reduce((sum, s) => sum + Number(s.total_due || 0), 0))}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <input
          type="text"
          placeholder="Search waiters by name or Employee ID..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waiter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">POS Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uncleared Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No waiter profiles found.</td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">ID: {s.employee_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {s.is_blocked_from_pos ? (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 uppercase">Locked (Past 8AM)</span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 uppercase">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      {Number(s.uncleared_count || 0)} receipts
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-base font-black ${Number(s.total_due || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(Number(s.total_due || 0))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewReceipts(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View Sales
                        </button>
                        {canClear && (
                          <button
                            onClick={() => setConfirmClearingStaff(s)}
                            disabled={Number(s.total_due || 0) === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-lg transition-all text-sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Verify & Clear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Receipts Detail Modal ── */}
      {showModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-start bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Sales for {selectedStaff.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Employee ID: {selectedStaff.employee_id}
                  {' · '}
                  <span className="text-red-600 font-bold">{formatCurrency(Number(selectedStaff.total_due || 0))} outstanding</span>
                  {' · '}
                  <span className="text-gray-600">{Number(selectedStaff.uncleared_count || 0)} uncleared receipts</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Showing all uncleared sales — including yesterday's and prior shifts not yet settled.
                </p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-200 rounded-full transition-colors ml-4">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 bg-white border-b">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">From Date</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    value={modalDateRange.start}
                    onChange={(e) => setModalDateRange(p => ({ ...p, start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To Date</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    value={modalDateRange.end}
                    onChange={(e) => setModalDateRange(p => ({ ...p, end: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                  <input
                    type="checkbox"
                    id="includeCleared"
                    checked={includeCleared}
                    onChange={(e) => setIncludeCleared(e.target.checked)}
                    className="w-4 h-4 text-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeCleared" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Include cleared history
                  </label>
                </div>
                <button
                  onClick={handleApplyFilter}
                  className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-md text-sm transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={handleResetFilter}
                  className="px-4 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-md text-sm transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Receipt Cards */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {isLoadingReceipts ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
                  <p className="text-gray-500 text-sm">Loading receipts...</p>
                </div>
              ) : staffReceipts.length === 0 ? (
                <div className="text-center py-20 bg-white border rounded-xl">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No receipts found for this filter.</p>
                  <p className="text-gray-400 text-sm mt-1">Try resetting the filter to see all uncleared sales.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {staffReceipts.map((receipt) => (
                    <div key={receipt.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      {/* Receipt header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-blue-600">{receipt.order_number}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${receipt.is_cleared ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {receipt.is_cleared ? 'Cleared' : 'Pending'}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getStatusBadge(receipt.status)}`}>
                              {receipt.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(receipt.created_at).toLocaleString('en-KE', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {getOrderTypeLabel(receipt.order_type)} · {(receipt.payment_method || 'cash').toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-black text-gray-900">{formatCurrency(receipt.total_amount)}</p>
                          <button
                            onClick={() => handlePrintReceipt(receipt, selectedStaff.name)}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold mt-2 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Reprint
                          </button>
                        </div>
                      </div>

                      {/* Items list */}
                      {receipt.items && receipt.items.length > 0 && (
                        <div className="border-t pt-2 mt-2 space-y-1">
                          {receipt.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span className="truncate max-w-[200px]">{item.quantity}× {item.product_name}</span>
                              <span className="font-semibold text-gray-800 ml-2">{formatCurrency(item.total_price)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Total outstanding:{' '}
                <span className="text-lg font-black text-red-600 ml-1">
                  {formatCurrency(Number(selectedStaff.total_due || 0))}
                </span>
              </div>
              <div className="flex gap-2">
                {canClear && Number(selectedStaff.total_due || 0) > 0 && (
                  <button
                    onClick={() => setConfirmClearingStaff(selectedStaff)}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                  >
                    Verify & Settle
                  </button>
                )}
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Clear Modal ── */}
      {confirmClearingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
            <div className="flex items-center gap-3 text-yellow-600 mb-3">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-black text-gray-900">Approve Clearance Settlement</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              This will mark all uncleared sales — including yesterday's and any prior shifts — as settled.
              The balance drops to <span className="font-bold text-gray-900">Ksh 0.00</span> and any POS locks lift immediately.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200 space-y-1.5">
              <div className="text-sm font-bold text-gray-800">{confirmClearingStaff.name}</div>
              <div className="text-xs text-gray-500">Employee ID: {confirmClearingStaff.employee_id}</div>
              <div className="text-xs text-gray-500">{Number(confirmClearingStaff.uncleared_count || 0)} uncleared transactions</div>
              <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between items-center">
                <span className="text-sm text-gray-600">Total to collect:</span>
                <span className="text-lg font-black text-red-600">{formatCurrency(Number(confirmClearingStaff.total_due || 0))}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearingStaff(null)}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg border border-gray-200 text-sm"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => handleClearStaffSubmit(confirmClearingStaff)}
                disabled={isClearing !== null}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {isClearing === confirmClearingStaff.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle className="w-4 h-4" />}
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}