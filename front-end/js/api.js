const API_URL = "http://localhost:5000/api";

// ── Token helpers ────────────────────────────────────────────
const getToken = () => localStorage.getItem("chownow_token");
const setToken = (token) => localStorage.setItem("chownow_token", token);
const removeToken = () => localStorage.removeItem("chownow_token");

const getUser = () => {
  const u = localStorage.getItem("chownow_user");
  return u ? JSON.parse(u) : null;
};
const setUser = (user) => localStorage.setItem("chownow_user", JSON.stringify(user));
const removeUser = () => localStorage.removeItem("chownow_user");

// ── Base fetch wrapper ────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ── Auth API ─────────────────────────────────────────────────
const Auth = {
  async register(payload) {
    const data = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) });
    setToken(data.token);
    setUser(data.user);
    return data;
  },
  async login(email, password) {
    const data = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.token);
    setUser(data.user);
    return data;
  },
  logout() {
    removeToken();
    removeUser();
    window.location.reload();
  },
  getUser,
  isLoggedIn: () => !!getToken(),
};

// ── Menu API ─────────────────────────────────────────────────
const Menu = {
  getAll: (params = "") => apiFetch(`/menu${params}`),
  getOne: (id) => apiFetch(`/menu/${id}`),
  create: (payload) => apiFetch("/menu", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/menu/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/menu/${id}`, { method: "DELETE" }),
};

// ── Orders API ───────────────────────────────────────────────
const Orders = {
  getAll: () => apiFetch("/orders"),
  getOne: (id) => apiFetch(`/orders/${id}`),
  place: (payload) => apiFetch("/orders", { method: "POST", body: JSON.stringify(payload) }),
  updateStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  assignRider: (id, riderId) => apiFetch(`/orders/${id}/assign-rider`, { method: "PATCH", body: JSON.stringify({ riderId }) }),
  markDelivered: (id) => apiFetch(`/orders/${id}/deliver`, { method: "PATCH" }),
};

// ── Users API ─────────────────────────────────────────────────
const Users = {
  getAll: (role = "") => apiFetch(`/users${role ? `?role=${role}` : ""}`),
  getRiders: () => apiFetch("/users/riders"),
  toggleActive: (id) => apiFetch(`/users/${id}/toggle-active`, { method: "PATCH" }),
  updateRole: (id, role) => apiFetch(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
};

// ── Cart helpers (localStorage) ──────────────────────────────
const Cart = {
  get: () => JSON.parse(localStorage.getItem("chownow_cart") || "[]"),
  save: (items) => localStorage.setItem("chownow_cart", JSON.stringify(items)),
  add(item) {
    const cart = Cart.get();
    const existing = cart.find((c) => c.menuItem === item.menuItem);
    if (existing) existing.quantity += 1;
    else cart.push({ ...item, quantity: 1 });
    Cart.save(cart);
  },
  remove(menuItemId) {
    Cart.save(Cart.get().filter((c) => c.menuItem !== menuItemId));
  },
  updateQty(menuItemId, qty) {
    const cart = Cart.get();
    const item = cart.find((c) => c.menuItem === menuItemId);
    if (item) { item.quantity = qty; if (qty <= 0) return Cart.remove(menuItemId); }
    Cart.save(cart);
  },
  clear: () => localStorage.removeItem("chownow_cart"),
  total: () => Cart.get().reduce((s, i) => s + i.price * i.quantity, 0),
  count: () => Cart.get().reduce((s, i) => s + i.quantity, 0),
};