import express from "express";
import session from "express-session";
import pool from "./db.js";

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

// Initialize products table
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL
    );
  `);

  const res = await pool.query("SELECT COUNT(*) FROM products");
  if (res.rows[0].count === "0") {
    await pool.query(
      "INSERT INTO products (name, price) VALUES ($1,$2),($3,$4),($5,$6)",
      ["Pen", 5, "Notebook", 20, "Paper", 1]
    );
  }
}
initDB();

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
app.get("/products", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  const result = await pool.query("SELECT * FROM products");
  res.json(result.rows);
});

// --- Cart ---
app.post("/cart/add", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  const { id, qty } = req.body;
  if (!req.session.cart) req.session.cart = [];
  req.session.cart.push({ id, qty });
  res.json({ success: true, cart: req.session.cart });
});

app.get("/cart", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  const cart = req.session.cart || [];
  if (cart.length === 0) return res.json([]);

  const ids = cart.map(c => c.id);
  const result = await pool.query(
    `SELECT * FROM products WHERE id = ANY($1)`,
    [ids]
  );

  const detailedCart = cart.map(c => {
    const product = result.rows.find(p => p.id === c.id);
    return {
      id: c.id,
      name: product.name,
      price: Number(product.price),
      qty: c.qty,
      total: Number(product.price) * c.qty
    };
  });

  res.json(detailedCart);
});

app.post("/checkout", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  req.session.cart = [];
  res.json({ success: true, message: "Checkout successful!" });
});

// Run server
app.listen(3000, () =>
  console.log("Sales Service running on http://localhost:3000")
);
