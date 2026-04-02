const express = require("express");
const path = require("path");
const MenuItem = require("../models/MenuItem");
const { protect, authorize } = require("../middleware/auth");
const { upload, processAndSave, deleteImage } = require("../middleware/upload");

const router = express.Router();

// GET /api/menu  (public)
router.get("/", async (req, res) => {
  try {
    const { category, available } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (available !== undefined) filter.isAvailable = available === "true";

    const items = await MenuItem.find(filter).populate("createdBy", "name").sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching menu" });
  }
});

// GET /api/menu/:id  (public)
router.get("/:id", async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate("createdBy", "name");
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching item" });
  }
});

// POST /api/menu  (restaurant_admin, super_admin) — supports image upload
router.post(
  "/",
  protect,
  authorize("restaurant_admin", "super_admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, category, emoji, preparationTime } = req.body;
      let imageUrl = "";

      if (req.file) {
  imageUrl = req.file.path; // Cloudinary returns the URL in req.file.path
}

      const item = await MenuItem.create({
        name, description, price: Number(price), category, emoji,
        preparationTime: Number(preparationTime) || 20,
        image: imageUrl,
        createdBy: req.user._id,
      });
      res.status(201).json({ success: true, message: "Menu item created", data: item });
    } catch (error) {
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((e) => e.message);
        return res.status(400).json({ success: false, message: messages.join(", ") });
      }
      console.error(error);
      res.status(500).json({ success: false, message: "Error creating menu item" });
    }
  }
);

// PUT /api/menu/:id  — supports image replacement
router.put(
  "/:id",
  protect,
  authorize("restaurant_admin", "super_admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const item = await MenuItem.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

      const updates = { ...req.body };
      if (req.file) {
        // Delete old image before saving new one
        if (item.image) deleteImage(item.image);
        updates.image = await processAndSave(req.file.buffer, "menu");
      }

      const updated = await MenuItem.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
      res.json({ success: true, message: "Menu item updated", data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error updating item" });
    }
  }
);

// DELETE /api/menu/:id
router.delete("/:id", protect, authorize("restaurant_admin", "super_admin"), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    if (item.image) deleteImage(item.image);
    await item.deleteOne();
    res.json({ success: true, message: "Menu item deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting item" });
  }
});

module.exports = router;
