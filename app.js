// Only 3 roles have PINs — Admin is handled separately via admin.html
const PINS = {
  "Service Executive": "1111",
  "Repair Executive": "2222"
  
};

let pendingRole = null;

// ---- PIN ----
function askPin(role) {
  pendingRole = role;
  document.getElementById("pin-title").textContent = role + " — PIN";
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-error").style.display = "none";
  openModal("pin-modal");
  setTimeout(() => document.getElementById("pin-input").focus(), 100);
}

function confirmPin() {
  const entered = document.getElementById("pin-input").value.trim();
  if (entered === PINS[pendingRole]) {
    closeModal("pin-modal");
    login(pendingRole);
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
}


let allData = [];
let currentUser = null;
let currentFilter = "All";
let searchQuery = "";
let pendingUpdate = null;

// ---- LOGIN ----
function login(role) {
  currentUser = role;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
  document.getElementById("user-label").textContent = role;

  const wrap = document.getElementById("new-btn-wrap");
  if (role === "Service Executive" || role === "Admin") {
    wrap.innerHTML = `<button class="btn-primary" onclick="openNewModal()">+ New Complaint</button>`;
  } else {
    wrap.innerHTML = "";
  }

  loadData();
  loadStats();
}

function logout() {
  currentUser = null;
  allData = [];
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}

// ---- DATA ----
async function loadData() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("main-table").style.display = "none";
  document.getElementById("empty-state").style.display = "none";
  try {
    const res = await fetch(`${API_URL}?action=getAll`);
    const json = await res.json();
    allData = json.data || [];
    renderTable();
  } catch (e) {
    showToast("Error loading data", "error");
  } finally {
    document.getElementById("loading").style.display = "none";
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API_URL}?action=getStats`);
    const json = await res.json();
    const s = json.stats;
    document.getElementById("s-total").textContent = s.total;
    document.getElementById("s-open").textContent = s.open;
    document.getElementById("s-dispatched").textContent = s.dispatched;
    document.getElementById("s-pickup").textContent = s.pickupArranged;
    document.getElementById("s-confirmed").textContent = s.received;
    document.getElementById("s-closed").textContent = s.closed;
  } catch (e) {}
}

// ---- RENDER TABLE ----
function renderTable() {
  let data = allData;

  // Status filter
  if (currentFilter !== "All") {
    if (currentFilter === "Open") data = data.filter(r => r["Status"] === "Open");
    if (currentFilter === "Dispatched") data = data.filter(r => ["Dispatched by Repair", "Dispatched by Production", "Forwarded to Production"].includes(r["Status"]));
    if (currentFilter === "Pickup") data = data.filter(r => ["Pickup Arranged", "Received"].includes(r["Status"]));
    if (currentFilter === "Closed") data = data.filter(r => r["Status"] === "Closed");
  }

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(r =>
      (r["Customer Name"] || "").toLowerCase().includes(q) ||
      (r["Serial No"] || "").toLowerCase().includes(q) ||
      (r["Battery Model"] || "").toLowerCase().includes(q) ||
      (r["ID"] || "").toLowerCase().includes(q) ||
      (r["Phone"] || "").toLowerCase().includes(q)
    );
  }

  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  if (!data.length) {
    document.getElementById("empty-state").style.display = "block";
    document.getElementById("main-table").style.display = "none";
    return;
  }

  document.getElementById("empty-state").style.display = "none";
  document.getElementById("main-table").style.display = "table";

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="cid">${row["ID"] || ""}</span></td>
      <td>${fmtDate(row["Date"])}</td>
      <td>
        <div class="cname">${row["Customer Name"] || "—"}</div>
        <div class="cphone">${row["Phone"] || ""} ${row["City"] ? "· " + row["City"] : ""}</div>
      </td>
      <td>
        <div class="bmodel">${row["Battery Model"] || "—"}</div>
        <div class="bserial">${row["Battery Category"] || ""} ${row["Serial No"] ? "· " + row["Serial No"] : ""}</div>
      </td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row["Complaint"] || "—"}</td>
      <td>${getStatusBadge(row["Status"])}</td>
      <td>${getActions(row)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function getStatusBadge(s) {
  const map = {
    "Open": "b-open",
    "Dispatched by Repair": "b-repair",
    "Forwarded to Production": "b-forwarded",
    "Dispatched by Production": "b-production",
    "Pickup Arranged": "b-pickup",
    "Received": "b-confirmed",
    "Under Repair": "b-underrepair",
    "Sent to Production": "b-senttoprod",
    "Received from Repair": "b-recfromrepair",
    "Closed": "b-closed"
  };
  return `<span class="badge ${map[s] || "b-open"}">${s || "Open"}</span>`;
}

function getActions(row) {
  const s = row["Status"];
  const id = row["ID"];
  const rowNo = row["_row"];
  const dispBy = row["Dispatched By"] || "";
  let btns = `<button class="action-btn ab-view" onclick='openDetail("${id}")'>View</button>`;

  // SERVICE EXECUTIVE
  if (currentUser === "Service Executive" || currentUser === "Admin") {
    if (s === "Dispatched by Repair" || s === "Dispatched by Production") {
      btns += ` <button class="action-btn ab-arrange" onclick='openUpdate(${rowNo},"Pickup Arranged")'>Arrange Pickup</button>`;
    }
    if (s === "Pickup Arranged") {
      btns += ` <button class="action-btn ab-confirm" onclick='openUpdate(${rowNo},"Received")'>Mark Received</button>`;
    }
  }

  // REPAIR EXECUTIVE
  if (currentUser === "Repair Executive" || currentUser === "Admin") {
    if (s === "Open") {
      btns += ` <button class="action-btn ab-dispatch" onclick='openUpdate(${rowNo},"Dispatched by Repair")'>Dispatch</button>`;
      btns += ` <button class="action-btn ab-forward" onclick='openUpdate(${rowNo},"Forwarded to Production")'>Stock Nahi →</button>`;
    }
    if (s === "Received") {
      btns += ` <button class="action-btn ab-repair" onclick='openUpdate(${rowNo},"Under Repair")'>Start Repair</button>`;
    }
    if (s === "Under Repair") {
      if (dispBy === "Repair Executive") {
        btns += ` <button class="action-btn ab-received" onclick='openUpdate(${rowNo},"Closed")'>Repair Done → Close</button>`;
      } else {
        btns += ` <button class="action-btn ab-sendprod" onclick='openUpdate(${rowNo},"Sent to Production")'>Repair Done → Production</button>`;
      }
    }
  }

  // PRODUCTION EXECUTIVE
  if (currentUser === "Production Executive" || currentUser === "Admin") {
    if (s === "Forwarded to Production") {
      btns += ` <button class="action-btn ab-prodispatch" onclick='openUpdate(${rowNo},"Dispatched by Production")'>Dispatch</button>`;
    }
    if (s === "Sent to Production") {
      btns += ` <button class="action-btn ab-received" onclick='openUpdate(${rowNo},"Closed")'>Mark Closed</button>`;
    }
  }

  return btns;
}

// ---- FILTERS ----
function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.textContent.trim() === f));
  renderTable();
}

function onSearch(v) {
  searchQuery = v;
  renderTable();
}

// ---- NEW COMPLAINT ----
function openNewModal() {
  ["f-name", "f-phone", "f-city", "f-model", "f-serial", "f-complaint", "f-remarks", "f-charger-model", "f-charger-serial", "f-address"].forEach(i => {
    document.getElementById(i).value = "";
  });
  document.getElementById("f-cat").value = "";
  document.getElementById("f-charger-chk").checked = false;
  document.getElementById("charger-fields").style.display = "none";
  openModal("new-modal");
}

function toggleCharger() {
  const on = document.getElementById("f-charger-chk").checked;
  document.getElementById("charger-fields").style.display = on ? "flex" : "none";
}

async function submitNew() {
  const name = document.getElementById("f-name").value.trim();
  const phone = document.getElementById("f-phone").value.trim();
  const cat = document.getElementById("f-cat").value;
  const model = document.getElementById("f-model").value.trim();
  const complaint = document.getElementById("f-complaint").value.trim();

  if (!name || !phone || !cat || !model || !complaint) {
    showToast("Saare required fields bharo", "error");
    return;
  }

  const btn = document.getElementById("submit-btn");
  btn.textContent = "Submitting...";
  btn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addEntry",
        customerName: name,
        customerPhone: phone,
        city: document.getElementById("f-city").value.trim(),
        batteryCategory: cat,
        batteryModel: model,
        serialNo: document.getElementById("f-serial").value.trim(),
        chargerReplace: document.getElementById("f-charger-chk").checked ? "Yes" : "No",
        chargerModel: document.getElementById("f-charger-model").value.trim(),
        chargerSerial: document.getElementById("f-charger-serial").value.trim(),
        complaint,
        address: document.getElementById("f-address").value.trim(),
        remarks: document.getElementById("f-remarks").value.trim()
      })
    });
    const json = await res.json();
    if (json.success) {
      closeModal("new-modal");
      showToast(`${json.id} complaint log ho gayi`, "success");
      await loadData();
      await loadStats();
    } else {
      showToast("Error saving", "error");
    }
  } catch (e) {
    showToast("Network error", "error");
  } finally {
    btn.textContent = "Save Complaint";
    btn.disabled = false;
  }
}

// ---- UPDATE STATUS ----
function openUpdate(rowNo, newStatus) {
  const row = allData.find(r => Number(r["_row"]) === Number(rowNo));
  if (!row) { showToast("Row nahi mili, page refresh karo", "error"); return; }
  const id = row["ID"];
  pendingUpdate = { id, newStatus, row: row["_row"] };

  const titles = {
    "Dispatched by Repair": "Mark Dispatched (Repair)",
    "Forwarded to Production": "Forward to Production",
    "Dispatched by Production": "Mark Dispatched (Production)",
    "Pickup Arranged": "Arrange Pickup",
    "Received": "Mark Battery Received",
    "Under Repair": "Start Repair",
    "Sent to Production": "Send to Production",
    "Received from Repair": "Send to Repair Executive",
    "Closed": "Mark Closed"
  };

  document.getElementById("u-title").textContent = titles[newStatus] || "Update";
  document.getElementById("u-info").innerHTML = `
    <strong>${row["ID"]}</strong> — ${row["Customer Name"] || ""}<br>
    Battery: <strong>${row["Battery Model"] || ""}</strong> ${row["Serial No"] ? "(" + row["Serial No"] + ")" : ""}<br>
    Current Status: ${getStatusBadge(row["Status"])}
  `;

  let fields = "";

  if (newStatus === "Forwarded to Production") {
    fields = `<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Yeh complaint Production Executive ko forward ho jaegi.</p>`;
  }

  if (newStatus === "Pickup Arranged") {
    fields = `
      <div class="form-group" style="margin-bottom:12px">
        <label>Pickup Mode *</label>
        <select id="u-mode">
          <option value="">Select</option>
          <option>Courier</option>
          <option>Transport</option>
          <option>Self Pickup</option>
          <option>Service Engineer</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Expected Date</label>
        <input type="date" id="u-expdate"/>
      </div>
    `;
  }

    if (newStatus === "Dispatched by Repair" || newStatus === "Dispatched by Production") {
    fields = challanFields(row);
  }

  if (newStatus === "Under Repair" || newStatus === "Sent to Production" || newStatus === "Received from Repair" || newStatus === "Closed") {
    fields = `<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Confirm karo yeh step complete ho gaya hai.</p>`;
  }

  fields += `
    <div class="form-group">
      <label>Remarks (optional)</label>
      <input id="u-remarks" placeholder="Koi note..."/>
    </div>
  `;

  document.getElementById("u-fields").innerHTML = fields;

  const confirmBtn = document.getElementById("u-confirm");
  confirmBtn.textContent = "Confirm";
  confirmBtn.disabled = false;
  confirmBtn.onclick = confirmUpdate;
  openModal("update-modal");
}

async function confirmUpdate() {
  if (!pendingUpdate) return;

  const payload = {
    action: "updateStatus",
    id: pendingUpdate.id,
    row: pendingUpdate.row,
    newStatus: pendingUpdate.newStatus
  };

  if (pendingUpdate.newStatus === "Dispatched by Repair") payload.dispatchedBy = "Repair Executive";
  if (pendingUpdate.newStatus === "Dispatched by Production") payload.dispatchedBy = "Production Executive";

  if (pendingUpdate.newStatus === "Pickup Arranged") {
    const mode = document.getElementById("u-mode")?.value;
    if (!mode) { showToast("Pickup mode select karo", "error"); return; }
    payload.pickupMode = mode;
    payload.expectedDate = document.getElementById("u-expdate")?.value || "";
  }

    const isDispatch = pendingUpdate.newStatus === "Dispatched by Repair" || pendingUpdate.newStatus === "Dispatched by Production";
  if (isDispatch && document.getElementById("c-make")?.checked) {
    const c = collectChallan();
    if (!c) return;
    payload.challan = c;
    payload.address = c.address;
  }

  payload.remarks = document.getElementById("u-remarks")?.value || "";

  const confirmBtn = document.getElementById("u-confirm");
  confirmBtn.textContent = "Updating...";
  confirmBtn.disabled = true;

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      closeModal("update-modal");
      showToast("Status update ho gaya!", "success");
      if (json.challan) printHtml(buildChallanPrint(json.challan));
      await loadData();
      await loadStats();
    } else {
      showToast("Error updating", "error");
    }
  } catch (e) {
    showToast("Network error", "error");
  } finally {
    confirmBtn.textContent = "Confirm";
    confirmBtn.disabled = false;
  }
}

// ---- DATE FORMAT ----
function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return val;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const FIXED_KEYS = [
  "ID", "Date", "Status", "Customer Name", "Phone", "City",
  "Battery Category", "Battery Model", "Serial No",
  "Charger Replace", "Charger Model", "Charger Serial", "Complaint",
  "Dispatched By", "Dispatch Date", "Pickup Mode",
  "Expected Pickup Date", "Pickup Confirmed Date", "Received Location", "Remarks", "Address", "Challan No", "_row"
];

// ---- DETAIL VIEW ----
function openDetail(id) {
  const row = allData.find(r => r["ID"] === id);
  if (!row) return;
  document.getElementById("d-title").textContent = `${row["ID"]} — Details`;

  const extraKeys = Object.keys(row).filter(k => !FIXED_KEYS.includes(k));
  let extraHtml = "";
  if (extraKeys.length > 0) {
    extraHtml = `<div class="detail-section"><h3>Additional Info</h3><div class="detail-grid">` +
      extraKeys.map(k => `<div class="di"><label>${k}</label><span>${fmtDate(row[k]) || "—"}</span></div>`).join("") +
      `</div></div>`;
  }

    const challanHtml = row["Challan No"]
    ? `<div class="detail-section"><h3>Delivery Challan</h3><p style="font-size:13px"><strong>${esc(row["Challan No"])}</strong> <button class="action-btn ab-view" onclick='reprintChallan("${esc(row["Challan No"])}")'>Reprint</button></p></div>`
    : "";

  document.getElementById("d-body").innerHTML =
    `<div class="detail-grid">` +
    `<div class="di"><label>Date</label><span>${fmtDate(row["Date"])}</span></div>` +
    `<div class="di"><label>Status</label><span>${getStatusBadge(row["Status"])}</span></div>` +
    `<div class="di"><label>Customer</label><span>${row["Customer Name"] || "—"}</span></div>` +
    `<div class="di"><label>Phone</label><span>${row["Phone"] || "—"}</span></div>` +
    `<div class="di"><label>City</label><span>${row["City"] || "—"}</span></div>` +
    `</div>` +
    `<div class="detail-section"><h3>Battery Info</h3><div class="detail-grid">` +
    `<div class="di"><label>Category</label><span>${row["Battery Category"] || "—"}</span></div>` +
    `<div class="di"><label>Model</label><span>${row["Battery Model"] || "—"}</span></div>` +
    `<div class="di"><label>Serial No</label><span>${row["Serial No"] || "—"}</span></div>` +
    `<div class="di"><label>Charger Replace</label><span>${row["Charger Replace"] || "No"}</span></div>` +
    `<div class="di"><label>Charger Model</label><span>${row["Charger Model"] || "—"}</span></div>` +
    `<div class="di"><label>Charger Serial</label><span>${row["Charger Serial"] || "—"}</span></div>` +
    `</div></div>` +
    `<div class="detail-section"><h3>Complaint</h3>` +
    `<p style="font-size:13px;line-height:1.6">${row["Complaint"] || "—"}</p></div>` +
    `<div class="detail-section"><h3>Replacement & Return Flow</h3><div class="detail-grid">` +
    `<div class="di"><label>Dispatched By</label><span>${row["Dispatched By"] || "—"}</span></div>` +
    `<div class="di"><label>Dispatch Date</label><span>${fmtDate(row["Dispatch Date"])}</span></div>` +
    `<div class="di"><label>Pickup Mode</label><span>${row["Pickup Mode"] || "—"}</span></div>` +
    `<div class="di"><label>Expected Pickup</label><span>${fmtDate(row["Expected Pickup Date"])}</span></div>` +
    `<div class="di"><label>Received Date</label><span>${fmtDate(row["Pickup Confirmed Date"])}</span></div>` +
    `<div class="di"><label>Received Location</label><span>${row["Received Location"] || "—"}</span></div>` +
    `</div></div>` +
       `<div class="detail-section"><h3>Delivery Address</h3><p style="font-size:13px">${esc(row["Address"]) || "—"}</p></div>` +
    challanHtml +
    extraHtml +
    (row["Remarks"] ? `<div class="detail-section"><h3>Remarks</h3><p style="font-size:13px">${row["Remarks"]}</p></div>` : "");

  openModal("detail-modal");
}

// ---- DELIVERY CHALLAN ----
function esc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function challanFields(row) {
  const items = [{ p: "Battery " + (row["Battery Model"] || ""), s: "", q: 1, a: 0 }];
  if (row["Charger Replace"] === "Yes") items.push({ p: "Charger " + (row["Charger Model"] || ""), s: "", q: 1, a: 0 });
  return `
    <div class="form-group" style="margin-bottom:12px">
      <label style="display:flex;align-items:center;cursor:pointer">
        <input type="checkbox" id="c-make" checked style="width:auto;margin-right:8px"
          onchange="document.getElementById('c-box').style.display=this.checked?'block':'none'"/>
        Delivery Challan banao
      </label>
    </div>
    <div id="c-box">
      <div class="form-group" style="margin-bottom:12px">
        <label>Delivery Address *</label>
        <textarea id="c-address" placeholder="Ship-to address">${esc(row["Address"] || "")}</textarea>
      </div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:6px">Particulars · New serial · Qty · Amount</p>
      <div id="c-items">${items.map(challanItemRow).join("")}</div>
      <button type="button" class="btn-cancel" style="margin-bottom:12px" onclick="addChallanItem()">+ Add item</button>
    </div>`;
}

function challanItemRow(it) {
  return `<div class="c-item" style="display:grid;grid-template-columns:2fr 1.3fr .6fr .8fr auto;gap:6px;margin-bottom:6px">
    <input class="c-part" placeholder="Particulars" value="${esc(it.p)}"/>
    <input class="c-serial" placeholder="New serial no" value="${esc(it.s)}"/>
    <input class="c-qty" type="number" min="1" value="${it.q}"/>
    <input class="c-amt" type="number" min="0" value="${it.a}"/>
    <button type="button" class="modal-close" onclick="this.parentNode.remove()">✕</button>
  </div>`;
}

function addChallanItem() {
  document.getElementById("c-items").insertAdjacentHTML("beforeend", challanItemRow({ p: "", s: "", q: 1, a: 0 }));
}

function collectChallan() {
  const address = document.getElementById("c-address").value.trim();
  if (!address) { showToast("Delivery address bharo", "error"); return null; }
  const items = [];
  document.querySelectorAll("#c-items .c-item").forEach(el => {
    const p = el.querySelector(".c-part").value.trim();
    const s = el.querySelector(".c-serial").value.trim();
    const q = Number(el.querySelector(".c-qty").value);
    const a = Number(el.querySelector(".c-amt").value) || 0;
    if (p && q > 0) items.push({ particulars: s ? `${p} (Sr. ${s})` : p, qty: q, amount: a });
  });
  if (!items.length) { showToast("Kam se kam ek item bharo", "error"); return null; }
  return { address, items };
}

async function reprintChallan(dcNo) {
  try {
    const res = await fetch(`${API_URL}?action=getChallans`);
    const json = await res.json();
    const c = (json.data || []).find(x => x.dcNo === dcNo);
    if (!c) { showToast("Challan nahi mili", "error"); return; }
    printHtml(buildChallanPrint(c));
  } catch (e) {
    showToast("Network error", "error");
  }
}

function printHtml(html) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
  }, 300);
}

function buildChallanPrint(c) {
  const H = CHALLAN_HEADER;
  const rows = c.items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(it.particulars)}</td>
      <td style="text-align:center">${esc(it.qty)}</td>
      <td style="text-align:right">${Number(it.amount || 0).toFixed(2)}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(c.dcNo)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:20px;color:#000}
    .box{border:1.5px solid #000;padding:14px}
    .hd{text-align:center;border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:10px}
    .hd h1{margin:4px 0;font-size:20px}
    .row{display:flex;justify-content:space-between;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border:1px solid #000;padding:6px 8px}
    th{background:#eee}
    .note{margin-top:10px;font-weight:bold}
    .sign{display:flex;justify-content:space-between;margin-top:60px}
  </style></head><body><div class="box">
    <div class="hd">
      <div>GSTIN: ${esc(H.gstin)}</div>
      <h1>${esc(H.name)}</h1>
      <div>${esc(H.address)}</div>
      <div>Ph: ${esc(H.phones)}</div>
      <div style="margin-top:6px;font-weight:bold;font-size:15px">DELIVERY CHALLAN</div>
    </div>
    <div class="row"><div><b>Challan No:</b> ${esc(c.dcNo)}</div><div><b>Date:</b> ${esc(c.date)}</div></div>
    <div class="row"><div><b>Ref:</b> ${esc(c.betId)}</div></div>
    <div><b>Name &amp; Address:</b><br>
      ${esc(c.customerName)}${c.phone ? " (" + esc(c.phone) + ")" : ""}<br>
      ${esc(c.address)}${c.city ? ", " + esc(c.city) : ""}
    </div>
    <table>
      <thead><tr><th style="width:40px">#</th><th>Particulars</th><th style="width:60px">Qty</th><th style="width:100px">Amount</th></tr></thead>
      <tbody>${rows}
        <tr><td colspan="3" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${Number(c.total || 0).toFixed(2)}</b></td></tr>
      </tbody>
    </table>
    <div class="note">Only for Warranty not for Sale</div>
    <div class="sign"><div>Customer Signature</div><div>Manager / Prop.</div></div>
  </div></body></html>`;
}

// ---- MODAL HELPERS ----
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal-overlay").forEach(el => {
    el.addEventListener("click", e => { if (e.target === el) el.classList.remove("open"); });
  });
});

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3000);
}
