import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, formatKsh, formatDateTime,
} from '../components/ui';

const STATUS_COLORS = {
  success: 'green',
  pending: 'yellow',
  failed: 'red',
  unmatched: 'yellow',
};

export default function Payments() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');  // all | unmatched
  const [filter, setFilter] = useState('');

  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ['mpesa-transactions', tab, filter],
    queryFn: async () => {
      if (tab === 'unmatched') {
        const { data } = await api.get('/api/payments/mpesa/unmatched');
        return data;
      }
      const params = filter ? { status: filter } : {};
      const { data } = await api.get('/api/payments/mpesa/transactions', { params });
      return data;
    },
    refetchInterval: 20000,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['mpesa-transactions'] });
  }

  const unmatchedCount = tab === 'unmatched' ? (transactions?.length || 0) : null;

  return (
    <div className="p-8">
      <PageHeader
        title="M-Pesa Payments"
        subtitle="Transaction history and unmatched payment reconciliation"
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <TabButton active={tab === 'all'}       onClick={() => { setTab('all'); setFilter(''); }}>
          All Transactions
        </TabButton>
        <TabButton active={tab === 'unmatched'} onClick={() => { setTab('unmatched'); setFilter(''); }}>
          Unmatched Queue
        </TabButton>
      </div>

      {/* Status filter (all tab only) */}
      {tab === 'all' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterChip label="All"     active={filter === ''}            onClick={() => setFilter('')} />
          <FilterChip label="Success" active={filter === 'success'}     onClick={() => setFilter('success')} />
          <FilterChip label="Unmatched" active={filter === 'unmatched'} onClick={() => setFilter('unmatched')} />
          <FilterChip label="Failed"  active={filter === 'failed'}      onClick={() => setFilter('failed')} />
        </div>
      )}

      {tab === 'unmatched' && (
        <Card className="mb-4 bg-yellow-50 border-yellow-200">
          <div className="p-4 text-sm text-yellow-800">
            <strong>⚠️ Unmatched payments need attention</strong>
            <p className="text-xs mt-1">
              These M-Pesa payments didn't have a valid invoice number.
              Review each one and link it to the correct invoice, or contact the payer.
            </p>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <EmptyState icon="⚠️" title="Could not load payments" message={error.response?.data?.detail || error.message} />
        ) : !transactions || transactions.length === 0 ? (
          <EmptyState
            icon="📱"
            title={tab === 'unmatched' ? 'No unmatched payments' : 'No payments yet'}
            message={
              tab === 'unmatched'
                ? 'All M-Pesa payments have been matched to invoices. 🎉'
                : 'M-Pesa transactions will appear here as they come in.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Receipt</th>
                  <th className="text-left px-5 py-3 font-medium">Invoice</th>
                  <th className="text-left px-5 py-3 font-medium">Payer</th>
                  <th className="text-left px-5 py-3 font-medium">Phone</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Received</th>
                  {tab === 'unmatched' && (
                    <th className="text-right px-5 py-3 font-medium">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    showLinkAction={tab === 'unmatched'}
                    onLink={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


// ---------- Row ----------
function TransactionRow({ tx, showLinkAction, onLink }) {
  const [showLink, setShowLink] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">
          {tx.transaction_id}
        </td>
        <td className="px-5 py-3">
          {tx.invoice_id ? (
            <Link
              to={`/invoices/${tx.invoice_id}`}
              className="font-mono text-xs text-brand-600 hover:underline"
            >
              {tx.invoice_number}
            </Link>
          ) : (
            <span className="font-mono text-xs text-gray-500">
              {tx.invoice_number || '—'}
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-gray-700">{tx.payer_name || '—'}</td>
        <td className="px-5 py-3 text-gray-600 font-mono text-xs">
          {tx.payer_phone || '—'}
        </td>
        <td className="px-5 py-3 text-right font-medium text-green-700">
          {formatKsh(tx.amount)}
        </td>
        <td className="px-5 py-3">
          <Badge color={STATUS_COLORS[tx.status] || 'gray'}>{tx.status}</Badge>
        </td>
        <td className="px-5 py-3 text-gray-500 text-xs">
          {formatDateTime(tx.received_at)}
        </td>
        {showLinkAction && (
          <td className="px-5 py-3 text-right">
            <Button onClick={() => setShowLink(true)}>Link to Invoice</Button>
          </td>
        )}
      </tr>

      <LinkToInvoiceModal
        open={showLink}
        onClose={() => setShowLink(false)}
        transaction={tx}
        onSuccess={() => {
          setShowLink(false);
          onLink();
        }}
      />
    </>
  );
}


// ---------- Link Modal ----------
function LinkToInvoiceModal({ open, onClose, transaction, onSuccess }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(
      `/api/payments/mpesa/unmatched/${transaction.id}/link`,
      null,
      { params: { invoice_number: invoiceNumber.trim().toUpperCase() } }
    ),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Failed to link payment.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!invoiceNumber.trim()) {
      setError('Please enter an invoice number.');
      return;
    }
    mutation.mutate();
  }

  function handleClose() {
    setInvoiceNumber('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Link Payment to Invoice">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <Row label="Receipt" value={transaction.transaction_id} mono />
          <Row label="Amount" value={formatKsh(transaction.amount)} />
          <Row label="Payer" value={transaction.payer_name || '—'} />
          <Row label="Phone" value={transaction.payer_phone || '—'} mono />
          <Row
            label="Original reference"
            value={transaction.account_reference || '—'}
            mono
          />
        </div>

        <Input
          label="Invoice Number *"
          required
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
          placeholder="e.g. INV-2026-000001"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Linking…' : 'Link Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 font-medium ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ---------- Tab ----------
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-brand-500 text-brand-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}