import React, { useMemo, useState } from "react";
import { ShoppingCart, Plus, Minus, Clock, Coffee, Utensils, Wine } from "lucide-react";

const TAX_RATE = 0.05;
const SERVICE_RATE = 0.07;
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbymoUO05UC3IXc-6gjX-1Jjds9PwZBEhFJeDONr4MYsK68slOqHQwaOJrG9v7IE5eY/exec";

const sections = [
  {
    id: "breakfast",
    title: "Breakfast Menu",
    icon: Coffee,
    items: [
      ["breakfast-sandwich", "Breakfast Sandwich", "Egg, cheese, and sausage on toasted brioche.", 11],
      ["classic-breakfast", "Classic Breakfast Combo", "Eggs, potatoes, and breakfast meat.", 15],
      ["pancakes", "Pancakes", "Three fluffy pancakes with maple syrup.", 12],
      ["yogurt-fruit", "Yogurt & Fruit Bowl", "Yogurt, seasonal fruit, and granola.", 9],
      ["pastry-box", "Pastry Box", "Assorted morning pastries.", 8],
      ["coffee-service", "Coffee Service", "Fresh brewed coffee with cream and sugar.", 6],
      ["juice", "Juice", "Orange, apple, or cranberry juice.", 4],
    ],
  },
  {
    id: "dinner",
    title: "Lunch & Dinner Menu",
    icon: Utensils,
    items: [
      ["burger-fries", "Burger & Fries", "Angus burger with crispy fries.", 16],
      ["flatbread", "Flatbread Pizza", "Flatbread with mozzarella and herbs.", 15],
      ["wings", "Wings", "Crispy wings with choice of sauce.", 14],
      ["pasta", "Pasta Bowl", "Pasta with house sauce and parmesan.", 16],
      ["chicken-sandwich", "Chicken Sandwich", "Crispy chicken sandwich with fries.", 15],
      ["caesar", "Caesar Salad", "Romaine, parmesan, croutons, and Caesar dressing.", 12],
      ["dessert", "Dessert", "Chef-selected dessert of the day.", 8],
    ],
  },
  {
    id: "beverages",
    title: "Beverage Menu",
    icon: Wine,
    items: [
      ["specialty-coffee", "Specialty Coffee", "Freshly prepared specialty coffee drink.", 6],
      ["cold-brew", "Cold Brew", "Smooth slow-steeped iced coffee.", 6],
      ["mocktail", "Signature Mocktail", "Fresh seasonal house mocktail.", 9],
      ["bottled-drink", "Bottled Drink", "Selection of bottled beverages.", 4],
      ["soft-drink", "Soft Drink", "Classic soft drink.", 4],
    ],
  },
];

