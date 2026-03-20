/* ════════════════════════════════════════════════════════════
   app.js  —  SPA router, page renderers, all UI logic
   ════════════════════════════════════════════════════════════ */

const API_BASE = "http://localhost:5000";
window.PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_WITH_YOUR_KEY";

/* ── App State ───────────────────────────────────────────── */
const App = {
  currentPage: "auth",
  user: null,

  init() {
    this.user = Auth.getUser();
    if (Auth.isLoggedIn() && this.user) {
      this.showNavbar();
      this.navigateTo(this.defaultPageForRole(this.user.role));
      connectSocket();
    } else {
      document.getElementById("navbar").classList.add("hidden");
      this.showPage("auth");
    }
  },

  defaultPageForRole(role) {
    const map = { customer: "menu", restaurant_admin: "restaurant-dashboard", rider: "rider-dashboard", super_admin: "admin-dashboard" };
    return map[role] || "menu";
  },

  showNavbar() {
    document.getElementById("navbar").classList.remove("hidden");
    this.renderNavLinks();
    this.renderUserInfo();
    this.setupNavbarExtras();
  },

  setupNavbarExtras() {
    const role = this.user.role;
    // Cart button — customers only
    const cartBtn = document.getElementById("cart-btn");
    cartBtn.classList.toggle("hidden", role !== "customer");

    // Notification bell — non-customers
    const notifBtn = document.getElementById("notif-btn");
    notifBtn.classList.toggle("hidden", role === "customer");
  },

  renderNavLinks() {
    const nav = document.getElementById("navbar-nav");
    const role = this.user.role;
    const links = {
      customer:         [{ id: "menu", label: "🍽️ Menu" }, { id: "my-orders", label: "📦 My Orders" }],
      restaurant_admin: [{ id: "restaurant-dashboard", label: "📊 Dashboard" }, { id: "manage-menu", label: "🍴 Manage Menu" }, { id: "restaurant-orders", label: "📋 Orders" }],
      rider:            [{ id: "rider-dashboard", label: "🏍️ My Deliveries" }],
      super_admin:      [{ id: "admin-dashboard", label: "📊 Dashboard" }, { id: "admin-orders", label: "📋 All Orders" }, { id: "admin-users", label: "👥 Users" }, { id: "manage-menu", label: "🍴 Menu" }],
    };
    nav.innerHTML = (links[role] || []).map(l =>
      `<button class="nav-link" onclick="App.navigateTo('${l.id}')" id="nav-${l.id}">${l.label}</button>`
    ).join("");
  },

  renderUserInfo() {
    const role = this.user.role;
    const initials = this.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = { customer: "Customer", restaurant_admin: "Restaurant", rider: "Rider", super_admin: "Super Admin" }[role];
    document.getElementById("user-info").innerHTML = `
      <div class="avatar avatar-${role}">${initials}</div>
      <div>
        <div style="font-size:13px;font-weight:700">${this.user.name}</div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--primary)">${roleLabel}</div>
      </div>`;
  },

  navigateTo(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add("active");
    document.getElementById(`nav-${pageId}`)?.classList.add("active");
    this.currentPage = pageId;
    Pages[pageId]?.load?.();
  },

  showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(`page-${id}`)?.classList.add("active");
  },
};

