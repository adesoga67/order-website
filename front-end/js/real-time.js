/* ════════════════════════════════════════════════════════════
   realtime.js  –  WebSocket client, Paystack popup, live UI
   ════════════════════════════════════════════════════════════ */

const SOCKET_URL = "http://localhost:5000";
let socket = null;
let notifCount = 0;

/* ── ORDER TRACKER STEPS ─────────────────────────────────── */
const TRACKER_STEPS = [
  { key: "pending", icon: "🛒", label: "Placed" },
  { key: "confirmed", icon: "✅", label: "Confirmed" },
  { key: "preparing", icon: "👨‍🍳", label: "Cooking" },
  { key: "ready", icon: "📦", label: "Ready" },
  { key: "in-transit", icon: "🏍️", label: "On the way" },
  { key: "delivered", icon: "🎉", label: "Delivered" },
];

/* ── Connect Socket.io ───────────────────────────────────── */
function connectSocket() {
  const user = Auth.getUser();
  if (!user) return;

  // Load Socket.io client dynamically
  if (typeof io === "undefined") {
    const script = document.createElement("script");
    script.src = `${SOCKET_URL}/socket.io/socket.io.js`;
    script.onload = () => _initSocket(user);
    document.head.appendChild(script);
  } else {
    _initSocket(user);
  }
}

function _initSocket(user) {
  if (socket?.connected) return;

  socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    console.log("🔌 Socket connected:", socket.id);

    // Join role-specific rooms
    if (user.role === "customer") socket.emit("join:customer", user._id);
    if (user.role === "rider") socket.emit("join:rider", user._id);
    if (user.role === "restaurant_admin" || user.role === "super_admin")
      socket.emit("join:restaurant");

    // Show live indicator
    document.getElementById("live-indicator")?.classList.remove("hidden");
  });

  socket.on("disconnect", () => {
    document.getElementById("live-indicator")?.classList.add("hidden");
  });

  // ── New order (restaurant/admin only) ───────────────────
  socket.on("order:new", (data) => {
    bumpNotif();
    toast(
      `🆕 New order ${data.orderNumber} from ${data.customerName} — ₦${data.total?.toLocaleString()}`,
      "info",
    );

    // Auto-refresh dashboard if currently on it
    if (
      App.currentPage === "restaurant-dashboard" ||
      App.currentPage === "admin-dashboard"
    ) {
      Pages[App.currentPage]?.load?.();
    }
  });

  // ── Order status changed ─────────────────────────────────
  socket.on("order:status_update", (data) => {
    const statusMsg = {
      confirmed: `✅ Order ${data.orderNumber} confirmed!`,
      preparing: `👨‍🍳 Your order ${data.orderNumber} is being prepared`,
      "in-transit": `🏍️ Rider is on the way with ${data.orderNumber}!`,
      delivered: `🎉 Order ${data.orderNumber} delivered! Enjoy your meal!`,
      cancelled: `❌ Order ${data.orderNumber} was cancelled`,
    };

    const user = Auth.getUser();
    if (user.role === "customer" && statusMsg[data.status]) {
      toast(
        statusMsg[data.status],
        data.status === "cancelled" ? "error" : "success",
      );
    }

    // Live-update the tracker if customer is watching this order
    updateTracker(data.orderId, data.status);

    // Refresh the current page if order-related
    const refreshPages = [
      "my-orders",
      "restaurant-dashboard",
      "rider-dashboard",
      "admin-dashboard",
      "admin-orders",
      "restaurant-orders",
    ];
    if (refreshPages.includes(App.currentPage)) {
      Pages[App.currentPage]?.load?.();
    }
  });

  // ── Order assigned to rider ──────────────────────────────
  socket.on("order:assigned", (data) => {
    toast(
      `🏍️ New delivery assigned: ${data.orderNumber} → ${data.deliveryAddress}`,
      "info",
    );
    bumpNotif();
    if (App.currentPage === "rider-dashboard") Pages["rider-dashboard"].load();
  });

  // ── Dashboard refresh signal ─────────────────────────────
  socket.on("dashboard:refresh", () => {
    const dashPages = ["restaurant-dashboard", "admin-dashboard"];
    if (dashPages.includes(App.currentPage)) Pages[App.currentPage]?.load?.();
  });
}

function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/* ── NOTIFICATION COUNTER ────────────────────────────────── */
function bumpNotif() {
  notifCount++;
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.textContent = notifCount;
    badge.style.display = "flex";
  }
}

function clearNotif() {
  notifCount = 0;
  const badge = document.getElementById("notif-badge");
  if (badge) badge.style.display = "none";
}

/* ── ORDER TRACKER ───────────────────────────────────────── */
let activeTrackerOrderId = null;

function openTracker(orderId) {
  activeTrackerOrderId = orderId;
  renderTrackerModal(orderId);
  document.getElementById("tracker-modal").classList.add("open");
}

