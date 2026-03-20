let _io = null;

// ── Register the io instance (called from server.js) ─────────
const init = (io) => {
  _io = io;

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Customer joins their personal room to receive order updates
    socket.on("join:customer", (userId) => {
      socket.join(`customer:${userId}`);
      console.log(`👤 Customer ${userId} joined their room`);
    });

    // Restaurant admin / super admin join the restaurant room
    socket.on("join:restaurant", () => {
      socket.join("restaurant");
      console.log(`🍴 Admin joined restaurant room`);
    });

    // Rider joins their personal room
    socket.on("join:rider", (userId) => {
      socket.join(`rider:${userId}`);
      console.log(`🏍️ Rider ${userId} joined their room`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

// ── Emit: New order placed ────────────────────────────────────
// → Notifies restaurant room
const emitNewOrder = (order) => {
  if (!_io) return;
  _io.to("restaurant").emit("order:new", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerName: order.customer?.name,
    total: order.total,
    items: order.items,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
  });
};

// ── Emit: Order status changed ────────────────────────────────
// → Notifies customer + restaurant + assigned rider
const emitOrderStatusUpdate = (order) => {
  if (!_io) return;
  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    updatedAt: new Date(),
    rider: order.rider ? { name: order.rider.name, phone: order.rider.phone } : null,
  };

  // Customer receives the update on their personal room
  if (order.customer) {
    const customerId = order.customer._id || order.customer;
    _io.to(`customer:${customerId}`).emit("order:status_update", payload);
  }

  // All restaurant admins / super admins receive it too
  _io.to("restaurant").emit("order:status_update", payload);

  // Notify assigned rider if one exists
  if (order.rider) {
    const riderId = order.rider._id || order.rider;
    _io.to(`rider:${riderId}`).emit("order:status_update", payload);
  }
};

// ── Emit: Rider assigned ─────────────────────────────────────
const emitRiderAssigned = (order) => {
  if (!_io) return;
  const riderId = order.rider?._id || order.rider;
  if (riderId) {
    _io.to(`rider:${riderId}`).emit("order:assigned", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      deliveryAddress: order.deliveryAddress,
      customerName: order.customer?.name,
      total: order.total,
    });
  }
};

// ── Emit: Dashboard stats refresh ────────────────────────────
const emitDashboardRefresh = () => {
  if (!_io) return;
  _io.to("restaurant").emit("dashboard:refresh");
};

module.exports = { init, emitNewOrder, emitOrderStatusUpdate, emitRiderAssigned, emitDashboardRefresh };
