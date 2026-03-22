# ChowNow — Nigerian Kitchen, Delivered Fresh

A full-stack food ordering web platform built for the Nigerian market. ChowNow connects customers with restaurants and delivery riders through a real-time, role-based ordering system — from menu browsing and secure payment to live order tracking and doorstep delivery.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Demo Accounts](#demo-accounts)
- [Screenshots](#screenshots)
- [Author](#author)

---

## Overview

ChowNow was built to digitise the food ordering and delivery experience for local Nigerian restaurants. The platform eliminates the need for phone-based ordering by providing a structured digital system where customers, restaurant staff, riders and administrators each have their own tailored experience.

The platform supports the full order lifecycle:

1. Customer browses the menu and adds items to cart
2. Order is placed and payment is processed via Paystack
3. Restaurant admin confirms and prepares the order
4. A rider is assigned and dispatched
5. Customer tracks the delivery in real time
6. Confirmation emails are sent at every major step

---

## Features

### Customer
- Browse and filter a rich Nigerian food menu
- Add to cart, adjust quantities, and checkout
- Pay securely via Paystack (card, bank transfer)
- Real-time order tracking with animated step progress
- Email notifications at every order milestone
- View full order history

### Restaurant Admin
- Live dashboard with order stats and revenue summary
- Manage menu items — add, edit, disable, delete, upload images
- Update order statuses (confirmed, preparing, ready, dispatched)
- Assign available riders to orders
- Real-time new order notifications via WebSocket

### Delivery Rider
- View assigned deliveries with customer contact and address
- Mark orders as delivered
- Live updates when new deliveries are assigned

### Super Admin
- Platform-wide order management and status control
- Full user management — view, activate, deactivate all accounts
- Revenue and order analytics dashboard
- All restaurant admin capabilities

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose ODM |
| Authentication | JSON Web Tokens (JWT) + bcryptjs |
| Real-time | Socket.io (WebSocket) |
| Payments | Paystack |
| Email | Nodemailer (SMTP) |
| Image Processing | Multer + Sharp |
| Database Hosting | MongoDB Atlas |

---

## Project Structure

```
order-website/
├── front-end/
│   ├── landing.html          Landing page (separate from app)
│   ├── index.html            SPA shell — all app pages and modals
│   ├── assets/
│   │   ├── logo.svg          Full emblem logo
│   │   ├── logo-navbar.svg   Horizontal navbar logo
│   │   └── favicon.svg       Browser tab icon
│   ├── css/
│   │   └── style.css         All styles
│   └── js/
│       ├── api.js            API client, Auth, Cart helpers
│       ├── app.js            SPA router, page renderers, event handlers
│       └── realtime.js       Socket.io client, Paystack popup, image upload
│
└── back-end/
    ├── server.js             Express + Socket.io entry point
    ├── seed.js               Demo data seeder
    ├── .env.example          Environment variable template
    ├── package.json
    ├── models/
    │   ├── User.js           User schema with bcrypt hashing
    │   ├── MenuItem.js       Menu item schema
    │   └── Order.js          Order schema with auto order numbers
    ├── middleware/
    │   ├── auth.js           JWT protect + RBAC authorize middleware
    │   └── upload.js         Multer + Sharp image processing
    ├── routes/
    │   ├── auth.js           Register, login, profile
    │   ├── menu.js           Menu CRUD with image upload
    │   ├── orders.js         Orders + Paystack payment routes
    │   └── users.js          Admin user management
    └── services/
        ├── emailService.js   Nodemailer HTML email templates
        ├── paystackService.js Paystack transaction management
        └── socketService.js  WebSocket room and event management
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- MongoDB Atlas account (free tier) or local MongoDB
- Paystack account (free, test keys available instantly)
- Gmail account with App Password enabled (for email notifications)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/chownow.git
cd chownow
```

### 2. Backend setup

```bash
cd back-end
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Seed the database with demo users and menu items:

```bash
node seed.js
```

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### 3. Frontend setup

No build step required. Open `front-end/` in VS Code and right-click `landing.html` or `index.html`, then select **Open with Live Server**.

Alternatively, serve it from the terminal:

```bash
cd front-end
npx serve .
```

The app will open at `http://localhost:3000` (or whichever port is shown).

> Both terminals must be running simultaneously — one for the backend server, one for the frontend.

---

## Environment Variables

Create a `.env` file inside `back-end/` based on `.env.example`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/chownow

# Authentication
JWT_SECRET=your_long_random_secret_string
JWT_EXPIRES_IN=7d

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx

# Email (Gmail with App Password)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_16_char_app_password
MAIL_FROM="ChowNow <no-reply@chownow.com>"

# File uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
```

> The app runs without Paystack and email configured — those features gracefully skip when keys are absent.

---

## API Reference

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Login and receive JWT |
| GET | `/api/auth/me` | Authenticated | Get current user profile |
| PUT | `/api/auth/update-profile` | Authenticated | Update name, phone, address |

### Menu

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/menu` | Public | List all menu items |
| GET | `/api/menu/:id` | Public | Get a single item |
| POST | `/api/menu` | Restaurant Admin, Super Admin | Create a menu item (supports image upload) |
| PUT | `/api/menu/:id` | Restaurant Admin, Super Admin | Update a menu item |
| DELETE | `/api/menu/:id` | Restaurant Admin, Super Admin | Delete a menu item |

### Orders

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/orders` | Customer | Place a new order |
| GET | `/api/orders` | Authenticated (role-filtered) | List orders |
| GET | `/api/orders/:id` | Authenticated | Get order details |
| PATCH | `/api/orders/:id/status` | Restaurant Admin, Super Admin | Update order status |
| PATCH | `/api/orders/:id/assign-rider` | Restaurant Admin, Super Admin | Assign rider |
| PATCH | `/api/orders/:id/deliver` | Rider | Mark as delivered |
| POST | `/api/orders/:id/pay` | Customer | Initialize Paystack payment |
| GET | `/api/orders/:id/verify-payment` | Customer | Verify payment after redirect |

### Users

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | Super Admin | List all users |
| GET | `/api/users/riders` | Restaurant Admin, Super Admin | List available riders |
| PATCH | `/api/users/:id/toggle-active` | Super Admin | Activate or deactivate account |
| PATCH | `/api/users/:id/role` | Super Admin | Change user role |

---

## Roles & Permissions

| Feature | Customer | Restaurant Admin | Rider | Super Admin |
|---|---|---|---|---|
| Browse menu | Yes | Yes | Yes | Yes |
| Add to cart and place orders | Yes | No | No | No |
| Pay via Paystack | Yes | No | No | No |
| Track own orders | Yes | No | No | No |
| View all orders | No | Yes | No | Yes |
| Update order status | No | Yes | No | Yes |
| Assign riders | No | Yes | No | Yes |
| Add and manage menu items | No | Yes | No | Yes |
| Upload menu item images | No | Yes | No | Yes |
| View assigned deliveries | No | No | Yes | No |
| Mark orders as delivered | No | No | Yes | No |
| Manage all users | No | No | No | Yes |

---

## Demo Accounts

Run `node seed.js` once to create these accounts:

| Role | Email | Password |
|---|---|---|
| Customer | customer@demo.com | demo123 |
| Restaurant Admin | restaurant@demo.com | demo123 |
| Delivery Rider | rider@demo.com | demo123 |
| Super Admin | admin@demo.com | demo123 |

> Running `seed.js` again will wipe all existing data and recreate from scratch.

---

## Key Technical Decisions

**JWT over sessions** — stateless authentication means the backend does not need to store session data. Tokens are stored in `localStorage` on the client and sent as Bearer tokens on every protected request.

**Role middleware pattern** — every protected route uses two middleware layers: `protect` (verifies the token and attaches the user) and `authorize(...roles)` (checks the user's role against the allowed list). This makes RBAC enforcement clean and reusable.

**Socket.io rooms** — each user joins a role-specific room on login (`customer:{id}`, `rider:{id}`, `restaurant`). Status updates are emitted only to relevant rooms, avoiding broadcasting to all connected clients.

**Sharp for image processing** — all uploaded images are resized to 600×600px and converted to WebP at 82% quality before saving. This standardises image dimensions and significantly reduces file sizes.

**Graceful service degradation** — email and payment services use try/catch with console logging rather than throwing errors. A failed email or Paystack timeout never crashes the main order flow.

**SPA without a framework** — the frontend uses a simple page-switching pattern with `display: none / block` toggling and a `Pages` object where each page has a `load()` method. No React, Vue or build tools required.

---

## Author

**Adesoga Victor Michael**
Final Year Student — Computer Science

Built as a final year project demonstrating full-stack web development with real-time features, payment integration, and role-based access control.

---

*ChowNow — Order. Track. Enjoy.*