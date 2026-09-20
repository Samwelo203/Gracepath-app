import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { EmptyState, Spinner, formatKsh, formatDateTime } from '../components/ui';

function fetchReportData() {
  return Promise.all([
    api.get('/api/beds/stats'),
    api.get('/api/beds'),
    api.get('/api/admissions', { params: { limit: 1000 } }),
    api.get('/api/patients', { params: { limit: 500 } }),
    api.get('/api/invoices', { params: { limit: 1000 } }),
    api.get('/api/invoices/stats'),
    api.get('/api/payments/mpesa/transactions', { params: { limit: 1000 } }),
  ]).then(([beds, bedList, admissions, patients, invoices, invoiceStats, payments]) => ({
    bedStats: beds.data,
    beds: bedList.data,
    admissions: admissions.data,
    patients: patients.data,
    invoices: invoices.data,
    invoiceStats: invoiceStats.data,
    payments: payments.data,
  }));
}

export default function Reports() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['business-report'],
    queryFn: fetchReportData,
  });

  function printReport() {
    window.print();
  }

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <div className="p-8">
        <EmptyState
          icon="alert"
          title="Could not generate report"
          message={error.response?.data?.detail || error.message}
        />
      </div>
    );
  }

  const { bedStats, beds, admissions, patients, invoices, invoiceStats, payments } = data;
  const activeAdmissions = admissions.filter((admission) => admission.status === 'active');
  const dischargedAdmissions = admissions.filter((admission) => admission.status === 'discharged');
  const occupancy = bedStats.total ? ((bedStats.occupied / bedStats.total) * 100).toFixed(1) : '0.0';
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const generatedAt = new Date();
  const statusCounts = invoiceStats.counts_by_status || {};
  const outstandingInvoices = invoices
    .filter((invoice) => Number(invoice.balance) > 0)
    .sort((a, b) => Number(b.balance) - Number(a.balance));

  return (
    <div className="p-8 report-page">
      <div className="flex items-start justify-between mb-6 report-toolbar">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Business Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Planning and decision-making summary generated {generatedAt.toLocaleString('en-KE')}
          </p>
        </div>
        <button
          type="button"
          onClick={printReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm"
        >
          <span aria-hidden="true">▣</span> Generate PDF
        </button>
      </div>

      <div className="report-sheet">
        <div className="report-letterhead hidden print:flex">
          <img src="/logo.png" alt="Grace Path Centre logo" className="report-logo" />
          <div className="report-letterhead-copy">
            <h1 className="text-2xl font-bold">Grace Path Centre</h1>
            <p className="text-sm text-gray-600">Business planning and operations report</p>
            <p className="text-xs text-gray-500">Generated: {generatedAt.toLocaleString('en-KE')}</p>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Metric label="Total patients" value={patients.length} />
          <Metric label="Active admissions" value={activeAdmissions.length} />
          <Metric label="Bed occupancy" value={`${bedStats.occupied}/${bedStats.total}`} detail={`${occupancy}% occupied`} />
          <Metric label="Outstanding" value={formatKsh(invoiceStats.total_outstanding)} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ReportSection title="Capacity and occupancy">
            <ReportRow label="Total beds" value={bedStats.total} />
            <ReportRow label="Available" value={bedStats.available} />
            <ReportRow label="Occupied" value={bedStats.occupied} />
            <ReportRow label="Reserved" value={bedStats.reserved} />
            <ReportRow label="Maintenance" value={bedStats.maintenance} />
            <ReportRow label="Occupancy rate" value={`${occupancy}%`} />
          </ReportSection>

          <ReportSection title="Admissions overview">
            <ReportRow label="Active admissions" value={activeAdmissions.length} />
            <ReportRow label="Discharged admissions" value={dischargedAdmissions.length} />
            <ReportRow label="Cancelled admissions" value={admissions.filter((item) => item.status === 'cancelled').length} />
            <ReportRow label="Total admissions" value={admissions.length} />
            <ReportRow label="Available beds for new admissions" value={bedStats.available} />
          </ReportSection>
        </div>

        <ReportSection title="Financial performance" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Metric label="Total billed" value={formatKsh(invoiceStats.total_billed)} />
            <Metric label="Total collected" value={formatKsh(invoiceStats.total_paid)} />
            <Metric label="Outstanding" value={formatKsh(invoiceStats.total_outstanding)} />
            <Metric label="Payment transactions" value={payments.length} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <ReportRow label="Unpaid invoices" value={statusCounts.unpaid || 0} />
            <ReportRow label="Partially paid" value={statusCounts.partially_paid || 0} />
            <ReportRow label="Paid invoices" value={statusCounts.paid || 0} />
            <ReportRow label="Overpaid" value={statusCounts.overpaid || 0} />
            <ReportRow label="Cancelled" value={statusCounts.cancelled || 0} />
          </div>
        </ReportSection>

        <ReportSection title="Outstanding invoices" className="mb-6">
          {outstandingInvoices.length === 0 ? (
            <p className="text-sm text-gray-500">No outstanding invoices.</p>
          ) : (
            <ReportTable headers={['Invoice #', 'Patient', 'Total', 'Paid', 'Balance', 'Status']}>
              {outstandingInvoices.slice(0, 25).map((invoice) => {
                const patient = patientById.get(invoice.patient_id);
                return (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>{patient?.full_name || '—'}</td>
                    <td>{formatKsh(invoice.total_amount)}</td>
                    <td>{formatKsh(invoice.amount_paid)}</td>
                    <td className="font-semibold">{formatKsh(invoice.balance)}</td>
                    <td className="capitalize">{invoice.status.replace('_', ' ')}</td>
                  </tr>
                );
              })}
            </ReportTable>
          )}
        </ReportSection>

        <ReportSection title="Current admissions and patients" className="mb-6">
          {activeAdmissions.length === 0 ? (
            <p className="text-sm text-gray-500">No active admissions.</p>
          ) : (
            <ReportTable headers={['Admission #', 'Patient', 'Patient #', 'Admitted']}>
              {activeAdmissions.map((admission) => {
                const patient = patientById.get(admission.patient_id);
                return (
                  <tr key={admission.id}>
                    <td>{admission.admission_number}</td>
                    <td>{patient?.full_name || '—'}</td>
                    <td>{patient?.patient_number || '—'}</td>
                    <td>{formatDateTime(admission.admitted_at)}</td>
                  </tr>
                );
              })}
            </ReportTable>
          )}
        </ReportSection>

        <ReportSection title="Bed inventory" className="mb-6">
          <ReportTable headers={['Bed', 'Category', 'Daily rate', 'Status']}>
            {beds.map((bed) => (
              <tr key={bed.id}>
                <td>{bed.bed_number}</td>
                <td>{bed.category}</td>
                <td>{formatKsh(bed.daily_rate)}</td>
                <td className="capitalize">{bed.status}</td>
              </tr>
            ))}
          </ReportTable>
        </ReportSection>

        <ReportSection title="Recent payments">
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded.</p>
          ) : (
            <ReportTable headers={['Receipt', 'Invoice', 'Amount', 'Status', 'Received']}>
              {payments.slice(0, 25).map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.transaction_id}</td>
                  <td>{payment.invoice_number || '—'}</td>
                  <td>{formatKsh(payment.amount)}</td>
                  <td className="capitalize">{payment.status}</td>
                  <td>{formatDateTime(payment.received_at)}</td>
                </tr>
              ))}
            </ReportTable>
          )}
        </ReportSection>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500 font-medium">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      {detail && <div className="text-xs text-gray-500 mt-1">{detail}</div>}
    </div>
  );
}

function ReportSection({ title, children, className = '' }) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function ReportRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function ReportTable({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm report-table">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>{headers.map((header) => <th key={header} className="text-left px-3 py-2 font-medium">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {children}
        </tbody>
      </table>
    </div>
  );
}
