const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: { type: String, trim: true },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Rice Dishes", "Soups & Swallows", "Grills", "Snacks", "Fast Food", "Drinks", "Desserts"],
    },
    image: { type: String, default: "" },
    emoji: { type: String, default: "🍽️" },
    isAvailable: { type: Boolean, default: true },
    preparationTime: { type: Number, default: 20 }, // minutes
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);
