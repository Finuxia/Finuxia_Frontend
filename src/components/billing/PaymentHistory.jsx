import { useState } from "react";
import { FileText } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import usePagedList from "../../hooks/usePagedList";
import { api } from "../../lib/api";
import { formatCents } from "../../lib/currency";
import { formatLongDate } from "../../lib/dates";
import { paymentStatusMeta } from "../../lib/statusMeta";
import { Badge, Table } from "../ui";
import LoadMore from "../ui/LoadMore";
import ErrorNotice from "../ErrorNotice";

const PAGE = 20;

/**
 * Every payment the account has made, newest first, from our own ledger (not from the payment provider): what was bought, the exact amount,
 * the access it gave, and a receipt for each payment that went through. Shown a page at a time. Shows nothing when there are no payments yet.
 */
export default function PaymentHistory({ title = "Payments" }) {
  const { addToast } = useToast();
  const { items, loading, loadingMore, hasMore, loadMore, error, reload } = usePagedList("/api/billing/payments", { limit: PAGE });
  const [receiptId, setReceiptId] = useState(null);

  const openReceipt = async (payment) => {
    setReceiptId(payment.id);
    try {
      await api.downloadReceipt(payment.id, `receipt-${payment.receiptNumber || payment.id}.pdf`);
    } catch (err) {
      addToast(err.message || "Could not get the receipt");
    } finally {
      setReceiptId(null);
    }
  };

  // Columns as data, which is what the shared Table takes: `render` builds the cells that are more than a value.
  const columns = [
    { key: "date", header: "Date", render: (payment) => formatLongDate(payment.date) || "—" },
    {
      key: "plan",
      header: "Plan",
      render: (payment) => (
        <>
          <span className="font-medium text-navy">{payment.planName || "Plan no longer offered"}</span>
          {payment.isMock && <span className="block text-xs text-slate-500">Test purchase: no money was taken</span>}
        </>
      ),
    },
    { key: "amount", header: "Amount", align: "right", render: (payment) => formatCents(payment.amountCents, payment.currency) },
    {
      key: "access",
      header: "Access",
      render: (payment) =>
        payment.accessWindow ? (
          <span className="text-xs text-slate-600">
            {formatLongDate(payment.accessWindow.start)} to {payment.accessWindow.end ? formatLongDate(payment.accessWindow.end) : "no end"}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    { key: "status", header: "Status", render: (payment) => <Badge meta={paymentStatusMeta(payment.status)} size="sm" /> },
    {
      key: "receipt",
      header: <span className="sr-only">Receipt</span>,
      render: (payment) =>
        payment.receiptAvailable ? (
          <button
            type="button"
            onClick={() => openReceipt(payment)}
            disabled={receiptId === payment.id}
            aria-label={`Download receipt ${payment.receiptNumber}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline disabled:opacity-60"
          >
            <FileText size={12} aria-hidden="true" />
            {receiptId === payment.id ? "Preparing..." : "Receipt"}
          </button>
        ) : null,
    },
  ];

  if (loading && items.length === 0) return <p className="text-sm text-slate-400">Loading payments...</p>;
  if (error && items.length === 0) return <ErrorNotice error={error} onRetry={reload} />;
  if (items.length === 0) return null;

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <Table caption="Your payments" columns={columns} rows={items} rowKey="id" />
      <LoadMore hasMore={hasMore} loadingMore={loadingMore} error={items.length > 0 ? error : null} onLoadMore={loadMore} />
    </section>
  );
}