/* ── Toast ───────────────────────────────────────────────── */
function toast(msg, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ── Shared order table renderer ─────────────────────────── */
function renderOrderTable(orders, { showRiderAssign = false, showStatusSelect = false } = {}) {
  if (orders.length === 0)
    return `<div class="empty-state"><div class="emoji">📋</div><h3>No orders yet</h3></div>`;

  const rows = orders.map(o => `
    <tr>
      <td>
        <strong>${o.orderNumber}</strong>
        <div style="font-size:11px;color:var(--muted)">${new Date(o.createdAt).toLocaleDateString("en-NG",{dateStyle:"medium"})}</div>
      </td>
      <td>${o.customer?.name || "—"}</td>
      <td style="font-size:13px;max-width:200px;color:var(--muted)">${o.items.map(i=>`${i.emoji||"🍽️"} ${i.name} ×${i.quantity}`).join(", ")}</td>
      <td><strong>₦${o.total.toLocaleString()}</strong></td>
      <td>
        <span class="badge badge-${o.status}">${o.status}</span>
        ${o.paymentStatus === "paid"
          ? `<span class="payment-badge-paid" style="margin-left:4px">💳</span>`
          : `<span class="payment-badge-pending" style="margin-left:4px">⏳</span>`}
      </td>
      <td>
        ${showStatusSelect ? `
        <select class="form-select" style="width:auto;padding:5px 8px;font-size:12px" onchange="updateOrderStatus('${o._id}',this.value)">
          ${["pending","confirmed","preparing","ready","in-transit","delivered","cancelled"].map(s=>`<option value="${s}"${s===o.status?" selected":""}>${s}</option>`).join("")}
        </select>` : ""}
        ${showRiderAssign && o.status==="ready" ? `<button class="btn btn-ghost btn-sm" style="margin-left:4px" onclick="openAssignRiderModal('${o._id}','${o.orderNumber}')">Assign Rider</button>` : ""}
      </td>
    </tr>`).join("");

  return `<div class="table-wrapper"><table>
    <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/* ════════════════════════════════════════════════════════════
   PAGES
   ════════════════════════════════════════════════════════════ */
const Pages = {

  /* ── Customer: Menu ──────────────────────────────────────── */
  menu: {
    items: [],
    async load() {
      try {
        const res = await Menu.getAll();
        this.items = res.data;
        this.renderFilters();
        this.renderItems("All");
      } catch (err) { toast("Failed to load menu", "error"); }
    },
    renderFilters() {
      const cats = ["All", ...new Set(this.items.map(i => i.category))];
      document.getElementById("menu-filters").innerHTML = cats.map(c =>
        `<button class="filter-btn ${c==="All"?"active":""}" onclick="Pages.menu.renderItems('${c}',this)">${c}</button>`
      ).join("");
    },
    renderItems(category, btn) {
      if (btn) { document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); }
      const items = category === "All" ? this.items : this.items.filter(i => i.category === category);
      const grid = document.getElementById("menu-grid");
      if (!items.length) { grid.innerHTML = `<div class="empty-state"><div class="emoji">🍽️</div><h3>No items here</h3></div>`; return; }
      grid.innerHTML = items.map(item => {
        const imgEl = item.image
          ? `<img class="menu-card-img" src="${API_BASE}${item.image}" alt="${item.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : "";
        const emojiEl = `<div class="menu-card-emoji" style="${item.image?"display:none":""}">${item.emoji||"🍽️"}</div>`;
        return `<div class="menu-card">
          ${imgEl}${emojiEl}
          <div class="menu-card-body">
            <div class="menu-card-name">${item.name}</div>
            <div class="menu-card-desc">${item.description||""}</div>
            <div class="menu-card-meta">
              <span>⭐ ${item.rating||"New"}</span>
              <span>⏱️ ${item.preparationTime} min</span>
              <span class="badge badge-${item.isAvailable?"delivered":"cancelled"}" style="font-size:11px">${item.isAvailable?"Available":"Unavailable"}</span>
            </div>
            <div class="menu-card-footer" style="margin-top:12px">
              <div class="menu-card-price">₦${item.price.toLocaleString()}</div>
              ${item.isAvailable
                ? `<button class="btn btn-primary btn-sm" onclick="addToCart('${item._id}','${item.name.replace(/'/g,"\\'")}',${item.price},'${item.emoji||"🍽️"}')">Add to cart</button>`
                : `<button class="btn btn-ghost btn-sm" disabled>Unavailable</button>`}
            </div>
          </div>
        </div>`;
      }).join("");
    },
  },

  /* ── Customer: My Orders ─────────────────────────────────── */
  "my-orders": {
    async load() {
      try {
        const res = await Orders.getAll();
        const container = document.getElementById("my-orders-list");
        if (!res.data.length) {
          container.innerHTML = `<div class="empty-state"><div class="emoji">📦</div><h3>No orders yet</h3><p>Head to the menu and place your first order!</p></div>`;
          return;
        }
        container.innerHTML = res.data.map(o => `
          <div class="card" style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
              <div>
                <div style="font-size:16px;font-weight:700">${o.orderNumber}</div>
                <div style="font-size:13px;color:var(--muted)">${new Date(o.createdAt).toLocaleDateString("en-NG",{dateStyle:"medium"})}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                <span class="badge badge-${o.status}">${o.status}</span>
                ${o.paymentStatus==="paid"
                  ? `<span class="payment-badge-paid">💳 Paid</span>`
                  : `<span class="payment-badge-pending">⏳ Unpaid</span>`}
              </div>
            </div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:10px">${o.items.map(i=>`${i.emoji||"🍽️"} ${i.name} ×${i.quantity}`).join(" · ")}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div style="font-size:13px;color:var(--muted)">📍 ${o.deliveryAddress}</div>
              <div style="font-size:16px;font-weight:700;color:var(--primary)">₦${o.total.toLocaleString()}</div>
            </div>
            ${o.rider?`<div style="font-size:13px;color:var(--muted);margin-top:8px">🏍️ Rider: <strong>${o.rider.name}</strong>${o.rider.phone?" · "+o.rider.phone:""}</div>`:""}
            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="openTracker('${o._id}')">📍 Track Order</button>
              ${o.paymentStatus!=="paid"
                ? `<button class="pay-now-btn" onclick="startPayment('${o._id}')">💳 Pay Now</button>`
                : ""}
            </div>
          </div>`).join("");
      } catch (err) { toast("Failed to load orders", "error"); }
    },
  },

  /* ── Restaurant Admin: Dashboard ─────────────────────────── */
  "restaurant-dashboard": {
    async load() {
      try {
        const res = await Orders.getAll();
        const orders = res.data;
        const stats = {
          total: orders.length,
          pending: orders.filter(o=>o.status==="pending").length,
          active: orders.filter(o=>["confirmed","preparing","ready"].includes(o.status)).length,
          revenue: orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.total,0),
        };
        document.getElementById("rd-stats").innerHTML = [
          { label: "Total Orders", value: stats.total, icon: "📋" },
          { label: "Pending", value: stats.pending, icon: "⏳" },
          { label: "In Progress", value: stats.active, icon: "👨‍🍳" },
          { label: "Revenue (delivered)", value: `₦${stats.revenue.toLocaleString()}`, icon: "💰" },
        ].map(s=>`<div class="stat-card"><div class="stat-icon">${s.icon}</div><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`).join("");

        document.getElementById("rd-recent-orders").innerHTML = renderOrderTable(
          orders.slice(0, 20),
          { showStatusSelect: true, showRiderAssign: true }
        );
      } catch (err) { toast("Failed to load dashboard", "error"); }
    },
  },

  /* ── Restaurant Admin: Orders (same as dashboard table) ──── */
  "restaurant-orders": {
    async load() {
      try {
        const res = await Orders.getAll();
        document.getElementById("restaurant-orders-list").innerHTML = renderOrderTable(
          res.data, { showStatusSelect: true, showRiderAssign: true }
        );
      } catch (err) { toast("Failed to load orders", "error"); }
    },
  },

  /* ── Restaurant Admin: Manage Menu ──────────────────────── */
  "manage-menu": {
    async load() {
      try {
        const res = await Menu.getAll();
        const grid = document.getElementById("manage-menu-grid");
        if (!res.data.length) { grid.innerHTML = `<div class="empty-state"><div class="emoji">🍽️</div><h3>No items yet — add one!</h3></div>`; return; }
        grid.innerHTML = res.data.map(item => `
          <div class="card manage-menu-item">
            <div class="manage-menu-thumb">
              ${item.image
                ? `<img src="${API_BASE}${item.image}" class="manage-menu-img" alt="${item.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
                   <div class="manage-menu-emoji" style="display:none">${item.emoji||"🍽️"}</div>`
                : `<div class="manage-menu-emoji">${item.emoji||"🍽️"}</div>`}
            </div>
            <div class="manage-menu-info">
              <div class="manage-menu-name">${item.name}</div>
              <div class="manage-menu-meta">${item.category} · ₦${item.price.toLocaleString()} · ${item.preparationTime} min</div>
            </div>
            <div class="manage-menu-actions">
              <span class="badge badge-${item.isAvailable?"delivered":"cancelled"}">${item.isAvailable?"On":"Off"}</span>
              <button class="btn btn-ghost btn-sm" onclick="openImageUploadModal('${item._id}','${item.name.replace(/'/g,"\'")}')">📷 Image</button>
              <button class="btn btn-ghost btn-sm" onclick="toggleItemAvailability('${item._id}',${item.isAvailable})">${item.isAvailable?"Disable":"Enable"}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteMenuItem('${item._id}')">Delete</button>
            </div>
          </div>`).join("");
      } catch (err) { toast("Failed to load menu items", "error"); }
    },
  },

  /* ── Rider: Dashboard ────────────────────────────────────── */
  "rider-dashboard": {
    async load() {
      try {
        const res = await Orders.getAll();
        const orders = res.data;
        document.getElementById("rider-stats").innerHTML = [
          { label: "Active Deliveries", value: orders.filter(o=>o.status==="in-transit").length, icon: "🏍️" },
          { label: "Completed", value: orders.filter(o=>o.status==="delivered").length, icon: "✅" },
        ].map(s=>`<div class="stat-card"><div class="stat-icon">${s.icon}</div><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`).join("");

        document.getElementById("rider-orders").innerHTML = !orders.length
          ? `<div class="empty-state"><div class="emoji">🏍️</div><h3>No deliveries assigned yet</h3></div>`
          : `<div class="table-wrapper"><table>
              <thead><tr><th>Order</th><th>Customer</th><th>Address</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>${orders.map(o=>`<tr>
                <td><strong>${o.orderNumber}</strong></td>
                <td>${o.customer?.name||"—"}${o.customer?.phone?`<div style="font-size:12px;color:var(--muted)">${o.customer.phone}</div>`:""}</td>
                <td style="font-size:13px">${o.deliveryAddress}</td>
                <td>₦${o.total.toLocaleString()}</td>
                <td><span class="badge badge-${o.status}">${o.status}</span></td>
                <td>${o.status==="in-transit"
                  ? `<button class="btn btn-primary btn-sm" onclick="markDelivered('${o._id}')">✅ Delivered</button>`
                  : "—"}</td>
              </tr>`).join("")}
              </tbody></table></div>`;
      } catch (err) { toast("Failed to load deliveries", "error"); }
    },
  },

  /* ── Super Admin: Dashboard ──────────────────────────────── */
  "admin-dashboard": {
    async load() {
      try {
        const [ordersRes, usersRes] = await Promise.all([Orders.getAll(), Users.getAll()]);
        const orders = ordersRes.data, users = usersRes.data;
        document.getElementById("admin-stats").innerHTML = [
          { label: "Total Users", value: users.length, icon: "👥" },
          { label: "Total Orders", value: orders.length, icon: "📋" },
          { label: "Active Orders", value: orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length, icon: "🔥" },
          { label: "Total Revenue", value: `₦${orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.total,0).toLocaleString()}`, icon: "💰" },
        ].map(s=>`<div class="stat-card"><div class="stat-icon">${s.icon}</div><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`).join("");

        document.getElementById("admin-recent-orders").innerHTML = renderOrderTable(
          orders.slice(0,15), { showStatusSelect: true }
        );
      } catch (err) { toast("Failed to load admin dashboard", "error"); }
    },
  },

  /* ── Super Admin: All Orders ─────────────────────────────── */
  "admin-orders": {
    async load() {
      try {
        const res = await Orders.getAll();
        document.getElementById("admin-orders-list").innerHTML = renderOrderTable(
          res.data, { showStatusSelect: true, showRiderAssign: true }
        );
      } catch (err) { toast("Failed to load orders", "error"); }
    },
  },

  /* ── Super Admin: Users ──────────────────────────────────── */
  "admin-users": {
    async load() {
      try {
        const res = await Users.getAll();
        document.getElementById("admin-users-list").innerHTML = `
          <div class="table-wrapper"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>${res.data.map(u=>`<tr>
              <td><strong>${u.name}</strong>${u.phone?`<div style="font-size:12px;color:var(--muted)">${u.phone}</div>`:""}</td>
              <td style="font-size:13px">${u.email}</td>
              <td><span class="badge badge-${u.role}">${u.role.replace("_"," ")}</span></td>
              <td><span class="badge badge-${u.isActive?"delivered":"cancelled"}">${u.isActive?"Active":"Inactive"}</span></td>
              <td style="font-size:13px">${new Date(u.createdAt).toLocaleDateString("en-NG")}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="toggleUserActive('${u._id}')">${u.isActive?"Deactivate":"Activate"}</button></td>
            </tr>`).join("")}
            </tbody></table></div>`;
      } catch (err) { toast("Failed to load users", "error"); }
    },
  },
};

/* ════════════════════════════════════════════════════════════
   AUTH HANDLERS
   ════════════════════════════════════════════════════════════ */
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".auth-form").forEach(f => f.classList.add("hidden"));
    document.getElementById(`${tab.dataset.tab}-form`)?.classList.remove("hidden");
  });
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Signing in…";
  try {
    const data = await Auth.login(
      document.getElementById("login-email").value,
      document.getElementById("login-password").value
    );
    App.user = data.user;
    App.showNavbar();
    App.navigateTo(App.defaultPageForRole(data.user.role));
    connectSocket();
    toast(`Welcome back, ${data.user.name}! 🎉`, "success");
    updateCartBadge();
  } catch (err) { toast(err.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Sign In"; }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Creating account…";
  try {
    const data = await Auth.register({
      name: document.getElementById("reg-name").value,
      email: document.getElementById("reg-email").value,
      password: document.getElementById("reg-password").value,
      role: document.getElementById("reg-role").value,
      phone: document.getElementById("reg-phone").value,
    });
    App.user = data.user;
    App.showNavbar();
    App.navigateTo(App.defaultPageForRole(data.user.role));
    connectSocket();
    toast(`Account created! Welcome, ${data.user.name}! 🎉`, "success");
    updateCartBadge();
  } catch (err) { toast(err.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Create Account"; }
});

function demoLogin(email) {
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = "demo123";
  document.querySelector(".auth-tab[data-tab='login']").click();
  document.getElementById("login-form").requestSubmit();
}

document.getElementById("logout-btn").addEventListener("click", () => {
  Cart.clear();
  disconnectSocket();
  Auth.logout();
});

/* ════════════════════════════════════════════════════════════
   CART
   ════════════════════════════════════════════════════════════ */
function updateCartBadge() {
  const count = Cart.count();
  const badge = document.getElementById("cart-badge");
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

function openCart() {
  document.getElementById("cart-overlay").classList.add("open");
  document.getElementById("cart-sidebar").classList.add("open");
  renderCart();
}

function closeCart() {
  document.getElementById("cart-overlay").classList.remove("open");
  document.getElementById("cart-sidebar").classList.remove("open");
}

document.getElementById("cart-overlay").addEventListener("click", closeCart);

function renderCart() {
  const items = Cart.get();
  const container = document.getElementById("cart-items");
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">🛒</div><h3>Your cart is empty</h3><p>Add items from the menu</p></div>`;
    document.getElementById("cart-footer").classList.add("hidden");
    return;
  }
  document.getElementById("cart-footer").classList.remove("hidden");
  container.innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="cart-item-emoji">${item.emoji||"🍽️"}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₦${(item.price*item.quantity).toLocaleString()}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="changeQty('${item.menuItem}',${item.quantity-1})">−</button>
        <span style="font-weight:700;min-width:20px;text-align:center">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQty('${item.menuItem}',${item.quantity+1})">+</button>
      </div>
    </div>`).join("");

  const subtotal = Cart.total();
  document.getElementById("cart-subtotal").textContent = `₦${subtotal.toLocaleString()}`;
  document.getElementById("cart-delivery").textContent = "₦500";
  document.getElementById("cart-total").textContent = `₦${(subtotal+500).toLocaleString()}`;
}

function changeQty(id, qty) {
  if (qty <= 0) Cart.remove(id); else Cart.updateQty(id, qty);
  renderCart(); updateCartBadge();
}

document.getElementById("checkout-btn").addEventListener("click", () => {
  closeCart(); openCheckoutModal();
});

/* ════════════════════════════════════════════════════════════
   CHECKOUT MODAL
   ════════════════════════════════════════════════════════════ */
function openCheckoutModal() {
  if (!Cart.count()) return toast("Your cart is empty", "error");
  const items = Cart.get();
  const subtotal = Cart.total();
  document.getElementById("checkout-items-summary").innerHTML =
    items.map(i=>`<div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0"><span>${i.emoji||"🍽️"} ${i.name} ×${i.quantity}</span><span>₦${(i.price*i.quantity).toLocaleString()}</span></div>`).join("");
  document.getElementById("checkout-total-display").textContent = `₦${(subtotal+500).toLocaleString()}`;
  document.getElementById("checkout-modal").classList.add("open");
}

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const data = await Orders.place({
      items: Cart.get(),
      deliveryAddress: document.getElementById("checkout-address").value,
      note: document.getElementById("checkout-note").value,
    });
    Cart.clear(); updateCartBadge();
    document.getElementById("checkout-modal").classList.remove("open");
    e.target.reset();
    toast(`Order ${data.data.orderNumber} placed! 🎉 You'll receive a confirmation email.`, "success");
    // Open tracker immediately
    setTimeout(() => openTracker(data.data._id), 800);
    Pages["my-orders"]?.load?.();
  } catch (err) { toast(err.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Place Order 🎉"; }
});

