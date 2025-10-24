import express from "express";
import session from "express-session";
import fetch from "node-fetch"; // Make sure to install this: npm i node-fetch

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "sales-secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.static("public"));

// URL of your Inventory API (adjust if running on a different port)
const INVENTORY_API = "http://localhost:5145/api/inventory";

// --- Auth ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "user" && password === "pass123") {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// --- Products ---
// Instead of querying local DB, fetch from Inventory Service
app.get("/products", async (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const inventoryRes = await fetch(`${INVENTORY_API}`);
    if (!inventoryRes.ok) throw new Error("Failed to fetch inventory data");

    const products = await inventoryRes.json();
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    res.status(500).json({ error: "Failed to load products." });
  }
});

// --- Cart ---
app.post("/cart/add", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  const { id, qty } = req.body;
  if (!req.session.cart) req.session.cart = [];
  req.session.cart.push({ id, qty });
  res.json({ success: true, cart: req.session.cart });
});

app.get("/cart", async (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  const cart = req.session.cart || [];
  if (cart.length === 0) return res.json([]);

  try {
    // Fetch full product list from Inventory Service
    const inventoryRes = await fetch(`${INVENTORY_API}`);
    const products = await inventoryRes.json();

    const detailedCart = cart.map((c) => {
      const product = products.find((p) => p.id === c.id);
      return {
        id: c.id,
        name: product?.name || "Unknown",
        price: Number(product?.price || 0),
        qty: c.qty,
        total: Number(product?.price || 0) * c.qty,
      };
    });

    res.json(detailedCart);
  } catch (err) {
    console.error("Error loading cart:", err.message);
    res.status(500).json({ error: "Failed to load cart." });
  }
});

// --- Checkout ---
app.post("/checkout", async (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  const cart = req.session.cart || [];
  if (cart.length === 0)
    return res.json({ success: false, message: "Cart is empty." });

  try {
    // For each product, tell the Inventory API to reduce stock
    for (const item of cart) {
      await fetch(`${INVENTORY_API}/${item.id}/adjust-qty?delta=${-item.qty}`, {
        method: "PATCH",
      });
    }

    req.session.cart = [];
    res.json({ success: true, message: "Checkout successful! Inventory updated." });
  } catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: "Checkout failed. Try again later." });
  }
});

// --- Run server ---
app.listen(3001, () =>
  console.log("Sales Service running on http://localhost:3001")
);
