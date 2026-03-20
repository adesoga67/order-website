const express = require("express");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/users  (super_admin only) ───────────────────────
router.get("/", protect, authorize("super_admin"), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// ── GET /api/users/riders  (restaurant_admin, super_admin) ───
router.get("/riders", protect, authorize("restaurant_admin", "super_admin"), async (req, res) => {
  try {
    const riders = await User.find({ role: "rider", isActive: true }).select("name phone isAvailable");
    res.json({ success: true, data: riders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching riders" });
  }
});

// ── PATCH /api/users/:id/toggle-active  (super_admin only) ───
router.patch("/:id/toggle-active", protect, authorize("super_admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"}`,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating user" });
  }
});

// ── PATCH /api/users/:id/role  (super_admin only) ────────────
router.patch("/:id/role", protect, authorize("super_admin"), async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["customer", "restaurant_admin", "rider", "super_admin"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, message: "User role updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating role" });
  }
});

module.exports = router;
