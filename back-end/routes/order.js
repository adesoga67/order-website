const express = require("express");
const Order = require("../models/Order");
const { protect, authorize } = require("../middleware/auth");
const socketService = require("../services/socketService");
const emailService = require("../services/emailService");
const { initializeTransaction, verifyTransaction, validateWebhook } = require("../services/paystackService");

const router = express.Router();

// POST /api/orders  (customer only)
router.post("/", protect, authorize("customer"), async (req, res) => {
  try {
    const { items, deliveryAddress, note } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ success: false, message: "Order must contain at least one item" });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = 500;
    const total = subtotal + deliveryFee;

    const order = await Order.create({
      customer: req.user._id, items, subtotal, deliveryFee, total,
      deliveryAddress, note, paymentStatus: "pending",
      statusHistory: [{ status: "pending", updatedBy: req.user._id }],
    });
    await order.populate("customer", "name email phone");

    socketService.emitNewOrder(order);
    socketService.emitDashboardRefresh();
    emailService.sendOrderConfirmation(order, req.user.email);

    res.status(201).json({ success: true, message: "Order placed successfully", data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error placing order" });
  }
});

// GET /api/orders  (role-filtered)
router.get("/", protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "customer") filter.customer = req.user._id;
    else if (req.user.role === "rider") filter.rider = req.user._id;

    const orders = await Order.find(filter)
      .populate("customer", "name email phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
});

// GET /api/orders/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone")
      .populate("rider", "name phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (req.user.role === "customer" && order.customer._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Access denied" });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching order" });
  }
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", protect, authorize("restaurant_admin", "super_admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["confirmed", "preparing", "ready", "in-transit", "delivered", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(", ")}` });

    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone")
      .populate("rider", "name phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.status = status;
    order.statusHistory.push({ status, updatedBy: req.user._id });
    await order.save();

    socketService.emitOrderStatusUpdate(order);
    socketService.emitDashboardRefresh();

    const notifyStatuses = ["confirmed", "preparing", "in-transit", "delivered", "cancelled"];
    if (notifyStatuses.includes(status) && order.customer?.email)
      emailService.sendStatusUpdate(order, order.customer.email, status);

    res.json({ success: true, message: `Order status updated to "${status}"`, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating order status" });
  }
});

// PATCH /api/orders/:id/assign-rider
router.patch("/:id/assign-rider", protect, authorize("restaurant_admin", "super_admin"), async (req, res) => {
  try {
    const { riderId } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id, { rider: riderId, status: "in-transit" }, { new: true }
    ).populate("customer", "name email phone").populate("rider", "name phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    socketService.emitRiderAssigned(order);
    socketService.emitOrderStatusUpdate(order);
    if (order.customer?.email)
      emailService.sendStatusUpdate(order, order.customer.email, "in-transit");

    res.json({ success: true, message: "Rider assigned", data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error assigning rider" });
  }
});

// PATCH /api/orders/:id/deliver (rider only)
router.patch("/:id/deliver", protect, authorize("rider"), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone")
      .populate("rider", "name phone");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.rider._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "This order is not assigned to you" });

    order.status = "delivered";
    order.statusHistory.push({ status: "delivered", updatedBy: req.user._id });
    await order.save();

    socketService.emitOrderStatusUpdate(order);
    socketService.emitDashboardRefresh();
    if (order.customer?.email)
      emailService.sendStatusUpdate(order, order.customer.email, "delivered");

    res.json({ success: true, message: "Order marked as delivered", data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error marking delivery" });
  }
});

// POST /api/orders/:id/pay
router.post("/:id/pay", protect, authorize("customer"), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("customer", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.customer._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Access denied" });
    if (order.paymentStatus === "paid")
      return res.status(400).json({ success: false, message: "Order already paid" });

    const txn = await initializeTransaction({
      email: req.user.email,
      amountNaira: order.total,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
    order.paymentReference = txn.reference;
    await order.save();

    res.json({
      success: true,
      data: { authorizationUrl: txn.authorization_url, reference: txn.reference, accessCode: txn.access_code },
    });
  } catch (error) {
    console.error("Paystack init error:", error.message);
    res.status(500).json({ success: false, message: "Payment initialization failed. Check Paystack config." });
  }
});

// GET /api/orders/:id/verify-payment
router.get("/:id/verify-payment", protect, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: "Payment reference required" });

    const txnData = await verifyTransaction(reference);
    if (txnData.status !== "success")
      return res.status(400).json({ success: false, message: "Payment not successful", data: txnData });

    const order = await Order.findById(req.params.id).populate("customer", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.paymentStatus = "paid";
    order.paymentReference = reference;
    order.status = "confirmed";
    order.statusHistory.push({ status: "confirmed", updatedBy: order.customer._id });
    await order.save();

    socketService.emitOrderStatusUpdate(order);
    socketService.emitDashboardRefresh();
    if (order.customer?.email) {
      emailService.sendPaymentReceipt(order, order.customer.email, reference);
      emailService.sendStatusUpdate(order, order.customer.email, "confirmed");
    }

    res.json({ success: true, message: "Payment verified successfully", data: order });
  } catch (error) {
    console.error("Paystack verify error:", error.message);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
});

// POST /api/orders/webhook (Paystack webhook)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  if (!validateWebhook(req.body, signature))
    return res.status(401).json({ message: "Invalid webhook signature" });

  const event = JSON.parse(req.body);
  if (event.event === "charge.success") {
    const { reference, metadata } = event.data;
    const orderId = metadata?.orderId;
    if (orderId) {
      const order = await Order.findById(orderId).populate("customer", "name email");
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.paymentReference = reference;
        order.status = "confirmed";
        order.statusHistory.push({ status: "confirmed" });
        await order.save();
        socketService.emitOrderStatusUpdate(order);
        socketService.emitDashboardRefresh();
        if (order.customer?.email)
          emailService.sendPaymentReceipt(order, order.customer.email, reference);
      }
    }
  }
  res.json({ received: true });
});

module.exports = router;
