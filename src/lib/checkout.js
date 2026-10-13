/**
 * Checkout bookkeeping. The page the payment provider sends the customer back to must never take the URL's word for it that a payment happened
 * (anyone can type /billing/success): it asks the server, which knows from its own ledger.
 *
 * The newest payment is the one checkout just opened (it is recorded before the customer is sent to the provider), so it is the payment to
 * watch. It is "paid" only when the server's ledger says it succeeded, which happens when the provider's signed confirmation arrives. This works
 * the same whether the customer bought a new plan or bought the one they are on again.
 */

/** Has the server recorded the newest payment as paid? (A demo purchase moved no money and never counts.) */
export function purchaseConfirmed(newestPayment) {
  return Boolean(newestPayment) && newestPayment.status === "succeeded" && !newestPayment.isMock;
}
