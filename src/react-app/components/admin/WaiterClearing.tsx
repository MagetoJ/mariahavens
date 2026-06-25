import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../config/api';
import { Loader2, CheckCircle, AlertCircle, User, DollarSign, Receipt, Eye, X, Printer } from 'lucide-react';
import { formatCurrency } from '../../pages/AdminDashboard';

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
  payment_status: string;
  items: OrderItem[];
}

interface UnclearedStaff {
  id: number;
  name: string;
  employee_id: string;
  role: string;
  uncleared_count: string | number;
  total_due: string | number;
}

export default function WaiterClearing() {
  const { user } = useAuth();
  const [unclearedStaff, setUnclearedStaff] = useState<UnclearedStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const canClear = user?.role === 'admin' || user?.role === 'manager';
  
  // Modal states
  const [selectedStaff, setSelectedStaff] = useState<UnclearedStaff | null>(null);
  const [staffReceipts, setStaffReceipts] = useState<ReceiptData[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [includeCleared, setIncludeCleared] = useState(false);
  const [modalDateRange, setModalDateRange] = useState({
    start: '',
    end: ''
  });

  // Custom confirmation modal state for individual clearance
  const [confirmClearingStaff, setConfirmClearingStaff] = useState<UnclearedStaff | null>(null);

  useEffect(() => {
    fetchUnclearedStaff();
  }, []);

  // Automatically select the current user if they are a waiter
  useEffect(() => {
    if (user?.role === 'waiter' && unclearedStaff.length > 0) {
      const self = unclearedStaff.find(s => s.id === user.id);
      if (self && !selectedStaff) {
        handleViewReceipts(self);
      }
    }
  }, [unclearedStaff, user]);

  const fetchUnclearedStaff = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/admin/uncleared-staff');
      if (!response.ok) throw new Error('Failed to fetch uncleared staff summary');
      const data = await response.json();
      setUnclearedStaff(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not load uncleared staff summary');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReceipts = async (staff: UnclearedStaff, customStart?: string, customEnd?: string, forceIncludeCleared?: boolean) => {
    setSelectedStaff(staff);
    setShowModal(true);
    setIsLoadingReceipts(true);
    try {
      let url = `/api/admin/uncleared-receipts/${staff.id}?includeCleared=${forceIncludeCleared ?? includeCleared}`;
      if (customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`;
      }
      const response = await apiClient.get(url);
      if (!response.ok) throw new Error('Failed to fetch staff receipts');
      const data = await response.json();
      setStaffReceipts(data);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to load receipts for ${staff.name}`);
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const handleSearchClick = () => {
    if (selectedStaff) {
      handleViewReceipts(selectedStaff, modalDateRange.start, modalDateRange.end, includeCleared);
    }
  };

  const handleClearStaff = async (staff: UnclearedStaff) => {
    setIsClearing(staff.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiClient.post(`/api/admin/clear-staff/${staff.id}`);
      if (!response.ok) throw new Error('Failed to clear staff data');
      
      setSuccess(`Successfully cleared data for ${staff.name}`);
      fetchUnclearedStaff(); // Re-fetch to show updated balances
      
      // Close views if they were active for this staff member
      if (selectedStaff?.id === staff.id) {
        setShowModal(false);
        setSelectedStaff(null);
      }
      
      setConfirmClearingStaff(null); // Close confirmation modal
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to clear data for ${staff.name}`);
    } finally {
      setIsClearing(null);
    }
  };

  const handlePrintIndividualReceipt = (receipt: ReceiptData, staffName: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${receipt.order_number}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              width: 80mm; 
              padding: 20px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; }
            .bold { font-weight: bold; }
            .header h2 { margin: 5px 0; }
            .header p { margin: 2px 0; font-size: 14px; }
            .item-row { margin: 5px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="center header">
            <h2>MARIA HAVENS</h2>
            <p>Order Receipt (Reprint)</p>
          </div>
          <div class="divider"></div>
          <div class="flex"><span>Receipt:</span> <span class="bold">${receipt.order_number}</span></div>
          <div class="flex"><span>Date:</span> <span>${new Date(receipt.created_at).toLocaleString()}</span></div>
          <div class="flex"><span>Staff:</span> <span>${staffName}</span></div>
          <div class="flex"><span>Type:</span> <span>${receipt.order_type.toUpperCase()}</span></div>
          <div class="flex"><span>Payment:</span> <span>${receipt.payment_method.toUpperCase()}</span></div>
          <div class="divider"></div>
          
          <div class="items">
            ${receipt.items.map(item => `
              <div class="item-row">
                <div class="flex">
                  <span>${item.quantity}x ${item.product_name}</span>
                  <span>${formatCurrency(item.total_price)}</span>
                </div>
                <div style="font-size: 10px; color: #666;">@ ${formatCurrency(item.unit_price)} each</div>
              </div>
            `).join('')}
          </div>
          
          <div class="divider"></div>
          <div class="flex bold" style="font-size: 18px;">
            <span>TOTAL:</span> 
            <span>${formatCurrency(receipt.total_amount)}</span>
          </div>
          <div class="divider"></div>
          <p class="center" style="font-size: 12px; margin-top: 20px;">Receipt Audit Copy</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL previous day data for ALL staff?')) return;

    setIsClearing(0); // 0 represents 'all'
    setError(null);
    setSuccess(null);
    try {
      // Updated to explicitly pass the confirm property inside the post body payload guard
      const response = await apiClient.post('/api/admin/clear-previous-data', { confirm: true });
      if (!response.ok) throw new Error('Failed to clear all data');
      
      setSuccess('Successfully cleared all previous day data');
      fetchUnclearedStaff(); // Re-fetch to show all waiters with 0
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Failed to clear previous data');
    } finally {
      setIsClearing(null);
    }
  };

  const filteredStaff = unclearedStaff.filter(s => 
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Waiter Clearing</h2>
          <p className="text-gray-600">{canClear ? 'Review and clear outstanding sales' : 'Review your outstanding sales'}</p>
        </div>
        {unclearedStaff.length > 0 && canClear && (
          <button
            onClick={handleClearAll}
            disabled={isClearing !== null}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium text-sm"
          >
            {isClearing === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Clear All Previous Data
          </button>
        )}
      </div>

      {/* Dashboard Analytics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Staff Registered</p>
            <p className="text-xl font-bold text-gray-900">{unclearedStaff.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Awaiting Clearance</p>
            <p className="text-xl font-bold text-gray-900">
              {unclearedStaff.filter(s => Number(s.total_due) > 0).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Outstanding Debt</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(unclearedStaff.reduce((sum, s) => sum + Number(s.total_due), 0))}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <input
            type="text"
            placeholder="Search staff by name or ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Mobile View - Cards */}
        <div className="block sm:hidden divide-y divide-gray-200">
          {filteredStaff.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-lg font-medium">No matching staff found!</p>
            </div>
          ) : (
            filteredStaff.map((s) => (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-3 text-xs font-bold">
                      {s.name.split(' ').map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.employee_id} • {s.role.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{formatCurrency(s.total_due)}</div>
                    <div className="text-xs text-gray-500">{s.uncleared_count} receipts</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewReceipts(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  {canClear && (
                    <button
                      onClick={() => setConfirmClearingStaff(s)}
                      disabled={isClearing !== null}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors disabled:opacity-50 font-medium"
                    >
                      {isClearing === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Due</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="w-12 h-12 text-green-400" />
                      <p className="text-lg font-medium">No matching staff found!</p>
                      <p className="text-sm">Try a different search term or check uncleared status.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-3 text-xs font-bold">
                          {s.name.split(' ').map(w => w[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 capitalize">
                        {s.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {s.uncleared_count} receipts
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {formatCurrency(s.total_due)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleViewReceipts(s)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Receipts
                      </button>
                      {canClear && (
                        <button
                          onClick={() => setConfirmClearingStaff(s)}
                          disabled={isClearing !== null}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors disabled:opacity-50"
                        >
                          {isClearing === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Clear Waiter
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="text-sm text-yellow-700">
            <p className="font-bold">Important Note:</p>
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>{canClear ? 'Clearing a waiter marks all their currently uncleared receipts as processed.' : 'You can view all your uncleared receipts here.'}</li>
              <li>Waiters are blocked from creating new orders after 8:00 AM if they have uncleared receipts from previous days.</li>
              <li>{canClear ? 'Always verify the total cash/payments received before clearing.' : 'Please see an Admin or Manager to clear your account once you have remitted your sales.'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Clearance Modal */}
      {confirmClearingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-100 transform transition-all">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">Confirm Clearance Settlement</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              You are about to execute a full structural balance shift for this staff member. Confirming will clear outstanding shift items and set their net debt obligations to zero.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {confirmClearingStaff.name.split(' ').map(w => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{confirmClearingStaff.name}</h4>
                  <p className="text-xs text-gray-500">ID: {confirmClearingStaff.employee_id} • {confirmClearingStaff.role.replace('_', ' ')}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-sm">
                <span className="text-gray-500">Unprocessed Records:</span>
                <span className="font-semibold text-gray-900">{confirmClearingStaff.uncleared_count} transactions</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Total Net to Settle:</span>
                <span className="text-base font-black text-red-600">{formatCurrency(confirmClearingStaff.total_due)}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearingStaff(null)}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors border border-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleClearStaff(confirmClearingStaff)}
                disabled={isClearing !== null}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-sm"
              >
                {isClearing === confirmClearingStaff.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipts Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Uncleared Receipts: {selectedStaff?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Employee ID: {selectedStaff?.employee_id}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setModalDateRange({ start: '', end: '' });
                }}
                aria-label="Close receipts modal"
                title="Close modal"
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 bg-white border-b space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-4">
                <div className="flex-1">
                  <label htmlFor="modalStartDate" className="block text-xs font-medium text-gray-500 uppercase mb-1">Start Date</label>
                  <input 
                    id="modalStartDate"
                    type="date" 
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                    value={modalDateRange.start}
                    onChange={(e) => setModalDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="modalEndDate" className="block text-xs font-medium text-gray-500 uppercase mb-1">End Date</label>
                  <input 
                    id="modalEndDate"
                    type="date" 
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                    value={modalDateRange.end}
                    onChange={(e) => setModalDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 h-10 lg:mb-1">
                   <input 
                    type="checkbox" 
                    id="includeCleared"
                    checked={includeCleared}
                    onChange={(e) => setIncludeCleared(e.target.checked)}
                    className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="includeCleared" className="text-sm font-medium text-gray-700">History</label>
                </div>
                <div className="flex gap-2 lg:mb-1">
                  <button 
                    onClick={handleSearchClick}
                    disabled={!modalDateRange.start || !modalDateRange.end || isLoadingReceipts}
                    className="flex-1 bg-yellow-500 text-white px-6 py-2 rounded-md font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Search
                  </button>
                  <button 
                    onClick={() => {
                      setModalDateRange({ start: '', end: '' });
                      selectedStaff && handleViewReceipts(selectedStaff);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium border border-gray-200 rounded-md lg:border-none"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isLoadingReceipts ? (
                <div className="flex flex-col items-center justify-center py-10 sm:py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">Loading receipts...</p>
                </div>
              ) : staffReceipts.length === 0 ? (
                <div className="text-center py-10 sm:py-20">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">No receipts found for this staff member.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {staffReceipts.map((receipt) => (
                    <div key={receipt.id} className="border rounded-lg p-3 sm:p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-blue-600 truncate">{receipt.order_number}</p>
                            {receipt.is_cleared ? (
                              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                <CheckCircle className="w-2.5 h-2.5" /> Cleared
                              </span>
                            ) : (
                              <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase">Uncleared</span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            {new Date(receipt.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">{formatCurrency(receipt.total_amount)}</p>
                          <div className="flex flex-col items-end gap-1 mt-1">
                            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase font-bold">
                              {receipt.payment_method}
                            </span>
                            <button 
                              onClick={() => handlePrintIndividualReceipt(receipt, selectedStaff?.name || 'Unknown')}
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase transition-colors"
                            >
                              <Printer className="w-3 h-3" />
                              Print
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 mt-2 border-t pt-2">
                        {receipt.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-600 truncate mr-2">
                              {item.quantity}x {item.product_name}
                            </span>
                            <span className="text-gray-900 whitespace-nowrap">{formatCurrency(item.total_price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t bg-gray-50 rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-gray-700 w-full sm:w-auto text-center sm:text-left">
                <span className="text-xs sm:text-sm">Total Due:</span>
                <span className="ml-2 text-base sm:text-lg font-bold">{formatCurrency(selectedStaff?.total_due || 0)}</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}