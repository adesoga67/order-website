const axios = require("axios");

const PAYSTACK_BASE = "https://api.paystack.co";

const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

// ── Initialize a transaction ─────────────────────────────────
// Returns { authorization_url, access_code, reference }
const initializeTransaction = async ({ email, amountNaira, orderId, orderNumber, callbackUrl }) => {
  const amountKobo = Math.round(amountNaira * 100); // Paystack uses kobo

  const { data } = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    {
      email,
      amount: amountKobo,
      reference: `CHOWNOW-${orderNumber}-${Date.now()}`,
      callback_url: callbackUrl || `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-callback`,
      metadata: {
        orderId: orderId.toString(),
        orderNumber,
        custom_fields: [
          { display_name: "Order Number", variable_name: "order_number", value: orderNumber },
        ],
      },
    },
    { headers: paystackHeaders() }
  );

  return data.data; // { authorization_url, access_code, reference }
};

// ── Verify a transaction ─────────────────────────────────────
const verifyTransaction = async (reference) => {
  const { data } = await axios.get(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: paystackHeaders() }
  );
  return data.data; // { status, amount, paid_at, customer, metadata, ... }
};

// ── Parse Paystack webhook signature ────────────────────────
const crypto = require("crypto");
const validateWebhook = (rawBody, signature) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
};

module.exports = { initializeTransaction, verifyTransaction, validateWebhook };