/* ════════════════════════════════════════════════════════════
   ACTION HANDLERS
   ════════════════════════════════════════════════════════════ */
function addToCart(id, name, price, emoji) {
  if (!Auth.isLoggedIn() || App.user?.role !== "customer") {
    return toast("Please log in as a customer to order", "error");
  }
  Cart.add({ menuItem: id, name, price, emoji });
  updateCartBadge();
  toast(`${emoji} ${name} added to cart!`, "success");
}

async function updateOrderStatus(orderId, status) {
  try {
    await Orders.updateStatus(orderId, status);
    toast(`Order updated to "${status}"`, "success");
  } catch (err) { toast(err.message, "error"); }
}

async function markDelivered(orderId) {
  try {
    await Orders.markDelivered(orderId);
    toast("Order marked as delivered! ✅", "success");
    Pages["rider-dashboard"].load();
  } catch (err) { toast(err.message, "error"); }
}

async function toggleItemAvailability(id, current) {
  try {
    await Menu.update(id, { isAvailable: !current });
    toast(`Item ${!current?"enabled":"disabled"}`, "success");
    Pages["manage-menu"].load();
  } catch (err) { toast(err.message, "error"); }
}

async function deleteMenuItem(id) {
  if (!confirm("Delete this menu item?")) return;
  try {
    await Menu.delete(id); toast("Item deleted", "success"); Pages["manage-menu"].load();
  } catch (err) { toast(err.message, "error"); }
}