async function renderTrackerModal(orderId) {
  try {
    const res = await Orders.getOne(orderId);
    const order = res.data;
    const currentIdx = TRACKER_STEPS.findIndex((s) => s.key === order.status);

    document.getElementById("tracker-order-num").textContent =
      order.orderNumber;
    document.getElementById("tracker-address").textContent =
      order.deliveryAddress;
    document.getElementById("tracker-total").textContent =
      `₦${order.total.toLocaleString()}`;
    document.getElementById("tracker-payment").innerHTML =
      order.paymentStatus === "paid"
        ? `<span class="payment-badge-paid">💳 Paid</span>`
        : `<span class="payment-badge-pending">⏳ Payment pending</span>
           <button class="pay-now-btn" style="margin-left:10px" onclick="startPayment('${order._id}')">Pay Now</button>`;

    // Build steps
    const progressPct =
      currentIdx >= 0 ? (currentIdx / (TRACKER_STEPS.length - 1)) * 100 : 0;
    document.getElementById("tracker-steps").innerHTML = `
      <div class="tracker-progress" style="width:${progressPct}%"></div>
      ${TRACKER_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return `<div class="tracker-step ${isDone ? "done" : ""} ${isActive ? "active" : ""}">
          <div class="tracker-dot">${isDone ? "✓" : step.icon}</div>
          <div class="tracker-step-label">${step.label}</div>
        </div>`;
      }).join("")}`;

    // Status history timeline
    document.getElementById("tracker-history").innerHTML = order.statusHistory
      .slice()
      .reverse()
      .map(
        (
          h,
        ) => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span class="badge badge-${h.status}" style="flex-shrink:0">${h.status}</span>
        <span style="color:var(--muted)">${new Date(h.timestamp).toLocaleString("en-NG")}</span>
      </div>`,
      )
      .join("");

    if (order.rider) {
      document.getElementById("tracker-rider").innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--primary-light);border-radius:var(--radius);margin-top:16px">
          <div style="font-size:28px">🏍️</div>
          <div>
            <div style="font-weight:700">${order.rider.name}</div>
            <div style="font-size:13px;color:var(--muted)">${order.rider.phone || "Contact unavailable"}</div>
          </div>
        </div>`;
    } else {
      document.getElementById("tracker-rider").innerHTML = "";
    }
  } catch (err) {
    console.error("Tracker error:", err);
  }
}

function updateTracker(orderId, newStatus) {
  // If the tracker modal is open for this exact order, refresh it live
  if (
    activeTrackerOrderId === orderId &&
    document.getElementById("tracker-modal").classList.contains("open")
  ) {
    renderTrackerModal(orderId);
  }
}

/* ── PAYSTACK PAYMENT ────────────────────────────────────── */
async function startPayment(orderId) {
  try {
    toast("Initializing payment…", "info");
    const res = await Orders.pay(orderId);
    const { authorizationUrl, reference } = res.data;

    // Load Paystack inline JS if not already loaded
    if (typeof PaystackPop === "undefined") {
      await loadScript("https://js.paystack.co/v1/inline.js");
    }

    const user = Auth.getUser();
    const handler = PaystackPop.setup({
      key:
        window.PAYSTACK_PUBLIC_KEY ||
        prompt("Enter your Paystack public key (pk_test_...):"),
      email: user.email,
      ref: reference,
      onSuccess: async (txn) => {
        toast("✅ Payment successful! Verifying…", "success");
        try {
          await Orders.verifyPayment(orderId, txn.reference);
          toast(
            "🎉 Payment confirmed! Your order is being prepared.",
            "success",
          );
          renderTrackerModal(orderId);
          if (App.currentPage === "my-orders") Pages["my-orders"].load();
        } catch (e) {
          toast(
            "Payment recorded but verification pending. Check your email.",
            "info",
          );
        }
      },
      onCancel: () => toast("Payment cancelled", "error"),
    });
    handler.openIframe();
  } catch (err) {
    toast(`Payment error: ${err.message}`, "error");
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── IMAGE UPLOAD PREVIEW ────────────────────────────────── */
function initImageUpload(inputId, previewId, areaId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const area = document.getElementById(areaId);
  if (!input || !preview || !area) return;

  area.addEventListener("click", () => input.click());
  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("dragover");
  });
  area.addEventListener("dragleave", () => area.classList.remove("dragover"));
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("dragover");
    if (e.dataTransfer.files[0]) {
      input.files = e.dataTransfer.files;
      showPreview(e.dataTransfer.files[0], preview, area);
    }
  });

  input.addEventListener("change", () => {
    if (input.files[0]) showPreview(input.files[0], preview, area);
  });
}

function showPreview(file, previewEl, areaEl) {
  const reader = new FileReader();
  reader.onload = (e) => {
    previewEl.src = e.target.result;
    previewEl.style.display = "block";
    areaEl.querySelector(".upload-hint").style.display = "none";
  };
  reader.readAsDataURL(file);
}

/* ── Extend Orders API with new methods ──────────────────── */
// These get appended after api.js loads
window.addEventListener("DOMContentLoaded", () => {
  // Patch Orders object with new endpoints
  Orders.pay = (id) => apiFetch(`/orders/${id}/pay`, { method: "POST" });
  Orders.verifyPayment = (id, ref) =>
    apiFetch(`/orders/${id}/verify-payment?reference=${ref}`);

  // Patch Menu.create to use FormData (supports file uploads)
  Menu.createWithImage = async (formData) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/menu`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  Menu.updateWithImage = async (id, formData) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/menu/${id}`, {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };
});