function money(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function buildTimeWindows(selectedDate) {
  const windows = [];
  const now = new Date();
  const isToday = selectedDate === todayISO();
  const minimumTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  for (let hour = 6; hour < 23; hour++) {
    for (const minute of [0, 15, 30, 45]) {
      const start = new Date();
      start.setHours(hour, minute, 0, 0);
      const end = new Date(start.getTime() + 15 * 60 * 1000);

      if (isToday && start < minimumTime) continue;

      const format = (date) =>
        date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      windows.push(`${format(start)} – ${format(end)}`);
    }
  }

  return windows;
}

export default function App() {
  const [openSection, setOpenSection] = useState("breakfast");
  const [quantities, setQuantities] = useState({});
  const [orderType, setOrderType] = useState("same-day");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    guestName: "",
    roomNumber: "",
    phone: "",
    email: "",
    allergyNotes: "",
    specialRequests: "",
    deliveryDate: todayISO(),
    asapTiming: "ASAP",
    scheduledWindow: "",
    paymentType: "",
  });

  const allItems = useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map(([id, name, description, price]) => ({
          id,
          name,
          description,
          price,
        }))
      ),
    []
  );

  const timeWindows = useMemo(
    () => buildTimeWindows(form.deliveryDate),
    [form.deliveryDate]
  );

  const cartItems = allItems
    .map((item) => ({ ...item, quantity: quantities[item.id] || 0 }))
    .filter((item) => item.quantity > 0);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * TAX_RATE;
  const serviceCharge = subtotal * SERVICE_RATE;
  const total = subtotal + tax + serviceCharge;

  function updateQty(id, amount) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(10, (current[id] || 0) + amount)),
    }));
  }

  function updateForm(field, value) {
    setForm((current) => {
      const updated = { ...current, [field]: value };
      if (field === "deliveryDate") {
        const windows = buildTimeWindows(value);
        updated.scheduledWindow = windows[0] || "";
      }
      return updated;
    });
  }

  function validateOrder() {
    const next = {};

    if (!form.guestName.trim()) next.guestName = "Please enter guest name.";
    if (!form.roomNumber.trim()) next.roomNumber = "Please enter room number.";
    if (!form.phone.trim()) next.phone = "Please enter mobile phone number.";
    if (!form.paymentType) next.paymentType = "Please select payment type.";
    if (cartItems.length === 0) next.items = "Please select at least one menu item.";

    if (orderType === "same-day" && !form.asapTiming) {
      next.delivery = "Please select estimated delivery timing.";
    }

    if (orderType === "scheduled") {
      if (!form.deliveryDate) next.deliveryDate = "Please select delivery date.";
      if (!form.scheduledWindow) next.scheduledWindow = "Please select delivery window.";
      if (timeWindows.length === 0) {
        next.scheduledWindow = "No delivery windows are available for this date.";
      }
    }

    setErrors(next);

    setTimeout(() => {
      const first = document.querySelector("[data-error='true']");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    if (!validateOrder()) return;

    const payload = {
      guestName: form.guestName,
      roomNumber: form.roomNumber,
      phone: form.phone,
      email: form.email,
      paymentType: form.paymentType,
      orderType: orderType === "same-day" ? "ASAP / Same-Day Order" : "Future Scheduled Order",
      deliveryDate: orderType === "same-day" ? todayISO() : form.deliveryDate,
      deliveryTime: orderType === "same-day" ? form.asapTiming : form.scheduledWindow,
      items: cartItems.map((item) => `${item.quantity} x ${item.name} (${money(item.price * item.quantity)})`).join("; "),
      allergyNotes: form.allergyNotes,
      specialRequests: form.specialRequests,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      finalTotal: total.toFixed(2),
    };

    try {
      setIsSubmitting(true);
      await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      setSubmitted(true);
    } catch {
      setSubmitError("We could not submit your order. Please contact the Front Desk.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page center">
        <div className="card success">
          <h1>Order Received</h1>
          <p>
            Thank you. Your in-room dining order has been received. Our team will prepare your order according to the selected delivery timing.
          </p>
          <button onClick={() => setSubmitted(false)}>Place Another Test Order</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p>Four Points by Sheraton</p>
        <h1>In-Room Dining</h1>
        <span>Convenient dining delivered directly to your room.</span>
      </header>

      <form onSubmit={handleSubmit} className="layout">
        <main>
          <section className="card">
            <h2>Guest Information</h2>
            <div className="grid">
              <Field label="Guest Name *" error={errors.guestName}>
                <input value={form.guestName} onChange={(e) => updateForm("guestName", e.target.value)} />
              </Field>
              <Field label="Room Number *" error={errors.roomNumber}>
                <input value={form.roomNumber} onChange={(e) => updateForm("roomNumber", e.target.value)} />
              </Field>
              <Field label="Mobile Phone Number *" error={errors.phone}>
                <input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
              </Field>
              <Field label="Email Address">
                <input value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
              </Field>
            </div>
          </section>

          {sections.map((section) => {
            const Icon = section.icon;
            const open = openSection === section.id;

            return (
              <section className="card menu" key={section.id}>
                <button type="button" className="menu-header" onClick={() => setOpenSection(open ? "" : section.id)}>
                  <span><Icon size={20} /> {section.title}</span>
                  <strong>{open ? "Close" : "Open"}</strong>
                </button>

                {open && (
                  <div className="menu-items">
                    {section.items.map(([id, name, description, price]) => (
                      <div className="item" key={id}>
                        <div>
                          <h3>{name}</h3>
                          <p>{description}</p>
                          <strong>{money(price)}</strong>
                        </div>
                        <div className="qty">
                          <button type="button" onClick={() => updateQty(id, -1)}><Minus size={16} /></button>
                          <span>{quantities[id] || 0}</span>
                          <button type="button" onClick={() => updateQty(id, 1)}><Plus size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {errors.items && <div data-error="true" className="errorBox">{errors.items}</div>}

          <section className="card">
            <h2>Special Requests</h2>
            <textarea placeholder="Allergy Notes" value={form.allergyNotes} onChange={(e) => updateForm("allergyNotes", e.target.value)} />
            <textarea maxLength="250" placeholder="Special Requests" value={form.specialRequests} onChange={(e) => updateForm("specialRequests", e.target.value)} />
            <small>Please note: extensive menu modifications may not be available.</small>
          </section>
        </main>

        <aside>
          <section className="card sticky">
            <h2><Clock size={20} /> Delivery Timing</h2>

            <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              <option value="same-day">ASAP / Same-Day Order</option>
              <option value="scheduled">Future Scheduled Order</option>
            </select>

            {orderType === "same-day" ? (
              <select value={form.asapTiming} onChange={(e) => updateForm("asapTiming", e.target.value)}>
                {["ASAP", "30 Minutes", "1 Hour", "1.5 Hours", "2 Hours", "2.5 Hours", "3 Hours", "3.5 Hours", "4 Hours", "4.5 Hours", "5 Hours"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            ) : (
              <>
                <input type="date" min={todayISO()} value={form.deliveryDate} onChange={(e) => updateForm("deliveryDate", e.target.value)} />
                {errors.deliveryDate && <p data-error="true" className="error">{errors.deliveryDate}</p>}

                <select value={form.scheduledWindow} onChange={(e) => updateForm("scheduledWindow", e.target.value)}>
                  {timeWindows.length === 0 ? (
                    <option>No available windows today</option>
                  ) : (
                    timeWindows.map((window) => <option key={window}>{window}</option>)
                  )}
                </select>
                {errors.scheduledWindow && <p data-error="true" className="error">{errors.scheduledWindow}</p>}
              </>
            )}
          </section>

          <section className="card sticky">
            <h2><ShoppingCart size={20} /> Order Summary</h2>

            <Field label="Payment Type *" error={errors.paymentType}>
              <select value={form.paymentType} onChange={(e) => updateForm("paymentType", e.target.value)}>
                <option value="">Select payment type</option>
                <option value="Charge to Room">Charge to Room</option>
                <option value="Pay at Delivery">Pay at Delivery</option>
              </select>
            </Field>

            {cartItems.length === 0 ? (
              <p>No items selected yet.</p>
            ) : (
              cartItems.map((item) => (
                <div className="summary-line" key={item.id}>
                  <span>{item.quantity} × {item.name}</span>
                  <span>{money(item.price * item.quantity)}</span>
                </div>
              ))
            )}

            <hr />
            <div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="summary-line"><span>Tax 5%</span><span>{money(tax)}</span></div>
            <div className="summary-line"><span>Service Charge 7%</span><span>{money(serviceCharge)}</span></div>
            <div className="summary-line total"><span>Final Total</span><span>{money(total)}</span></div>

            {submitError && <div className="errorBox">{submitError}</div>}

            <button className="place" disabled={isSubmitting}>
              {isSubmitting ? "Submitting Order..." : "Place Order"}
            </button>
          </section>
        </aside>
      </form>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <p data-error="true" className="error">{error}</p>}
    </label>
  );
}