async function toggleUserActive(id) {
  try {
    await Users.toggleActive(id); toast("User status updated", "success"); Pages["admin-users"].load();
  } catch (err) { toast(err.message, "error"); }
}

/* ── Assign Rider Modal ─────────────────────────────────── */
async function openAssignRiderModal(orderId, orderNumber) {
  try {
    const res = await Users.getRiders();
    if (!res.data.length) return toast("No available riders found", "error");
    const options = res.data.map(r=>`<option value="${r._id}">${r.name}${r.phone?" · "+r.phone:""}</option>`).join("");
    const riderSelect = `<select id="assign-rider-select" class="form-select" style="margin:12px 0">${options}</select>`;
    const modal = document.createElement("div");
    modal.className = "modal-overlay open";
    modal.innerHTML = `<div class="modal" style="max-width:380px">
      <div class="modal-header">
        <h3>Assign Rider</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <p style="font-size:14px;color:var(--muted)">Select a rider for order <strong>${orderNumber}</strong>:</p>
      ${riderSelect}
      <button class="btn btn-primary btn-full" onclick="assignRider('${orderId}',document.getElementById('assign-rider-select').value,this.closest('.modal-overlay'))">Assign Rider</button>
    </div>`;
    document.body.appendChild(modal);
  } catch (err) { toast(err.message, "error"); }
}

