const nodemailer = require("nodemailer");

// ── Transporter ──────────────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

// ── Base HTML wrapper ────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { margin:0; padding:0; background:#FDF8F4; font-family:'Segoe UI',Arial,sans-serif; color:#2A1A0E; }
    .wrapper { max-width:560px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(200,75,17,0.10); }
    .header { background:linear-gradient(135deg,#C84B11,#8B3210); padding:28px 32px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px; }
    .header p { color:rgba(255,255,255,0.85); margin:6px 0 0; font-size:14px; }
    .body { padding:28px 32px; }
    .info-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #F0E8E0; font-size:14px; }
    .info-row:last-child { border-bottom:none; }
    .info-label { color:#7A5C4A; font-weight:600; }
    .status-badge { display:inline-block; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:700; }
    .btn { display:inline-block; padding:12px 28px; background:#C84B11; color:#fff; border-radius:10px; text-decoration:none; font-weight:700; font-size:14px; margin-top:20px; }
    .footer { background:#FDF8F4; padding:18px 32px; text-align:center; font-size:12px; color:#7A5C4A; border-top:1px solid #E8DDD4; }
    .item-row { display:flex; justify-content:space-between; padding:7px 0; font-size:14px; }
    .total-row { display:flex; justify-content:space-between; padding:12px 0; font-size:16px; font-weight:700; border-top:2px solid #E8DDD4; margin-top:8px; color:#C84B11; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🍽️ ChowNow</h1>
      <p>Your favourite Nigerian meals, delivered hot</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">© ${new Date().getFullYear()} ChowNow · You received this because you placed an order with us.</div>
  </div>
</body>
</html>`;

// ── Status badge color map ───────────────────────────────────
const statusStyle = {
  pending:    "background:#FBF0D8;color:#7A5000",
  confirmed:  "background:#E3F0FF;color:#1040A0",
  preparing:  "background:#F5E6DE;color:#8B3210",
  ready:      "background:#E8F5E9;color:#1B5E20",
  "in-transit":"background:#E3F2FD;color:#0D47A1",
  delivered:  "background:#E4F5E8;color:#2D7A3F",
  cancelled:  "background:#FDECEA;color:#C0392B",
};

// ── Email: Order Confirmation ────────────────────────────────
const sendOrderConfirmation = async (order, customerEmail) => {
  const itemRows = order.items
    .map(i => `<div class="item-row"><span>${i.emoji || "🍽️"} ${i.name} ×${i.quantity}</span><span>₦${(i.price * i.quantity).toLocaleString()}</span></div>`)
    .join("");

  const html = baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:20px">Order Confirmed! 🎉</h2>
    <p style="color:#7A5C4A;margin:0 0 20px;font-size:14px">Thanks for ordering, ${order.customer?.name || "there"}! We're getting your food ready.</p>

    <div style="background:#FDF8F4;border-radius:10px;padding:16px;margin-bottom:20px">
      <div class="info-row"><span class="info-label">Order Number</span><span style="font-weight:700">${order.orderNumber}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="status-badge" style="${statusStyle[order.status] || ""}">${order.status}</span></div>
      <div class="info-row"><span class="info-label">Delivery Address</span><span>${order.deliveryAddress}</span></div>
      ${order.note ? `<div class="info-row"><span class="info-label">Note</span><span>${order.note}</span></div>` : ""}
    </div>

    <h3 style="font-size:15px;margin:0 0 10px">Order Summary</h3>
    ${itemRows}
    <div class="item-row" style="color:#7A5C4A"><span>Subtotal</span><span>₦${order.subtotal.toLocaleString()}</span></div>
    <div class="item-row" style="color:#7A5C4A"><span>Delivery fee</span><span>₦${order.deliveryFee.toLocaleString()}</span></div>
    <div class="total-row"><span>Total Paid</span><span>₦${order.total.toLocaleString()}</span></div>
  `);

  return sendMail(customerEmail, `Order ${order.orderNumber} confirmed ✅ – ChowNow`, html);
};

// ── Email: Status Update ─────────────────────────────────────
const sendStatusUpdate = async (order, customerEmail, newStatus) => {
  const messages = {
    confirmed:   "Great news! Your order has been confirmed and our kitchen is firing up.",
    preparing:   "Our chefs are working their magic on your order right now! 👨‍🍳",
    ready:       "Your order is ready and waiting for pickup by your rider!",
    "in-transit":"Your food is on its way! Your rider has picked up your order. 🏍️",
    delivered:   "Your order has been delivered! Enjoy your meal 😋",
    cancelled:   "We're sorry, your order has been cancelled. Please contact support if you have questions.",
  };

  const html = baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:20px">Order Update</h2>
    <p style="color:#7A5C4A;margin:0 0 20px;font-size:14px">${messages[newStatus] || `Your order status has changed to: ${newStatus}`}</p>

    <div style="background:#FDF8F4;border-radius:10px;padding:16px;margin-bottom:20px">
      <div class="info-row"><span class="info-label">Order Number</span><span style="font-weight:700">${order.orderNumber}</span></div>
      <div class="info-row"><span class="info-label">New Status</span><span class="status-badge" style="${statusStyle[newStatus] || ""}">${newStatus}</span></div>
      ${order.rider ? `<div class="info-row"><span class="info-label">Rider</span><span>${order.rider.name} · ${order.rider.phone || ""}</span></div>` : ""}
      <div class="info-row"><span class="info-label">Total</span><span style="font-weight:700;color:#C84B11">₦${order.total.toLocaleString()}</span></div>
    </div>

    <p style="font-size:13px;color:#7A5C4A">Questions? Reply to this email or contact our support team.</p>
  `);

  const subjects = {
    confirmed:   `Your order ${order.orderNumber} is confirmed ✅`,
    preparing:   `We're cooking your order ${order.orderNumber} 👨‍🍳`,
    "in-transit":`Your rider is on the way! 🏍️ – ${order.orderNumber}`,
    delivered:   `Delivered! Enjoy your meal 😋 – ${order.orderNumber}`,
    cancelled:   `Order ${order.orderNumber} cancelled`,
  };

  return sendMail(customerEmail, subjects[newStatus] || `Order ${order.orderNumber} updated`, html);
};

// ── Email: Payment Receipt ───────────────────────────────────
const sendPaymentReceipt = async (order, customerEmail, paymentRef) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:20px">Payment Successful 💳</h2>
    <p style="color:#7A5C4A;margin:0 0 20px;font-size:14px">Your payment for order <strong>${order.orderNumber}</strong> was received successfully.</p>

    <div style="background:#E4F5E8;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #2D7A3F30">
      <div class="info-row"><span class="info-label">Payment Reference</span><span style="font-family:monospace;font-size:13px">${paymentRef}</span></div>
      <div class="info-row"><span class="info-label">Amount Paid</span><span style="font-weight:700;color:#2D7A3F">₦${order.total.toLocaleString()}</span></div>
      <div class="info-row"><span class="info-label">Order</span><span>${order.orderNumber}</span></div>
      <div class="info-row"><span class="info-label">Date</span><span>${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}</span></div>
    </div>

    <p style="font-size:13px;color:#7A5C4A">Keep this email as your payment receipt. Your food is being prepared! 🍛</p>
  `);

  return sendMail(customerEmail, `Payment receipt – ${order.orderNumber} – ChowNow`, html);
};

// ── Core send function ───────────────────────────────────────
const sendMail = async (to, subject, html) => {
  // Silently skip if mail is not configured
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log(`📧 [Email skipped – not configured] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `"ChowNow" <${process.env.MAIL_USER}>`,
      to, subject, html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`📧 Email error: ${err.message}`);
    // Don't throw — email failure should never crash the main flow
    return { error: err.message };
  }
};

module.exports = { sendOrderConfirmation, sendStatusUpdate, sendPaymentReceipt, sendMail };
