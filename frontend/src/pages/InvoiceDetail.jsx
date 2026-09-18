import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, Icon, formatKsh, formatDateTime,
} from '../components/ui';

const STATUS_COLORS = {
  unpaid: 'red',
  partially_paid: 'yellow',
  paid: 'green',
  overpaid: 'blue',
  cancelled: 'gray',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/invoices/${id}`);
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ['mpesa-transactions', id],
    queryFn: async () => {
      const { data } = await api.get('/api/payments/mpesa/transactions', {
        params: { invoice_id: id },
      });
      return data;
    },
    enabled: !!invoice,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId) => api.delete(`/api/invoices/${id}/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    qc.invalidateQueries({ queryKey: ['mpesa-transactions', id] });
  }

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <div className="p-8">
        <EmptyState
          icon="alert"
          title="Invoice not found"
          message={error.response?.data?.detail || error.message}
          action={<Button onClick={() => navigate('/invoices')}>← Back to Invoices</Button>}
        />
      </div>
    );
  }

  const balance = Number(invoice.balance);
  const paid = Number(invoice.amount_paid);
  const total = Number(invoice.total_amount);
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/invoices')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to Invoices
      </button>

      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        subtitle={
          <>
            {invoice.patient_name} <span className="font-mono text-xs ml-1">({invoice.patient_number})</span>
            {invoice.admission_number && (
              <> · Admission <span className="font-mono">{invoice.admission_number}</span></>
            )}
          </>
        }
                action={
          <div className="flex gap-2">
            <CopyLinkButton invoiceNumber={invoice.invoice_number} />
            <Button variant="secondary" onClick={() => setShowRefresh(true)}>
              <><Icon name="receipt" size={16} /> Refresh Charges</>
            </Button>
            <Button onClick={() => setShowAddCharge(true)}>+ Add Charge</Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs uppercase text-gray-500 font-medium mb-1">Status</div>
          <Badge color={STATUS_COLORS[invoice.status] || 'gray'}>
            {invoice.status.replace('_', ' ')}
          </Badge>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase text-gray-500 font-medium mb-1">Total</div>
          <div className="text-xl font-bold text-gray-900">{formatKsh(total)}</div>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase text-gray-500 font-medium mb-1">Paid</div>
          <div className="text-xl font-bold text-green-600">{formatKsh(paid)}</div>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase text-gray-500 font-medium mb-1">Balance</div>
          <div className={`text-xl font-bold ${balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatKsh(balance)}
          </div>
        </Card>
      </div>

      {/* Payment progress */}
      {total > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Payment progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-brand-500 h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </Card>
      )}

      {/* Items */}
      <Card className="mb-6">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold">Items</h3>
        </div>
        {invoice.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No items yet. Assign a bed or add a charge.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Description</th>
                <th className="text-right px-5 py-3 font-medium">Qty</th>
                <th className="text-right px-5 py-3 font-medium">Unit Price</th>
                <th className="text-right px-5 py-3 font-medium">Amount</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800">{item.description}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {formatKsh(item.unit_price)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatKsh(item.amount)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Remove this item?')) {
                          deleteItemMutation.mutate(item.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Remove item"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Payment history */}
      <Card>
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold">Payment History</h3>
          <p className="text-xs text-gray-500 mt-1">M-Pesa transactions linked to this invoice</p>
        </div>
        {!transactions || transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No payments recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Receipt</th>
                <th className="text-left px-5 py-3 font-medium">Payer</th>
                <th className="text-left px-5 py-3 font-medium">Phone</th>
                <th className="text-right px-5 py-3 font-medium">Amount</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">
                    {tx.transaction_id}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{tx.payer_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                    {tx.payer_phone || '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-green-700">
                    {formatKsh(tx.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge color={tx.status === 'success' ? 'green' : tx.status === 'unmatched' ? 'yellow' : 'red'}>
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {formatDateTime(tx.received_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modals */}
      <AddChargeModal
        open={showAddCharge}
        onClose={() => setShowAddCharge(false)}
        invoiceId={id}
        onSuccess={() => {
          setShowAddCharge(false);
          refresh();
        }}
      />

      <RefreshChargesModal
        open={showRefresh}
        onClose={() => setShowRefresh(false)}
        invoiceId={id}
        onSuccess={() => {
          setShowRefresh(false);
          refresh();
        }}
      />
    </div>
  );
}


// ---------- Add Charge Modal ----------
function AddChargeModal({ open, onClose, invoiceId, onSuccess }) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/api/invoices/${invoiceId}/items`, payload),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to add charge.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    mutation.mutate({
      description,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
    });
  }

  function handleClose() {
    setDescription('');
    setQuantity(1);
    setUnitPrice('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Charge">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <Input
          label="Description *"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Wound dressing, Consultation, Medication"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantity *"
            type="number"
            required
            min="0"
            step="0.5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Unit Price (KSh) *"
            type="number"
            required
            min="0"
            step="1"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="e.g. 500"
          />
        </div>

        {quantity && unitPrice && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">
                {formatKsh(Number(quantity) * Number(unitPrice))}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Adding…' : 'Add Charge'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}


// ---------- Refresh Charges Modal ----------
function RefreshChargesModal({ open, onClose, invoiceId, onSuccess }) {
  const [policy, setPolicy] = useState('24hr');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(
      `/api/invoices/${invoiceId}/refresh-accommodation`,
      null,
      { params: { billing_policy: policy } }
    ),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to refresh.'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Refresh Accommodation Charges">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 text-sm p-3 rounded">
          Recalculates the accommodation line based on the current bed assignment duration and rate.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Billing Policy
          </label>
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="24hr">Completed 24-hour periods (min 1 day)</option>
            <option value="calendar">Calendar days inclusive (min 1 day)</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Refreshing…' : 'Refresh Charges'}
          </Button>
        </div>
      </div>
    </Modal>
  );

  // ---------- Copy payer link button ----------
function CopyLinkButton({ invoiceNumber }) {
  const [copied, setCopied] = useState(false);

  // The payer portal is at /pay/payment.html on the same origin
  const url = `${window.location.origin}/pay/payment.html?invoice=${encodeURIComponent(invoiceNumber)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <Button variant="secondary" onClick={handleCopy} title={url}>
      {copied ? <><Icon name="check" size={16} /> Copied</> : <><Icon name="link" size={16} /> Payer Link</>}
    </Button>
  );
}
}