async function assignRider(orderId, riderId, modalEl) {
  try {
    await Orders.assignRider(orderId, riderId);
    toast("Rider assigned successfully! 🏍️", "success");
    modalEl.remove();
    Pages[App.currentPage]?.load?.();
  } catch (err) { toast(err.message, "error"); }
}

/* ── Add Menu Item Form (with image upload) ──────────────── */
document.getElementById("add-menu-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const formData = new FormData();
    formData.append("name",            document.getElementById("item-name").value);
    formData.append("description",     document.getElementById("item-desc").value);
    formData.append("price",           document.getElementById("item-price").value);
    formData.append("category",        document.getElementById("item-category").value);
    formData.append("emoji",           document.getElementById("item-emoji").value);
    formData.append("preparationTime", document.getElementById("item-time").value);
    const imgFile = document.getElementById("item-image").files[0];
    if (imgFile) formData.append("image", imgFile);

    await Menu.createWithImage(formData);
    toast("Menu item added! 🎉", "success");
    e.target.reset();
    document.getElementById("item-image-preview").style.display = "none";
    document.querySelector(".upload-hint").style.display = "block";
    Pages["manage-menu"].load();
  } catch (err) { toast(err.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Add Item"; }
});

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  App.init();
  updateCartBadge();
  // Wire up image upload drag & drop preview
  initImageUpload("item-image", "item-image-preview", "item-upload-area");
});

