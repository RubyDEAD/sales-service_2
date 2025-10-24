import express from "express";
import session from "express-session";
import fetch from "node-fetch";

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

// ✅ Fixed: no double "/api/inventory"
const INVENTORY_API = "http://localhost:5145/api/inventory";

// --- AUTH ---
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

// --- PRODUCTS ---
app.get("/products", async (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  try {
    // ✅ Fetch directly from your working ASP.NET API
    const inventoryRes = await fetch(INVENTORY_API);
    if (!inventoryRes.ok)
      throw new Error(`Inventory API returned ${inventoryRes.status}`);

    const inventoryProducts = await inventoryRes.json();

    // ✅ Use actual quantity and image (from C# inventory)
    const products = inventoryProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      quantity: p.quantity || p.qty || 0, // depending on your property name
      image: p.image || p.uri || "/images/default.jpg",
      status: p.status || "available",
    }));

    res.json(products);
  } catch (err) {
    console.error("Error fetching products from Inventory:", err.message);
    res.status(500).json({ error: "Failed to load products from inventory." });
  }
});


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
    const inventoryRes = await fetch(INVENTORY_API);
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


app.post("/checkout", async (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Unauthorized" });

  const cart = req.session.cart || [];
  if (cart.length === 0)
    return res.json({ success: false, message: "Cart is empty." });

  try {
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

app.listen(3001, () =>
  console.log("Sales Service running on http://localhost:3001")
);
