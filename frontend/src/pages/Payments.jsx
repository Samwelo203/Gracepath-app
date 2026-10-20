import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import api from '../lib/api';
import {
  PageHeader, Card, Button, Input, Badge, Spinner, EmptyState,
  Modal, Icon, formatKsh, formatDateTime,
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
  const [showCashModal, setShowCashModal] = useState(false);

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

  return (
    <div className="p-8">
      <PageHeader
        title="Payments"
        subtitle="Transaction history, cash approvals and unmatched M-Pesa reconciliation"
        action={<Button onClick={() => setShowCashModal(true)}>Record Cash Payment</Button>}
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
            <strong className="flex items-center gap-2"><Icon name="alert" size={17} />Unmatched payments need attention</strong>
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
          <EmptyState icon="alert" title="Could not load payments" message={error.response?.data?.detail || error.message} />
        ) : !transactions || transactions.length === 0 ? (
          <EmptyState
            icon="payment"
            title={tab === 'unmatched' ? 'No unmatched payments' : 'No payments yet'}
            message={
              tab === 'unmatched'
                ? 'All M-Pesa payments have been matched to invoices.'
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
                  <th className="text-left px-5 py-3 font-medium">Method</th>
                  <th className="text-left px-5 py-3 font-medium">Phone</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Received</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    showLinkAction={tab === 'unmatched'}
                    showReceiptAction={tab === 'all'}
                    onLink={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CashPaymentModal
        open={showCashModal}
        onClose={() => setShowCashModal(false)}
        onSuccess={() => {
          setShowCashModal(false);
          refresh();
        }}
      />
    </div>
  );
}


// ---------- Row ----------
function TransactionRow({ tx, showLinkAction, showReceiptAction, onLink }) {
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
        <td className="px-5 py-3 text-gray-700">
          {tx.payer_name || '—'}
          {tx.approved_by && <span className="block text-xs text-gray-500">Approved by {tx.approved_by}</span>}
        </td>
        <td className="px-5 py-3 capitalize text-gray-700">{tx.payment_method || 'mpesa'}</td>
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
        <td className="px-5 py-3 text-right whitespace-nowrap">
          {showReceiptAction && tx.invoice_id && tx.status === 'success' && (
            <ReceiptDownloadButton transaction={tx} />
          )}
          {showLinkAction && <Button onClick={() => setShowLink(true)}>Link to Invoice</Button>}
        </td>
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


function CashPaymentModal({ open, onClose, onSuccess }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/api/payments/mpesa/cash', {
      invoice_number: invoiceNumber.trim().toUpperCase(),
      amount,
      payer_name: payerName.trim() || null,
    }),
    onSuccess,
    onError: (err) => setError(err.response?.data?.detail || 'Could not record cash payment.'),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    mutation.mutate();
  }

  function handleClose() {
    setInvoiceNumber('');
    setAmount('');
    setPayerName('');
    setError('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Approve Cash Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Input
          label="Invoice Number *"
          required
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase())}
          placeholder="e.g. INV-2026-000001"
        />
        <Input
          label="Amount received (KSh) *"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Input
          label="Payer name"
          value={payerName}
          onChange={(event) => setPayerName(event.target.value)}
          placeholder="Optional"
        />
        <p className="text-xs text-gray-500">This records cash received against the invoice and updates its balance immediately.</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Approving…' : 'Approve Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiptDownloadButton({ transaction }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function downloadReceipt() {
    setLoading(true);
    setError('');
    try {
      const { data: invoice } = await api.get(`/api/invoices/${transaction.invoice_id}`);
      const pdf = new jsPDF();
      const logo = await loadLogoData();
      if (logo) pdf.addImage(logo, 'PNG', 15, 12, 22, 22);

      pdf.setFontSize(18);
      pdf.text('Grace Path Centre', 43, 20);
      pdf.setFontSize(10);
      pdf.text('For Palliative Medicine and Advanced Wound Care Services', 43, 27);
      pdf.setFontSize(16);
      pdf.text('PAYMENT RECEIPT', 15, 46);
      pdf.setFontSize(10);

      const rows = [
        ['Receipt number', transaction.transaction_id],
        ['Invoice', invoice.invoice_number],
        ...(invoice.admission_number ? [['Admission', invoice.admission_number]] : []),
        ['Patient', invoice.patient_name || transaction.payer_name || '—'],
        ['Patient number', invoice.patient_number || '—'],
        ['Payment method', transaction.payment_method === 'cash' ? 'Cash' : 'M-Pesa'],
        ['Received', formatDateTime(transaction.received_at)],
        ['Approved by', transaction.approved_by || '—'],
      ];
      let y = 57;
      for (const [label, value] of rows) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${label}:`, 15, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), 57, y);
        y += 7;
      }

      y += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payment purpose / invoice items', 15, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      const items = invoice.items?.length
        ? invoice.items
        : [{ description: invoice.admission_number ? `Admission ${invoice.admission_number}` : 'Invoice services', amount: invoice.total_amount }];
      for (const item of items) {
        const descriptionLines = pdf.splitTextToSize(item.description, 135);
        pdf.text(descriptionLines, 15, y);
        pdf.text(formatKsh(item.amount), 155, y, { align: 'right' });
        y += Math.max(7, descriptionLines.length * 5);
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
      }

      y += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Amount received', 15, y);
      pdf.text(formatKsh(transaction.amount), 195, y, { align: 'right' });
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Balance remaining: ${formatKsh(invoice.balance)}`, 15, y);
      pdf.save(`Grace-Path-Receipt-${transaction.transaction_id}.pdf`);
    } catch (downloadError) {
      setError(downloadError.response?.data?.detail || 'Could not generate receipt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button variant="secondary" onClick={downloadReceipt} disabled={loading}>
        {loading ? 'Preparing…' : 'Download Receipt'}
      </Button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

async function loadLogoData() {
  const response = await fetch('/logo.png');
  if (!response.ok) return null;
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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