/* ════════════════════════════════════════════════════════════
   IMAGE UPLOAD MODAL — for existing menu items
   ════════════════════════════════════════════════════════════ */

function openImageUploadModal(itemId, itemName) {
  document.getElementById("img-modal-title").textContent = `Upload image for "${itemName}"`;
  document.getElementById("img-modal-item-id").value = itemId;
  document.getElementById("img-modal-preview").style.display = "none";
  document.getElementById("img-modal-preview").src = "";
  document.getElementById("img-modal-file").value = "";
  document.getElementById("img-modal-hint").style.display = "flex";
  document.getElementById("img-upload-modal").classList.add("open");
}

function closeImageModal() {
  document.getElementById("img-upload-modal").classList.remove("open");
}

document.getElementById("img-modal-file")?.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById("img-modal-preview");
    preview.src = e.target.result;
    preview.style.display = "block";
    document.getElementById("img-modal-hint").style.display = "none";
  };
  reader.readAsDataURL(file);
});

document.getElementById("img-modal-area")?.addEventListener("click", () => {
  document.getElementById("img-modal-file").click();
});

document.getElementById("img-modal-area")?.addEventListener("dragover", (e) => {
  e.preventDefault();
  document.getElementById("img-modal-area").classList.add("dragover");
});

document.getElementById("img-modal-area")?.addEventListener("dragleave", () => {
  document.getElementById("img-modal-area").classList.remove("dragover");
});

document.getElementById("img-modal-area")?.addEventListener("drop", (e) => {
  e.preventDefault();
  document.getElementById("img-modal-area").classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  document.getElementById("img-modal-file").files = dt.files;
  document.getElementById("img-modal-file").dispatchEvent(new Event("change"));
});

document.getElementById("img-modal-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const itemId = document.getElementById("img-modal-item-id").value;
  const fileInput = document.getElementById("img-modal-file");
  const btn = e.target.querySelector("button[type=submit]");

  if (!fileInput.files[0]) {
    toast("Please select an image first", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Uploading…";

  try {
    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    const data = await Menu.updateWithImage(itemId, formData);
    toast(`Image uploaded successfully! 🎉`, "success");
    closeImageModal();
    Pages["manage-menu"].load();
  } catch (err) {
    toast(`Upload failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Upload Image";
  }
});