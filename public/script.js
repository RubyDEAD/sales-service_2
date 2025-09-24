async function loadProducts() {
  const res = await fetch("/products");
  if (res.status === 401) { window.location.href = "login.html"; return; }
  const products = await res.json();
  const list = document.getElementById("productList");
  list.innerHTML = "";
  products.forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `${p.name} - ₱${p.price} <button onclick="addToCart(${p.id})">Add</button>`;
    list.appendChild(li);
  });
  loadCart();
}

async function addToCart(id) {
  await fetch("/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, qty: 1 })
  });
  loadCart();
}

async function loadCart() {
  const res = await fetch("/cart");
  if (res.status === 401) return;
  const cart = await res.json();
  const list = document.getElementById("cartList");
  list.innerHTML = "";

  let grandTotal = 0;
  cart.forEach(c => {
    const li = document.createElement("li");
    li.textContent = `${c.name} (₱${c.price}) x ${c.qty} = ₱${c.total}`;
    list.appendChild(li);
    grandTotal += c.total;
  });

  if (cart.length > 0) {
    const totalLi = document.createElement("li");
    totalLi.innerHTML = `<strong>Total: ₱${grandTotal.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}</strong>`;
    list.appendChild(totalLi);
  }
}


async function checkout() {
  const res = await fetch("/checkout", { method: "POST" });
  const data = await res.json();
  alert(data.message);
  loadCart();
}

async function logout() {
  await fetch("/logout", { method: "POST" });
  window.location.href = "login.html";
}

window.onload = loadProducts;
