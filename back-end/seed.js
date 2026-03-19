require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const MenuItem = require("./models/MenuItem");

const DEMO_USERS = [
  { name: "Amaka Obi (Customer)", email: "customer@demo.com", password: "demo123", role: "customer", phone: "+234 801 000 0001" },
  { name: "Chef Bayo", email: "restaurant@demo.com", password: "demo123", role: "restaurant_admin", phone: "+234 801 000 0002" },
  { name: "Tunde Rider", email: "rider@demo.com", password: "demo123", role: "rider", phone: "+234 801 000 0003" },
  { name: "Super Admin", email: "admin@demo.com", password: "demo123", role: "super_admin", phone: "+234 801 000 0004" },
];

const MENU_ITEMS = [
  { name: "Jollof Rice & Chicken", description: "Smoky party-style jollof rice with grilled chicken", price: 2500, category: "Rice Dishes", emoji: "🍛", preparationTime: 25 },
  { name: "Pounded Yam & Egusi", description: "Smooth pounded yam with rich egusi soup & assorted meat", price: 3200, category: "Soups & Swallows", emoji: "🥣", preparationTime: 30 },
  { name: "Suya Platter", description: "Spiced beef suya skewers with onions & tomatoes", price: 2800, category: "Grills", emoji: "🍢", preparationTime: 20 },
  { name: "Catfish Pepper Soup", description: "Spicy catfish pepper soup with fresh herbs", price: 1800, category: "Soups & Swallows", emoji: "🍲", preparationTime: 15 },
  { name: "Moi Moi Special", description: "Steamed bean pudding with eggs & fish", price: 1200, category: "Snacks", emoji: "🫕", preparationTime: 10 },
  { name: "Fried Plantain & Rice", description: "Golden fried plantains served with white rice & stew", price: 2200, category: "Rice Dishes", emoji: "🍌", preparationTime: 20 },
  { name: "Beef Burger Deluxe", description: "Juicy beef patty with caramelized onions & house sauce", price: 3500, category: "Fast Food", emoji: "🍔", preparationTime: 15 },
  { name: "Chin Chin Pack", description: "Crunchy homemade chin chin, lightly sweetened", price: 800, category: "Snacks", emoji: "🥨", preparationTime: 5 },
  { name: "Ofada Rice & Stew", description: "Local ofada rice with spicy ofada sauce & assorted meat", price: 2900, category: "Rice Dishes", emoji: "🍚", preparationTime: 25 },
  { name: "Chapman Drink", description: "Classic Nigerian Chapman cocktail mocktail", price: 600, category: "Drinks", emoji: "🍹", preparationTime: 5 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await MenuItem.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create demo users
    const createdUsers = await User.create(DEMO_USERS);
    console.log(`👥 Created ${createdUsers.length} demo users`);

    // Find restaurant admin to assign as creator
    const restaurantAdmin = createdUsers.find(u => u.role === "restaurant_admin");

    // Create menu items
    const menuWithCreator = MENU_ITEMS.map(item => ({ ...item, createdBy: restaurantAdmin._id, rating: (4.4 + Math.random() * 0.5).toFixed(1) }));
    const createdMenu = await MenuItem.create(menuWithCreator);
    console.log(`🍽️  Created ${createdMenu.length} menu items`);

    console.log("\n🎉 Seeding complete! Demo accounts:");
    console.log("  customer@demo.com    | Password: demo123");
    console.log("  restaurant@demo.com  | Password: demo123");
    console.log("  rider@demo.com       | Password: demo123");
    console.log("  admin@demo.com       | Password: demo123");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
}

seed();
