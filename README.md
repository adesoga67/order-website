# 🍽️ ChowNow – Food Ordering Platform

A full-stack food ordering web app with authentication and role-based access control.

**Stack:** HTML · CSS · Vanilla JavaScript · Node.js · Express · MongoDB

---

## 🗂️ Project Structure

```
chownow/
├── frontend/
│   ├── index.html          ← Single-page app shell (all pages)
│   ├── css/
│   │   └── style.css       ← All styles (warm food-forward design)
│   └── js/
│       ├── api.js          ← API client + Cart + Auth helpers
│       └── app.js          ← App logic, routing, page renderers
│
└── backend/
    ├── server.js           ← Express entry point
    ├── seed.js             ← Demo data seeder
    ├── .env.example        ← Copy to .env and fill in values
    ├── models/
    │   ├── User.js         ← User schema (bcrypt password hashing)
    │   ├── MenuItem.js     ← Menu item schema
    │   └── Order.js        ← Order schema (auto order number)
    ├── middleware/
    │   └── auth.js         ← JWT protect + authorize(roles) middleware
    └── routes/
        ├── auth.js         ← Register, Login, /me, update-profile
        ├── menu.js         ← CRUD menu items
        ├── orders.js       ← Place, view, update orders
        └── users.js        ← Admin user management
```

---

## 🚀 Setup & Running

### 1. Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

### 2. Backend Setup

```bash
cd backend
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env — set MONGO_URI and JWT_SECRET

# Seed demo data
node seed.js

# Start the server
npm run dev        # development (nodemon)
# or
npm start          # production
```

The API will run at: **http://localhost:5000**

### 3. Frontend Setup

The frontend is pure HTML/CSS/JS — no build step needed.

**Option A: VS Code Live Server** (recommended)
- Open `frontend/` in VS Code
- Right-click `index.html` → Open with Live Server

**Option B: Simple HTTP server**
```bash
cd frontend
npx serve .
# or
python3 -m http.server 3000
```

Open **http://localhost:3000** (or the port shown)

---

## 👥 Roles & Permissions

| Feature                        | Customer | Restaurant Admin | Rider | Super Admin |
|-------------------------------|----------|-----------------|-------|-------------|
| Browse menu                   | ✅       | ✅              | ✅    | ✅          |
| Add to cart & checkout        | ✅       | ❌              | ❌    | ❌          |
| View own orders               | ✅       | ❌              | ❌    | ❌          |
| View all orders               | ❌       | ✅              | ❌    | ✅          |
| Update order status           | ❌       | ✅              | ❌    | ✅          |
| Add/edit/delete menu items    | ❌       | ✅              | ❌    | ✅          |
| View assigned deliveries      | ❌       | ❌              | ✅    | ❌          |
| Mark order delivered          | ❌       | ❌              | ✅    | ❌          |
| Manage all users              | ❌       | ❌              | ❌    | ✅          |

---

## 🔐 API Endpoints

### Auth
| Method | Endpoint              | Access    |
|--------|-----------------------|-----------|
| POST   | /api/auth/register    | Public    |
| POST   | /api/auth/login       | Public    |
| GET    | /api/auth/me          | Any auth  |
| PUT    | /api/auth/update-profile | Any auth |

### Menu
| Method | Endpoint        | Access                      |
|--------|-----------------|-----------------------------|
| GET    | /api/menu       | Public                      |
| GET    | /api/menu/:id   | Public                      |
| POST   | /api/menu       | restaurant_admin, super_admin |
| PUT    | /api/menu/:id   | restaurant_admin, super_admin |
| DELETE | /api/menu/:id   | restaurant_admin, super_admin |

### Orders
| Method | Endpoint                    | Access                      |
|--------|-----------------------------|-----------------------------|
| POST   | /api/orders                 | customer                    |
| GET    | /api/orders                 | Any auth (filtered by role) |
| GET    | /api/orders/:id             | Any auth (ownership check)  |
| PATCH  | /api/orders/:id/status      | restaurant_admin, super_admin |
| PATCH  | /api/orders/:id/assign-rider| restaurant_admin, super_admin |
| PATCH  | /api/orders/:id/deliver     | rider                       |

### Users (Admin)
| Method | Endpoint                       | Access      |
|--------|--------------------------------|-------------|
| GET    | /api/users                     | super_admin |
| GET    | /api/users/riders              | restaurant_admin, super_admin |
| PATCH  | /api/users/:id/toggle-active   | super_admin |
| PATCH  | /api/users/:id/role            | super_admin |

---

## 🎭 Demo Accounts

| Role             | Email                  | Password |
|------------------|------------------------|----------|
| Customer         | customer@demo.com      | demo123  |
| Restaurant Admin | restaurant@demo.com    | demo123  |
| Delivery Rider   | rider@demo.com         | demo123  |
| Super Admin      | admin@demo.com         | demo123  |

---

## 🔧 Key Technical Decisions

- **JWT Authentication** — stateless, stored in `localStorage`
- **bcryptjs** — passwords hashed with salt rounds = 12
- **Role middleware** — `protect` (verify token) + `authorize(...roles)` (RBAC)
- **Cart** — managed entirely in `localStorage` on the frontend
- **Auto order numbers** — generated as `ORD-0001`, `ORD-0002`, etc.
- **No framework** — pure vanilla JS with a simple SPA routing pattern
