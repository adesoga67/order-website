const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// ── POST /api/auth/register ──────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Prevent self-registration as super_admin
    const allowedRoles = ["customer", "restaurant_admin", "rider"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role. Allowed: customer, restaurant_admin, rider" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    const user = await User.create({ name, email, password, role: role || "customer", phone, address });
    const token = signToken(user._id);

    res.status(201).json({ success: true, message: "Registration successful", token, user });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated." });
    }

    const token = signToken(user._id);
    // Remove password from output
    user.password = undefined;

    res.json({ success: true, message: "Login successful", token, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PUT /api/auth/update-profile ─────────────────────────────
router.put("/update-profile", protect, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, address }, { new: true, runValidators: true });
    res.json({ success: true, message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating profile" });
  }
});

module.exports = router;
