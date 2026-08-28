/* Paradise Lawn Care Operations Suite - Version 3.20 Phase 1 */

const APP_VERSION = "3.20 Phase 1";
const STORAGE_KEY = "paradise_invoices_v1_2";
const LAST_MONTH_KEY = "pl_last_month";
const JOB_SEQUENCE_KEY = "pl_job_sequence";
const maxServiceRows = 20;
const startingServiceRows = 5;

let serviceRowCount = 0;
let activeInvoiceId = null;
let pendingInvoiceCustomerId = null;
let pendingInvoiceQuoteId = null;

function byId(id) {
  return document.getElementById(id);
}

function cleanMoney(value) {
  return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function formatMoney(value) {
  return "$" + Number(value || 0).toFixed(2);
}

const PAYMENT_METHODS = Object.freeze({
  cash: { label: "Cash", rate: 0 },
  "business-check": { label: "Business Check", rate: 0 },
  zelle: { label: "Zelle", rate: 0 },
  "credit-card": { label: "Credit Card +3.5%", rate: 0.035 }
});

function normalizePaymentCode(value, label = "", rate = 0) {
  const raw = String(value || "").trim().toLowerCase();
  if (PAYMENT_METHODS[raw]) return raw;
  const normalizedLabel = String(label || value || "").trim().toLowerCase();
  if (normalizedLabel.includes("business") || normalizedLabel.includes("check")) return "business-check";
  if (normalizedLabel.includes("zelle")) return "zelle";
  if (normalizedLabel.includes("credit") || normalizedLabel.includes("card") || Number(rate) > 0) return "credit-card";
  return "cash";
}

function paymentDetailsFromSelect(select = byId("paymentMethod")) {
  const option = select?.options?.[select.selectedIndex];
  const code = normalizePaymentCode(select?.value, option?.textContent, option?.dataset?.rate);
  const definition = PAYMENT_METHODS[code] || PAYMENT_METHODS.cash;
  return { code, label: definition.label, rate: Number(option?.dataset?.rate ?? definition.rate) || 0 };
}

function setPaymentMethodFromRecord(record = {}) {
  const select = byId("paymentMethod");
  if (!select) return "cash";
  const code = normalizePaymentCode(record.paymentCode, record.paymentMethod, record.paymentRate);
  select.value = code;
  if (select.value !== code) select.value = "cash";
  return select.value;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}/${parts[0].slice(-2)}`;
}

function getMonthCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return yy + mm;
}

function generateJobNumber() {
  const monthCode = getMonthCode();
  const savedMonth = localStorage.getItem(LAST_MONTH_KEY);
  let sequence = Number(localStorage.getItem(JOB_SEQUENCE_KEY)) || 0;

  if (savedMonth !== monthCode) sequence = 0;

  sequence += 1;
  localStorage.setItem(LAST_MONTH_KEY, monthCode);
  localStorage.setItem(JOB_SEQUENCE_KEY, String(sequence));

  return `PL-${monthCode}-${String(sequence).padStart(5, "0")}`;
}

function getSavedInvoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to read saved invoices:", error);
    return [];
  }
}

function storeInvoices(invoices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

const PREFERRED_CONTACT_METHODS = Object.freeze([
  { value: "Phone", icon: "☎" },
  { value: "Text", icon: "▣" },
  { value: "Email", icon: "✉" },
  { value: "Smoke Signal", icon: "♨" }
]);

function normalizePreferredContact(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (normalized === "text" || normalized === "sms" || normalized === "text message") return "Text";
  if (normalized === "email" || normalized === "e mail") return "Email";
  if (normalized === "smoke" || normalized === "smoke signal" || normalized === "smokesignal") return "Smoke Signal";
  return "Phone";
}

function normalizeSharedPreferredContact(value) {
  return normalizePreferredContact(value) === "Email" ? "Email" : "Phone";
}

function preferredContactForRecord(record, fallback = "Phone") {
  const legacyValue = record?.preferredContact
    ?? record?.preferredContactMethod
    ?? record?.contactPreference
    ?? record?.contactMethod
    ?? record?.preferred_contact
    ?? fallback;
  return normalizeSharedPreferredContact(legacyValue);
}

const PreferredContactComponent = (() => {
  function sourceElement(source) {
    return typeof source === "string" ? byId(source) : source;
  }

  function sync(source) {
    const select = sourceElement(source);
    if (!select) return "Phone";
    const actionOnly = select.dataset.actionOnly === "true";
    const value = actionOnly ? normalizeSharedPreferredContact(select.value) : normalizePreferredContact(select.value);
    if (select.value !== value) select.value = value;
    const group = select.nextElementSibling?.classList.contains("preferred-contact-component")
      ? select.nextElementSibling
      : null;
    group?.querySelectorAll(".preferred-contact-card").forEach((button) => {
      const selected = !actionOnly && button.dataset.value === value;
      button.setAttribute("aria-checked", selected ? "true" : "false");
      button.tabIndex = actionOnly ? 0 : selected ? 0 : -1;
    });
    if (select.id === "invoicePreferredContact" && typeof updateInvoicePreferredContactActions === "function") {
      updateInvoicePreferredContactActions(value);
    }
    return value;
  }

  function setValue(source, value, { emit = false } = {}) {
    const select = sourceElement(source);
    if (!select) return normalizePreferredContact(value);
    select.value = select.dataset.actionOnly === "true" ? normalizeSharedPreferredContact(value) : normalizePreferredContact(value);
    sync(select);
    if (typeof syncPreferredContactCheckboxes === "function") syncPreferredContactCheckboxes(select.id);
    if (emit) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return select.value;
  }

  function mount(source) {
    const select = sourceElement(source);
    if (!select || select.dataset.preferredContactMounted === "true") {
      if (select) sync(select);
      return select;
    }

    select.dataset.preferredContactMounted = "true";
    select.classList.add("is-component-source");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const group = document.createElement("div");
    group.className = "preferred-contact-component";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Preferred Contact Method");
    const labelledBy = select.getAttribute("aria-labelledby");
    if (labelledBy) {
      group.removeAttribute("aria-label");
      group.setAttribute("aria-labelledby", labelledBy);
    }

    PREFERRED_CONTACT_METHODS.forEach((method, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preferred-contact-card";
      button.dataset.value = method.value;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.innerHTML = `<span class="preferred-contact-icon" aria-hidden="true">${method.icon}</span><span class="preferred-contact-label">${method.value}</span>`;
      button.addEventListener("click", (event) => {
        const activatedButton = event.currentTarget;
        const actionOnly = select.dataset.actionOnly === "true";
        const preferredContact = actionOnly
          ? normalizePreferredContact(activatedButton.dataset.value)
          : setValue(select, activatedButton.dataset.value, { emit: true });

        if (preferredContact === "Smoke Signal") {
          openSmokeSignal(activatedButton);
          return;
        }

        if (preferredContact === "Email") {
          if (select.id === "invoicePreferredContact") emailInvoice();
          else if (select.id === "quotePreferredContact") emailQuote();
          else if (select.id === "customerPreferredContact") emailCustomer();
          return;
        }

        if (preferredContact === "Text") {
          if (select.id === "invoicePreferredContact") textInvoice();
          else if (select.id === "quotePreferredContact") textQuote();
          else if (select.id === "customerPreferredContact") textCustomer();
          return;
        }

        if (preferredContact === "Phone") {
          const phoneField = select.id === "invoicePreferredContact" ? byId("phone")
            : select.id === "quotePreferredContact" ? byId("quotePhone")
              : byId("customerPhone");
          launchPhoneV319(phoneField?.value, "Please add the customer's phone number before calling.");
        }
      });
      button.addEventListener("keydown", (event) => {
        const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const buttons = [...group.querySelectorAll(".preferred-contact-card")];
        const current = Math.max(0, buttons.indexOf(button));
        let next = current;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % buttons.length;
        else next = (current - 1 + buttons.length) % buttons.length;
        if (select.dataset.actionOnly !== "true") {
          setValue(select, buttons[next].dataset.value, { emit: true });
        }
        buttons[next].focus();
      });
      group.appendChild(button);
      if (index === 0) button.tabIndex = 0;
    });

    select.insertAdjacentElement("afterend", group);
    select.addEventListener("change", () => sync(select));
    sync(select);
    return select;
  }

  function mountAll(root = document) {
    root.querySelectorAll("select.preferred-contact").forEach(mount);
  }

  return { mount, mountAll, normalize: normalizePreferredContact, setValue, sync };
})();

function syncPreferredContactCheckboxes(sourceId) {
  const source = byId(sourceId);
  if (!source) return;
  const preferred = normalizePreferredContact(source.value);
  document.querySelectorAll(`[data-preferred-source="${sourceId}"]`).forEach((checkbox) => {
    const checkboxMethod = checkbox.dataset.preferredContact;
    checkbox.checked = checkboxMethod === normalizeSharedPreferredContact(preferred);
  });
}

function bindPreferredContactCheckboxes(root = document) {
  root.querySelectorAll("[data-preferred-source]").forEach((checkbox) => {
    if (checkbox.dataset.preferredBound === "true") return;
    checkbox.dataset.preferredBound = "true";
    checkbox.addEventListener("change", () => {
      const sourceId = checkbox.dataset.preferredSource;
      if (!checkbox.checked) {
        checkbox.checked = true;
        return;
      }
      PreferredContactComponent.setValue(sourceId, checkbox.dataset.preferredContact, { emit: true });
      syncPreferredContactCheckboxes(sourceId);
      synchronizeCustomerPreferredContactFromActiveRecord(sourceId);
    });
  });
  ["customerPreferredContact", "quotePreferredContact", "invoicePreferredContact"].forEach((sourceId) => {
    const source = byId(sourceId);
    if (source && source.dataset.checkboxSyncBound !== "true") {
      source.dataset.checkboxSyncBound = "true";
      source.addEventListener("change", () => syncPreferredContactCheckboxes(sourceId));
    }
    syncPreferredContactCheckboxes(sourceId);
  });
}

function customerIdForPreferredSource(sourceId) {
  if (sourceId === "customerPreferredContact") return activeCustomerId;
  if (sourceId === "quotePreferredContact") return byId("quoteCustomer")?.value || readArray(QUOTE_STORAGE_KEY).find((quote) => quote.id === activeQuoteId)?.customerId || null;
  return byId("invoiceCustomerLink")?.value
    || pendingInvoiceCustomerId
    || getSavedInvoices().find((invoice) => invoice.id === activeInvoiceId)?.customerId
    || null;
}

function setCustomerPreferredContactEverywhere(customerId, value, sourceId = "") {
  if (!customerId) return false;
  const preferredContact = normalizeSharedPreferredContact(value);
  const now = new Date().toISOString();

  const customers = readArray(CUSTOMER_STORAGE_KEY);
  const customer = customers.find((entry) => entry.id === customerId);
  if (!customer) return false;
  customer.preferredContact = preferredContact;
  customer.updatedAt = now;
  writeArray(CUSTOMER_STORAGE_KEY, customers);

  const quotes = readArray(QUOTE_STORAGE_KEY);
  let quotesChanged = false;
  quotes.forEach((quote) => {
    if (quote.customerId !== customerId) return;
    quote.preferredContact = preferredContact;
    quote.updatedAt = now;
    quotesChanged = true;
  });
  if (quotesChanged) writeArray(QUOTE_STORAGE_KEY, quotes);

  const invoices = getSavedInvoices();
  let invoicesChanged = false;
  invoices.forEach((invoice) => {
    if (invoice.customerId !== customerId) return;
    invoice.preferredContact = preferredContact;
    invoice.updatedAt = now;
    invoicesChanged = true;
  });
  if (invoicesChanged) storeInvoices(invoices);

  const visibleCustomerId = activeCustomerId;
  const visibleQuoteCustomerId = byId("quoteCustomer")?.value || readArray(QUOTE_STORAGE_KEY).find((quote) => quote.id === activeQuoteId)?.customerId;
  const visibleInvoiceCustomerId = byId("invoiceCustomerLink")?.value || pendingInvoiceCustomerId || getSavedInvoices().find((invoice) => invoice.id === activeInvoiceId)?.customerId;
  const targets = [
    ["customerPreferredContact", visibleCustomerId],
    ["quotePreferredContact", visibleQuoteCustomerId],
    ["invoicePreferredContact", visibleInvoiceCustomerId]
  ];
  targets.forEach(([targetId, targetCustomerId]) => {
    if (targetId === sourceId || targetCustomerId !== customerId || !byId(targetId)) return;
    PreferredContactComponent.setValue(targetId, preferredContact);
    syncPreferredContactCheckboxes(targetId);
  });
  return true;
}

function synchronizeCustomerPreferredContactFromActiveRecord(sourceId) {
  const customerId = customerIdForPreferredSource(sourceId);
  if (!customerId) return;
  setCustomerPreferredContactEverywhere(customerId, byId(sourceId)?.value, sourceId);
}


const SmokeSignalController = (() => {
  const VIDEO_ID = "HyRSa7rYSRE";
  const API_SCRIPT_ID = "youtubeIframeApiV319";
  let apiPromise = null;
  let active = null;
  let sequence = 0;

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try {
          if (typeof previousReady === "function") previousReady();
        } catch (error) {
          console.warn("A previous YouTube API callback failed:", error);
        }
        if (window.YT?.Player) finish(resolve, window.YT);
        else finish(reject, new Error("YouTube API did not initialize."));
      };

      let script = byId(API_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = API_SCRIPT_ID;
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("error", () => finish(reject, new Error("YouTube API could not be loaded.")), { once: true });
      window.setTimeout(() => {
        if (window.YT?.Player) finish(resolve, window.YT);
        else finish(reject, new Error("YouTube API loading timed out."));
      }, 12000);
    }).catch((error) => {
      apiPromise = null;
      throw error;
    });
    return apiPromise;
  }

  function clearTimers(session) {
    session.timers.forEach((timer) => window.clearTimeout(timer));
    session.timers.clear();
  }

  function later(session, callback, milliseconds) {
    const timer = window.setTimeout(() => {
      session.timers.delete(timer);
      callback();
    }, milliseconds);
    session.timers.add(timer);
    return timer;
  }

  function rememberInterface(sourceElement) {
    return {
      tabId: document.querySelector(".tab-panel.active")?.id || "homeTab",
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      focus: sourceElement || document.activeElement
    };
  }

  function restoreInterface(saved) {
    if (saved.tabId && !byId(saved.tabId)?.classList.contains("active") && typeof switchTab === "function") {
      switchTab(saved.tabId);
    }
    window.setTimeout(() => {
      window.scrollTo(saved.scrollX, saved.scrollY);
      if (saved.focus?.isConnected && typeof saved.focus.focus === "function") saved.focus.focus();
    }, 0);
  }

  function destroyPlayer(session) {
    if (!session?.player) return;
    try {
      if (typeof session.player.destroy === "function") session.player.destroy();
    } catch (error) {
      console.warn("Smoke Signal player cleanup failed:", error);
    }
    session.player = null;
  }

  function close() {
    if (!active) return false;
    const session = active;
    active = null;
    clearTimers(session);
    destroyPlayer(session);
    document.body.classList.remove("smoke-signal-active");
    session.overlay.remove();
    restoreInterface(session.saved);
    return true;
  }

  function setFailure(session) {
    if (active !== session) return;
    session.failed = true;
    session.status.hidden = false;
    session.status.innerHTML = "The smoke signal could not be delivered.<br>Try Text or Phone instead.";
    session.playButton.hidden = true;
    destroyPlayer(session);
    later(session, close, 3600);
  }

  function showManualPlay(session) {
    if (active !== session || session.failed || session.finished) return;
    session.status.textContent = "Autoplay was blocked. Select Play to send the smoke signal.";
    session.playButton.hidden = false;
  }

  function finish(session) {
    if (active !== session || session.finished) return;
    session.finished = true;
    session.status.hidden = true;
    session.playButton.hidden = true;
    session.finalMessage.classList.add("is-visible");
    later(session, close, 2400);
  }

  async function open(sourceElement) {
    if (active) {
      active.closeButton.focus();
      return false;
    }
    byId("smokeSignalOverlay")?.remove();

    const saved = rememberInterface(sourceElement);
    const overlay = document.createElement("div");
    const playerId = `smokeSignalPlayer-${++sequence}`;
    overlay.id = "smokeSignalOverlay";
    overlay.className = "smoke-signal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Smoke Signal");
    overlay.innerHTML = `<div class="smoke-signal-stage">
      <div class="smoke-signal-player-shell"><div id="${playerId}" class="smoke-signal-player"></div></div>
      <button type="button" class="smoke-signal-close" aria-label="Close Smoke Signal">×</button>
      <button type="button" class="smoke-signal-play" hidden>Play</button>
      <div class="smoke-signal-status" role="status">Consulting ancient communication methods...</div>
      <div class="smoke-signal-final">No response received.<br>Try Text or Phone instead.</div>
    </div>`;
    document.body.appendChild(overlay);

    const session = {
      overlay,
      playerId,
      player: null,
      completedPlays: 0,
      finished: false,
      failed: false,
      timers: new Set(),
      saved,
      closeButton: overlay.querySelector(".smoke-signal-close"),
      playButton: overlay.querySelector(".smoke-signal-play"),
      status: overlay.querySelector(".smoke-signal-status"),
      finalMessage: overlay.querySelector(".smoke-signal-final")
    };
    active = session;
    document.body.classList.add("smoke-signal-active");
    session.closeButton.addEventListener("click", close);
    session.playButton.addEventListener("click", () => {
      if (active !== session || !session.player) return;
      session.playButton.hidden = true;
      session.status.textContent = "Smoke signal transmission in progress...";
      try {
        session.player.playVideo();
      } catch (_) {
        setFailure(session);
      }
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });
    (window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0)))(() => overlay.classList.add("is-open"));
    session.closeButton.focus();

    if (navigator.onLine === false) {
      setFailure(session);
      return true;
    }

    try {
      const YT = await loadYouTubeApi();
      if (active !== session) return true;
      session.player = new YT.Player(playerId, {
        videoId: VIDEO_ID,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 1
        },
        events: {
          onReady: (event) => {
            if (active !== session) return;
            try {
              event.target.playVideo();
              later(session, () => {
                const state = typeof event.target.getPlayerState === "function" ? event.target.getPlayerState() : null;
                if (state !== YT.PlayerState.PLAYING && session.completedPlays === 0) showManualPlay(session);
              }, 1700);
            } catch (_) {
              showManualPlay(session);
            }
          },
          onAutoplayBlocked: () => showManualPlay(session),
          onStateChange: (event) => {
            if (active !== session) return;
            if (event.data === YT.PlayerState.PLAYING) {
              session.playButton.hidden = true;
              session.status.textContent = "Smoke signal transmission in progress...";
              return;
            }
            if (event.data !== YT.PlayerState.ENDED) return;
            session.completedPlays += 1;
            if (session.completedPlays === 1) {
              try {
                event.target.seekTo(0, true);
                event.target.playVideo();
              } catch (_) {
                setFailure(session);
              }
            } else if (session.completedPlays === 2) {
              finish(session);
            }
          },
          onError: () => setFailure(session)
        }
      });
    } catch (error) {
      console.warn("Smoke Signal unavailable:", error);
      setFailure(session);
    }
    return true;
  }

  function getState() {
    return active
      ? { completedPlays: active.completedPlays, failed: active.failed, finished: active.finished, overlay: active.overlay }
      : null;
  }

  document.addEventListener("keydown", (event) => {
    if (active && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  return { close, getState, open, videoId: VIDEO_ID };
})();

function openSmokeSignal(sourceElement) {
  return SmokeSignalController.open(sourceElement);
}

function closeSmokeSignal() {
  return SmokeSignalController.close();
}

function createServiceRow(data = {}) {
  if (serviceRowCount >= maxServiceRows) {
    alert("Maximum of 20 service lines reached.");
    return;
  }

  serviceRowCount += 1;
  const row = document.createElement("div");
  row.className = "service-row";
  row.innerHTML = `
    <input type="date" class="service-date" aria-label="Service date">
    <input type="text" class="service-address" placeholder="Service Address" aria-label="Service address">
    <select class="service-select" aria-label="Service performed">
      <option>Select</option>
      <option>Full Service</option>
      <option>Hedge Trim</option>
      <option>Debris Removal</option>
      <option>Land Clearing</option>
    </select>
    <input class="amount" type="text" inputmode="decimal" placeholder="$0.00" aria-label="Service amount">
  `;

  byId("serviceRows").appendChild(row);

  row.querySelector(".service-date").value = data.date || "";
  row.querySelector(".service-address").value = data.address || "";
  const serviceValue = ["Mow", "Weed Eat", "Edge", "Blow"].includes(data.service) ? "Full Service" : (data.service || "Select");
  row.querySelector(".service-select").value = serviceValue;
  row.querySelector(".amount").value = data.amount ? formatMoney(data.amount) : "";

  const amountField = row.querySelector(".amount");
  amountField.addEventListener("input", calculateTotals);
  amountField.addEventListener("blur", () => formatAmountField(amountField));
}

function addServiceRow() {
  createServiceRow();
}

function resetServiceRows(rows = []) {
  byId("serviceRows").innerHTML = "";
  serviceRowCount = 0;

  const minimumRows = Math.max(startingServiceRows, rows.length);
  for (let index = 0; index < minimumRows; index += 1) {
    createServiceRow(rows[index] || {});
  }
}

function calculateTotals() {
  let subtotal = 0;
  document.querySelectorAll(".amount").forEach((field) => {
    subtotal += cleanMoney(field.value);
  });

  const taxRate = Number(byId("taxRate").value);
  const paymentRate = paymentDetailsFromSelect().rate;
  const taxedTotal = subtotal + subtotal * taxRate;
  const cardFee = taxedTotal * paymentRate;
  const total = taxedTotal + cardFee;

  byId("subtotal").textContent = formatMoney(subtotal);
  const taxDisplay = byId("taxTotalDisplay");
  if (taxDisplay) taxDisplay.textContent = formatMoney(subtotal * taxRate);
  byId("total").textContent = formatMoney(total);
  return { subtotal, total };
}

function formatAmountField(field) {
  const value = cleanMoney(field.value);
  field.value = value > 0 ? formatMoney(value) : "";
  calculateTotals();
}

function collectServiceRows() {
  return Array.from(document.querySelectorAll(".service-row"))
    .map((row) => ({
      date: row.querySelector(".service-date").value,
      address: row.querySelector(".service-address").value.trim(),
      service: row.querySelector(".service-select").value,
      amount: cleanMoney(row.querySelector(".amount").value)
    }))
    .filter((row) => row.date || row.address || row.service !== "Select" || row.amount > 0);
}

function collectInvoice() {
  const totals = calculateTotals();
  const paymentSelect = byId("paymentMethod");
  const payment = paymentDetailsFromSelect(paymentSelect);
  const taxSelect = byId("taxRate");
  const previous = activeInvoiceId ? getSavedInvoices().find((invoice) => invoice.id === activeInvoiceId) : null;

  return {
    ...previous,
    id: activeInvoiceId || crypto.randomUUID(),
    customerId: byId("invoiceCustomerLink")?.value || pendingInvoiceCustomerId || findMatchingCustomerId(),
    quoteId: byId("invoiceQuoteLink")?.value || pendingInvoiceQuoteId || null,
    jobNumber: byId("jobNumber").value,
    invoiceDate: byId("todayDate").value,
    dueDate: byId("dueDate").value,
    status: byId("invoiceStatus").value,
    businessName: byId("businessName").value.trim(),
    clientName: byId("clientName").value.trim(),
    billingAddress: byId("billingAddress").value.trim(),
    cityStateZip: byId("cityStateZip").value.trim(),
    phone: byId("phone").value.trim(),
    email: byId("email").value.trim(),
    preferredContact: PreferredContactComponent.sync("invoicePreferredContact"),
    services: collectServiceRows(),
    taxRate: taxSelect.value,
    taxLabel: taxSelect.options[taxSelect.selectedIndex].text,
    paymentCode: payment.code,
    paymentRate: String(payment.rate),
    paymentMethod: payment.label,
    notes: byId("notes").value.trim(),
    subtotal: totals.subtotal,
    total: totals.total,
    isDemo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function saveInvoice() {
  const invoice = collectInvoice();
  if (!invoice.clientName && !invoice.businessName) {
    alert("Please enter a client name or business name before saving.");
    return;
  }

  const invoices = getSavedInvoices();
  const existingIndex = invoices.findIndex((item) => item.id === invoice.id || item.jobNumber === invoice.jobNumber);

  if (existingIndex >= 0) {
    invoice.id = invoices[existingIndex].id;
    invoice.createdAt = invoices[existingIndex].createdAt || invoice.createdAt;
    invoice.alertMeta = invoices[existingIndex].alertMeta || {};
    invoice.isDemo = Boolean(invoices[existingIndex].isDemo);
    invoices[existingIndex] = invoice;
  } else {
    invoices.push(invoice);
  }

  storeInvoices(invoices);
  activeInvoiceId = invoice.id;
  pendingInvoiceCustomerId = invoice.customerId || null;
  pendingInvoiceQuoteId = invoice.quoteId || null;
  showEditingBanner(invoice.jobNumber);
  populateInvoiceLinkSelectors(invoice);
  renderInvoiceAttachments();
  renderCustomerInvoiceHistory();
  alert(existingIndex >= 0 ? "Invoice updated successfully." : "Invoice saved successfully.");
  renderInvoiceList();
  if (typeof refreshAlerts === "function") refreshAlerts();
}

function clearInvoiceFields() {
  ["dueDate", "businessName", "clientName", "billingAddress", "cityStateZip", "phone", "email", "notes"].forEach((id) => {
    byId(id).value = "";
  });
  PreferredContactComponent.setValue("invoicePreferredContact", "Phone");
  byId("invoiceStatus").value = "Unpaid";
  byId("taxRate").selectedIndex = 0;
  byId("paymentMethod").value = "cash";
  resetServiceRows();
  calculateTotals();
}

function newInvoice() {
  if (!confirm("Start a new invoice? Any unsaved changes will be cleared.")) return;

  activeInvoiceId = null;
  pendingInvoiceCustomerId = null;
  pendingInvoiceQuoteId = null;
  clearInvoiceFields();
  byId("jobNumber").value = generateJobNumber();
  byId("todayDate").value = getLocalDateString();
  hideEditingBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrentInvoice() {
  if (!confirm("Clear the current invoice? The job number will not change.")) return;
  clearInvoiceFields();
  byId("todayDate").value = getLocalDateString();
}

function showEditingBanner(jobNumber) {
  byId("editingJobNumber").textContent = jobNumber;
  byId("editingBanner").hidden = false;
}

function hideEditingBanner() {
  byId("editingBanner").hidden = true;
  byId("editingJobNumber").textContent = "";
}

function loadInvoice(invoiceId) {
  const invoice = getSavedInvoices().find((item) => item.id === invoiceId);
  if (!invoice) {
    alert("That invoice could not be found.");
    renderInvoiceList();
    return;
  }

  activeInvoiceId = invoice.id;
  pendingInvoiceCustomerId = invoice.customerId || null;
  pendingInvoiceQuoteId = invoice.quoteId || null;
  byId("jobNumber").value = invoice.jobNumber || "";
  byId("todayDate").value = invoice.invoiceDate || "";
  byId("dueDate").value = invoice.dueDate || "";
  byId("invoiceStatus").value = invoice.status || "Unpaid";
  byId("businessName").value = invoice.businessName || "";
  byId("clientName").value = invoice.clientName || "";
  byId("billingAddress").value = invoice.billingAddress || "";
  byId("cityStateZip").value = invoice.cityStateZip || "";
  byId("phone").value = invoice.phone || "";
  byId("email").value = invoice.email || "";
  const linkedCustomer = readArray(CUSTOMER_STORAGE_KEY).find((customer) => customer.id === invoice.customerId);
  const linkedQuote = readArray(QUOTE_STORAGE_KEY).find((quote) => quote.id === invoice.quoteId);
  PreferredContactComponent.setValue(
    "invoicePreferredContact",
    linkedCustomer ? preferredContactForRecord(linkedCustomer) : preferredContactForRecord(linkedQuote, preferredContactForRecord(invoice))
  );
  byId("taxRate").value = String(invoice.taxRate ?? "0");
  setPaymentMethodFromRecord(invoice);
  byId("notes").value = invoice.notes || "";
  resetServiceRows(invoice.services || []);
  calculateTotals();
  showEditingBanner(invoice.jobNumber);
  populateInvoiceLinkSelectors(invoice);
  activateInvoiceMasterRecord(invoice);
  renderInvoiceAttachments();
  closeInvoiceFinder();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteInvoice(event, invoiceId) {
  event.stopPropagation();
  const invoices = getSavedInvoices();
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) return;

  if (!confirm(`Delete invoice ${invoice.jobNumber}? This cannot be undone.`)) return;

  storeInvoices(invoices.filter((item) => item.id !== invoiceId));
  if (activeInvoiceId === invoiceId) {
    activeInvoiceId = null;
    hideEditingBanner();
  }
  renderInvoiceList();
  if (byId("intelligenceCards")) renderIntelligence();
}

function openInvoiceFinder() {
  byId("invoiceFinderModal").hidden = false;
  byId("invoiceSearch").value = "";
  renderInvoiceList();
  setTimeout(() => byId("invoiceSearch").focus(), 0);
}

function closeInvoiceFinder() {
  byId("invoiceFinderModal").hidden = true;
}

function searchableInvoiceText(invoice) {
  return [
    invoice.jobNumber,
    invoice.invoiceDate,
    invoice.dueDate,
    invoice.clientName,
    invoice.businessName,
    invoice.billingAddress,
    invoice.cityStateZip,
    invoice.phone,
    invoice.email,
    invoice.notes,
    ...(invoice.services || []).flatMap((service) => [service.date, service.address, service.service, service.amount])
  ].join(" ").toLowerCase();
}

function renderInvoiceList() {
  const list = byId("invoiceList");
  if (!list) return;

  const searchTerm = (byId("invoiceSearch")?.value || "").trim().toLowerCase();
  const invoices = getSavedInvoices()
    .filter((invoice) => !searchTerm || searchableInvoiceText(invoice).includes(searchTerm))
    .sort((a, b) => new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt));

  list.innerHTML = "";
  byId("emptyInvoiceMessage").hidden = invoices.length > 0;

  invoices.forEach((invoice) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "invoice-row";
    row.addEventListener("click", () => loadInvoice(invoice.id));

    const customerDisplay = [invoice.clientName, invoice.businessName].filter(Boolean).join(" / ") || "No customer name";
    row.innerHTML = `
      <span class="invoice-job-number">${escapeHtml(invoice.jobNumber || "")}${invoice.isDemo ? '<small class="demo-label">DEMO</small>' : ""}</span>
      <span>${escapeHtml(formatDisplayDate(invoice.invoiceDate))}</span>
      <span class="invoice-customer">${escapeHtml(customerDisplay)}</span>
      <span class="invoice-total">${formatMoney(invoice.total)}</span>
      <span class="delete-dot" role="button" aria-label="Delete ${escapeHtml(invoice.jobNumber || "invoice")}" tabindex="0">●</span>
    `;

    const deleteDot = row.querySelector(".delete-dot");
    deleteDot.addEventListener("click", (event) => deleteInvoice(event, invoice.id));
    deleteDot.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") deleteInvoice(event, invoice.id);
    });
    list.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installDemoInvoices() {
  const invoices = getSavedInvoices();
  if (invoices.some((invoice) => invoice.isDemo)) {
    alert("The five demo jobs are already installed.");
    return;
  }

  const today = new Date();
  const demoCustomers = [
    ["Maria Santos", "", "112 SE Ocean Blvd, Stuart, FL 34994", "Full Service", 85],
    ["James Walker", "Walker Rentals", "840 NW Federal Hwy, Stuart, FL 34994", "Hedge Trim", 165],
    ["Linda Parker", "Seaside Villas HOA", "2250 NE Dixie Hwy, Jensen Beach, FL 34957", "Debris Removal", 240],
    ["Robert Green", "", "601 SW Saint Lucie Cres, Stuart, FL 34994", "Land Clearing", 475],
    ["Angela Morris", "Treasure Coast Realty", "3101 SE Federal Hwy, Stuart, FL 34997", "Full Service", 120]
  ];

  const demos = demoCustomers.map((item, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const invoiceDate = getLocalDateString(date);
    return {
      id: `paradise-demo-${index + 1}`,
      jobNumber: `DEMO-PL-${String(index + 1).padStart(3, "0")}`,
      invoiceDate,
      dueDate: invoiceDate,
      clientName: item[0],
      businessName: item[1],
      billingAddress: item[2],
      cityStateZip: "Stuart, FL 34994",
      phone: `772-555-01${String(index + 1).padStart(2, "0")}`,
      email: `demo${index + 1}@example.com`,
      services: [{ date: invoiceDate, address: item[2], service: item[3], amount: item[4] }],
      taxRate: "0",
      taxLabel: "No Tax",
      paymentRate: "0",
      paymentMethod: index % 2 === 0 ? "Cash" : "Business Check",
      notes: "Demo invoice for training and testing.",
      status: "Unpaid",
      subtotal: item[4],
      total: item[4],
      isDemo: true,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString()
    };
  });

  storeInvoices([...invoices, ...demos]);
  renderInvoiceList();
  alert("Five demo jobs installed.");
}

function deleteDemoInvoices() {
  const invoices = getSavedInvoices();
  const demoCount = invoices.filter((invoice) => invoice.isDemo).length;
  if (!demoCount) {
    alert("There are no demo jobs to delete.");
    return;
  }

  if (!confirm(`Delete all ${demoCount} demo jobs? Real invoices will not be affected.`)) return;
  storeInvoices(invoices.filter((invoice) => !invoice.isDemo));
  renderInvoiceList();
  alert("Demo jobs deleted. Real invoices were not changed.");
}

function initializeApp() {
  byId("taxRate").addEventListener("change", calculateTotals);
  byId("paymentMethod").addEventListener("change", calculateTotals);
  byId("invoiceSearch").addEventListener("input", renderInvoiceList);
  byId("invoiceFinderModal").addEventListener("click", (event) => {
    if (event.target === byId("invoiceFinderModal")) closeInvoiceFinder();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !byId("invoiceFinderModal").hidden) closeInvoiceFinder();
  });

  resetServiceRows();
  byId("todayDate").value = getLocalDateString();
  byId("jobNumber").value = generateJobNumber();
  calculateTotals();
}

initializeApp();

/* Paradise Lawn Care Operations Expansion */
const SCHEDULE_STORAGE_KEY = "paradise_employee_schedule_v1";
const MAINTENANCE_STORAGE_KEY = "paradise_maintenance_records_v1";
const ALERT_STORAGE_KEY = "paradise_alert_history_v1";
const scheduleStartHour = 6;
const scheduleEndHour = 20;
let scheduleAnchor = new Date();

function switchTab(tabId) {
  document.querySelectorAll(".tab-button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildInvoiceMessage(invoice) {
  const customer = invoice.clientName || invoice.businessName || "Customer";
  return `Paradise Lawn Care invoice ${invoice.jobNumber} for ${customer}. Total due: ${formatMoney(invoice.total)}. Thank you for choosing Paradise Lawn Care.`;
}

function normalizedPhoneV319(value) {
  const source = String(value || "").trim();
  const digits = source.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return source.startsWith("+") ? `+${digits}` : digits;
}

function normalizedEmailV319(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function emailRecipientV319(value) {
  return encodeURIComponent(value).replace(/%40/gi, "@");
}

function openDeviceLinkV319(url) {
  if (typeof window.__paradiseDeviceLinkHandler === "function") {
    window.__paradiseDeviceLinkHandler(url);
    return url;
  }
  window.location.href = url;
  return url;
}

function launchTextV319(phoneValue, body, missingMessage, notify = (message) => alert(message)) {
  const phone = normalizedPhoneV319(phoneValue);
  if (!phone) {
    notify(missingMessage || "Please add a valid phone number before opening a text message.");
    return false;
  }
  openDeviceLinkV319(`sms:${phone}?body=${encodeURIComponent(String(body || ""))}`);
  return true;
}

function launchEmailV319(emailValue, subject, body, missingMessage, notify = (message) => alert(message)) {
  const email = normalizedEmailV319(emailValue);
  if (!email) {
    notify(missingMessage || "Please add a valid email address before opening an email.");
    return false;
  }
  openDeviceLinkV319(`mailto:${emailRecipientV319(email)}?subject=${encodeURIComponent(String(subject || ""))}&body=${encodeURIComponent(String(body || ""))}`);
  return true;
}

function launchPhoneV319(phoneValue, missingMessage, notify = (message) => alert(message)) {
  const phone = normalizedPhoneV319(phoneValue);
  if (!phone) {
    notify(missingMessage || "Please add a valid phone number before opening the phone application.");
    return false;
  }
  openDeviceLinkV319(`tel:${phone}`);
  return true;
}

function emailInvoice() {
  const invoice = collectInvoice();
  return launchEmailV319(
    invoice.email,
    `Paradise Lawn Care Invoice ${invoice.jobNumber}`,
    `${buildInvoiceMessage(invoice)}\n\nOpen the app and use View PDF to print or save a copy of the invoice.`,
    "Please add the customer's email address before emailing this invoice."
  );
}

function textInvoice() {
  const invoice = collectInvoice();
  return launchTextV319(
    invoice.phone,
    buildInvoiceMessage(invoice),
    "Please add the customer's phone number before texting this invoice."
  );
}

function updateInvoicePreferredContactActions(value = PreferredContactComponent.sync("invoicePreferredContact")) {
  const preferred = normalizePreferredContact(value);
  const emailAction = byId("invoiceEmailAction");
  const textAction = byId("invoiceTextAction");
  emailAction?.classList.toggle("is-preferred-action", preferred === "Email");
  textAction?.classList.toggle("is-preferred-action", preferred === "Text");
}


function ensureParadiseBrandingLayoutV319() {
  /* Header sizing is controlled by style.css. No runtime layout overrides are required. */
}

function viewInvoicePdf() {
  const invoice = collectInvoice();
  const customer = [invoice.clientName, invoice.businessName].filter(Boolean).join(" / ") || "—";
  const rows = invoice.services.length ? invoice.services.map((service) => `
    <tr><td>${escapeHtml(formatDisplayDate(service.date))}</td><td>${escapeHtml(service.address)}</td><td>${escapeHtml(service.service)}</td><td>${formatMoney(service.amount)}</td></tr>`).join("") : '<tr><td colspan="4">No services entered.</td></tr>';
  ensureParadiseBrandingLayoutV319();
  byId("pdfPreview").innerHTML = `
    <div class="pdf-branding pdf-banner-branding">
      <img class="pdf-header-banner" src="images/paradise-header-banner.png" alt="Paradise Lawn Care, LLC">
    </div>
    <div class="pdf-meta"><div><strong>Invoice:</strong> ${escapeHtml(invoice.jobNumber)}<br><strong>Invoice Date:</strong> ${escapeHtml(formatDisplayDate(invoice.invoiceDate))}<br><strong>Due Date:</strong> ${escapeHtml(formatDisplayDate(invoice.dueDate))}</div><div><strong>Bill To:</strong><br>${escapeHtml(customer)}<br>${escapeHtml(invoice.billingAddress)}<br>${escapeHtml(invoice.cityStateZip)}<br>${escapeHtml(invoice.phone)}<br>${escapeHtml(invoice.email)}<br><strong>Preferred Contact:</strong> ${escapeHtml(invoice.preferredContact)}</div></div>
    <table><thead><tr><th>Date</th><th>Service Address</th><th>Service</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <p><strong>Notes:</strong> ${escapeHtml(invoice.notes || "—")}</p>
    <div class="pdf-total"><p>Subtotal: <strong>${formatMoney(invoice.subtotal)}</strong></p><p>Total: <strong>${formatMoney(invoice.total)}</strong></p><p>Payment Method: ${escapeHtml(invoice.paymentMethod)}</p></div>`;
  byId("pdfModal").hidden = false;
}

function closePdfPreview() { byId("pdfModal").hidden = true; }
function waitForInvoiceArtworkV319(timeout = 3000) {
  const images = [...byId("pdfPreview").querySelectorAll("img")];
  if (!images.length) return Promise.resolve();
  return Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
      window.setTimeout(finish, timeout);
    });
  }));
}
async function printInvoicePreview() {
  await waitForInvoiceArtworkV319();
  window.print();
}

function normalizeDate(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function dateKey(date) { return getLocalDateString(date); }
function addDays(date, amount) { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; }
function displayDay(date) { return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function timeLabel(hour, minute) { return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function scheduleRecordKey(date, hour, minute) { return `${dateKey(date)}_${String(hour).padStart(2,"0")}${String(minute).padStart(2,"0")}`; }

function getScheduleData() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || "{}"); }
  catch (error) { console.error(error); return {}; }
}

function renderSchedule() {
  const data = getScheduleData();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(scheduleAnchor, index));
  byId("scheduleAnchorDate").value = dateKey(scheduleAnchor);
  byId("scheduleHead").innerHTML = `<tr><th>Time</th>${dates.map((date) => `<th>${escapeHtml(displayDay(date))}</th>`).join("")}</tr>`;
  let html = "";
  for (let hour = scheduleStartHour; hour < scheduleEndHour; hour += 1) {
    for (const minute of [0, 30]) {
      html += `<tr><td class="time-cell">${escapeHtml(timeLabel(hour, minute))}</td>`;
      dates.forEach((date) => {
        const key = scheduleRecordKey(date, hour, minute);
        const item = data[key] || {};
        html += `<td><div class="schedule-slot" data-schedule-key="${key}">
          <select class="sched-status" aria-label="Employee"><option value=""></option><option value="BP" ${item.status === "BP" || item.status === "B" || item.status === "P" ? "selected" : ""}>BP</option><option value="E1" ${item.status === "E1" || item.status === "RS" ? "selected" : ""}>E1</option><option value="E2" ${item.status === "E2" ? "selected" : ""}>E2</option><option value="E3" ${item.status === "E3" ? "selected" : ""}>E3</option></select>
          <input class="sched-job" value="${escapeHtml(item.jobNumber || "")}" placeholder="Job #" aria-label="Job number">
          <input class="sched-customer" value="${escapeHtml(item.customer || "")}" placeholder="Customer" aria-label="Customer name">
          <input class="sched-service" value="${escapeHtml(item.service || "")}" placeholder="Service" aria-label="Service">
        </div></td>`;
      });
      html += "</tr>";
    }
  }
  byId("scheduleBody").innerHTML = html;
}

function saveSchedule() {
  const data = getScheduleData();
  document.querySelectorAll(".schedule-slot").forEach((slot) => {
    const item = {
      status: slot.querySelector(".sched-status").value,
      jobNumber: slot.querySelector(".sched-job").value.trim(),
      customer: slot.querySelector(".sched-customer").value.trim(),
      service: slot.querySelector(".sched-service").value.trim()
    };
    if (Object.values(item).some(Boolean)) data[slot.dataset.scheduleKey] = item;
    else delete data[slot.dataset.scheduleKey];
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(data));
  byId("scheduleSaveStatus").textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function earliestScheduleDate() { return addDays(normalizeDate(new Date()), -30); }
function shiftSchedule(days) {
  saveSchedule();
  const requested = addDays(scheduleAnchor, days);
  scheduleAnchor = requested < earliestScheduleDate() ? earliestScheduleDate() : requested;
  renderSchedule();
}
function showCurrentWeek() { saveSchedule(); scheduleAnchor = normalizeDate(new Date()); renderSchedule(); }

const equipmentTypes = ["Zero-Turn Lawnmower", "Weed Eater", "Blower", "Edger", "Trimmer", "Pickup Truck", "Trailer"];
const maintenanceTasks = ["Oil Change", "Belt Change", "Blade Sharpening", "Washing", "Tire Change", "Broken Item Repair"];
const maintenanceSubtypes = {
  "Oil Change": ["Fluid", "Filter", "Fluid and Filter"],
  "Belt Change": ["Belt Change"],
  "Blade Sharpening": ["Resharpen Blade", "New Blade"],
  "Washing": ["Washing"],
  "Tire Change": ["Repair", "Replace"],
  "Broken Item Repair": ["Repair", "Replace"]
};

function maintenanceSubtypeOptions(task, selected = "") {
  return (maintenanceSubtypes[task] || ["General"]).map((option) => `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function updateMaintenanceSubtype(taskSelect) {
  const row = taskSelect.closest(".maintenance-entry");
  const subtype = row.querySelector(".maint-subtype");
  subtype.innerHTML = maintenanceSubtypeOptions(taskSelect.value);
}

function getMaintenanceData() {
  try { return JSON.parse(localStorage.getItem(MAINTENANCE_STORAGE_KEY) || "{}"); }
  catch (error) { console.error(error); return {}; }
}

function maintenanceUnitKey(typeIndex, unitIndex) { return `equipment_${typeIndex}_${unitIndex}`; }

function createMaintenanceEntry(entry = {}) {
  const task = entry.task === "Repair - Broken Item" ? "Broken Item Repair" : (entry.task || maintenanceTasks[0]);
  const subtype = entry.subtype || (maintenanceSubtypes[task] || [""])[0];
  return `<div class="maintenance-entry">
    <input type="date" class="maint-date" value="${escapeHtml(entry.date || "")}" aria-label="Maintenance date">
    <select class="maint-task" aria-label="Maintenance type" onchange="updateMaintenanceSubtype(this)">${maintenanceTasks.map((option) => `<option value="${escapeHtml(option)}" ${task === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>
    <select class="maint-subtype" aria-label="Maintenance detail">${maintenanceSubtypeOptions(task, subtype)}</select>
    <input class="maint-reading" value="${escapeHtml(entry.reading || "")}" placeholder="Hours / mileage" aria-label="Hours or mileage">
    <input class="maint-description" value="${escapeHtml(entry.description || entry.notes || "")}" placeholder="Description, parts, repair details" aria-label="Maintenance description">
    <input class="maint-cost" type="number" min="0" step="0.01" value="${escapeHtml(entry.cost || "")}" placeholder="Cost $" aria-label="Maintenance cost">
    <select class="maint-record-status" aria-label="Record status"><option value="Completed" ${(entry.status || "Completed") === "Completed" ? "selected" : ""}>Completed</option><option value="Repair Open" ${entry.status === "Repair Open" ? "selected" : ""}>Repair Open</option></select>
    <button type="button" class="remove-entry" onclick="this.closest('.maintenance-entry').remove()" aria-label="Remove record">×</button>
  </div>`;
}

function renderMaintenanceRecords() {
  const data = getMaintenanceData();
  byId("maintenanceEquipment").innerHTML = equipmentTypes.map((type, typeIndex) => `
    <details class="equipment-type" ${typeIndex === 0 ? "open" : ""}><summary>${escapeHtml(type)} — Up to 5 Units</summary><div class="equipment-units">
      ${Array.from({ length: 5 }, (_, unitIndex) => {
        const key = maintenanceUnitKey(typeIndex, unitIndex);
        const unit = data[key] || {};
        return `<details class="equipment-unit" data-maint-key="${key}"><summary>${escapeHtml(type)} ${unitIndex + 1}${unit.name ? ` — ${escapeHtml(unit.name)}` : ""}</summary><div class="unit-content">
          <div class="unit-identification">
            <div><label>Unit Name / Number</label><input class="unit-name" value="${escapeHtml(unit.name || "")}" placeholder="Example: ZT-1"></div>
            <div><label>Make / Model</label><input class="unit-model" value="${escapeHtml(unit.model || "")}"></div>
            <div><label>Serial / VIN / Plate</label><input class="unit-serial" value="${escapeHtml(unit.serial || "")}"></div>
            <div><label>Current Hours / Mileage</label><input class="unit-reading" value="${escapeHtml(unit.currentReading || "")}" placeholder="Example: 150 hours"></div>
            <div><label>Oil Change Interval</label><input class="unit-oil-interval" type="number" min="0" value="${escapeHtml(unit.oilInterval || (type === "Zero-Turn Lawnmower" ? "50" : ""))}" placeholder="Hours / miles"></div>
            <div><label>Blade Service Interval</label><input class="unit-blade-interval" type="number" min="0" value="${escapeHtml(unit.bladeInterval || (type === "Zero-Turn Lawnmower" ? "20" : ""))}" placeholder="Hours"></div>
          </div>
          <div class="maintenance-list">${(unit.records || []).map(createMaintenanceEntry).join("")}</div>
          <button type="button" class="add-maintenance" onclick="addMaintenanceEntry(this)">+ Add Maintenance Record</button>
        </div></details>`;
      }).join("")}
    </div></details>`).join("");
}

function addMaintenanceEntry(button) {
  button.previousElementSibling.insertAdjacentHTML("beforeend", createMaintenanceEntry({ date: getLocalDateString() }));
}

function saveMaintenanceRecords() {
  const data = {};
  document.querySelectorAll(".equipment-unit").forEach((unit) => {
    const records = Array.from(unit.querySelectorAll(".maintenance-entry")).map((row) => ({
      date: row.querySelector(".maint-date").value,
      task: row.querySelector(".maint-task").value,
      subtype: row.querySelector(".maint-subtype").value,
      reading: row.querySelector(".maint-reading").value.trim(),
      description: row.querySelector(".maint-description").value.trim(),
      cost: row.querySelector(".maint-cost").value.trim(),
      status: row.querySelector(".maint-record-status").value
    })).filter((record) => record.date || record.reading || record.description);
    const item = {
      name: unit.querySelector(".unit-name").value.trim(),
      model: unit.querySelector(".unit-model").value.trim(),
      serial: unit.querySelector(".unit-serial").value.trim(),
      currentReading: unit.querySelector(".unit-reading").value.trim(),
      oilInterval: unit.querySelector(".unit-oil-interval").value.trim(),
      bladeInterval: unit.querySelector(".unit-blade-interval").value.trim(),
      records
    };
    if (item.name || item.model || item.serial || item.currentReading || records.length) data[unit.dataset.maintKey] = item;
  });
  localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(data));
  alert("Maintenance records saved successfully.");
  renderMaintenanceRecords();
  refreshAlerts();
  renderIntelligence();
}


function getAlertHistory() {
  try { return JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY) || "{}"); }
  catch (error) { console.error(error); return {}; }
}
function saveAlertHistory(history) { localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(history)); }
function parseReading(value) { return Number(String(value || "").replace(/[^0-9.]/g, "")) || 0; }
function alertId(type, sourceId, task) { return `${type}:${sourceId}:${task}`; }
function latestCompletedReading(records, task) {
  const matches = (records || []).filter(r => r.task === task && (r.status || "Completed") === "Completed");
  return matches.reduce((max, r) => Math.max(max, parseReading(r.reading)), 0);
}
function buildCurrentAlerts() {
  const alerts = [];
  const today = normalizeDate(new Date());
  getSavedInvoices().forEach(invoice => {
    const dueState = invoiceDueState(invoice, today);
    if (dueState === "overdue" || dueState === "due-today") {
      const title = dueState === "due-today" ? `Invoice ${invoice.jobNumber} is Due Today` : `Invoice ${invoice.jobNumber} is overdue`;
      alerts.push({ id: alertId("invoice", invoice.id, "payment"), type: "Invoice", title, detail: `${invoice.clientName || invoice.businessName || "Customer"} · ${formatMoney(invoice.total)} · Due ${formatDisplayDate(invoice.dueDate)}`, sourceId: invoice.id, actionLabel: "Mark Paid", dueState });
    }
  });
  const maintenance = getMaintenanceData();
  Object.entries(maintenance).forEach(([key, item]) => {
    const typeIndex = Number(key.split("_")[1]);
    const equipment = item.name || `${equipmentTypes[typeIndex] || "Equipment"} ${Number(key.split("_")[2]) + 1}`;
    const reading = parseReading(item.currentReading);
    const oilInterval = parseReading(item.oilInterval);
    const bladeInterval = parseReading(item.bladeInterval);
    const oilLast = latestCompletedReading(item.records, "Oil Change");
    const bladeLast = latestCompletedReading(item.records, "Blade Sharpening");
    if (oilInterval && reading >= oilLast + oilInterval) alerts.push({ id: alertId("maintenance", key, "Oil Change"), type: "Maintenance", title: `${equipment}: oil change due`, detail: `Current reading ${reading}; last completed at ${oilLast}; interval ${oilInterval}.`, sourceId: key, task: "Oil Change", actionLabel: "Mark Completed" });
    if (bladeInterval && reading >= bladeLast + bladeInterval) alerts.push({ id: alertId("maintenance", key, "Blade Sharpening"), type: "Maintenance", title: `${equipment}: blade service due`, detail: `Current reading ${reading}; last completed at ${bladeLast}; interval ${bladeInterval}.`, sourceId: key, task: "Blade Sharpening", actionLabel: "Mark Completed" });
    (item.records || []).filter(r => r.status === "Repair Open").forEach((record, index) => alerts.push({ id: alertId("repair", key, `${record.date}-${index}`), type: "Repair", title: `${equipment}: repair still open`, detail: `${record.subtype || "Repair"} — ${record.description || "No description entered"}`, sourceId: key, recordIndex: index, actionLabel: "Mark Repaired" }));
  });
  return alerts;
}
function bypassAlert(id) {
  const history = getAlertHistory();
  const item = history[id] || { bypassCount: 0, bypasses: [] };
  item.bypassCount += 1;
  item.lastBypassedAt = new Date().toISOString();
  item.bypasses.push(item.lastBypassedAt);
  history[id] = item;
  saveAlertHistory(history);
  refreshAlerts();
}
function completeAlert(id) {
  const current = buildCurrentAlerts().find(a => a.id === id);
  if (!current) return;
  pendingProofAlertId = id;
  byId("proofTitle").textContent = current.actionLabel || "Attach Completion Proof";
  byId("proofAlertDescription").textContent = `${current.title} — ${current.detail}`;
  byId("proofFile").value = "";
  byId("proofNotes").value = "";
  byId("proofModal").hidden = false;
}
function closeProofModal(){ pendingProofAlertId=null; byId("proofModal").hidden=true; }
function submitAlertProof(){
  const file=byId("proofFile").files[0], notes=byId("proofNotes").value.trim();
  if(!pendingProofAlertId) return;
  if(!file){alert("Attach a receipt, photograph, invoice, or repair document before closing this alert.");return;}
  if(file.size>2*1024*1024){alert("Please use a file smaller than 2 MB so it can be stored safely in this browser.");return;}
  const reader=new FileReader();
  reader.onerror=()=>alert("The proof file could not be read.");
  reader.onload=()=>finalizeAlertCompletion(pendingProofAlertId,{name:file.name,type:file.type,size:file.size,dataUrl:reader.result,notes,uploadedAt:new Date().toISOString()});
  reader.readAsDataURL(file);
}
function finalizeAlertCompletion(id, proof) {
  const current = buildCurrentAlerts().find(a => a.id === id);
  if (!current) return;
  if (current.type === "Invoice") {
    const invoices = getSavedInvoices();
    const invoice = invoices.find(i => i.id === current.sourceId);
    if (invoice) { invoice.status = "Paid"; invoice.paidAt = new Date().toISOString(); invoice.paymentProof=proof; storeInvoices(invoices); if (activeInvoiceId === invoice.id) byId("invoiceStatus").value = "Paid"; }
  } else {
    const data = getMaintenanceData();
    const item = data[current.sourceId];
    if (item) {
      if (current.type === "Repair") {
        const open = (item.records || []).filter(r => r.status === "Repair Open");
        const target = open[current.recordIndex];
        if (target) { target.status = "Completed"; target.completedAt = new Date().toISOString(); target.proof=proof; }
      } else {
        item.records = item.records || [];
        item.records.push({ date: getLocalDateString(), task: current.task, subtype: current.task === "Oil Change" ? "Fluid and Filter" : "Resharpen Blade", reading: item.currentReading || "", description: proof.notes || "Completed from alert reminder", status: "Completed", completedAt: new Date().toISOString(), proof });
      }
      localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(data));
      renderMaintenanceRecords();
    }
  }
  const history = getAlertHistory();
  const meta = history[id] || { bypassCount: 0, bypasses: [] };
  meta.completedAt = new Date().toISOString(); meta.completedTitle = current.title; meta.proof=proof;
  history[id] = meta; saveAlertHistory(history);
  closeProofModal(); refreshAlerts(); renderIntelligence(); refreshHomeDashboard();
}
function alertCard(alert, history) {
  const meta = history[alert.id] || { bypassCount: 0 };
  return `<article class="alert-card"><div><span class="alert-type">${escapeHtml(alert.type)}</span><h3>${escapeHtml(alert.title)}</h3><p>${escapeHtml(alert.detail)}</p><small>Bypassed ${meta.bypassCount || 0} time(s)${meta.lastBypassedAt ? ` · Last bypass ${new Date(meta.lastBypassedAt).toLocaleString()}` : ""}</small></div><div class="alert-actions"><button type="button" onclick="completeAlert('${escapeHtml(alert.id)}')">${escapeHtml(alert.actionLabel)}</button><button type="button" class="secondary-button" onclick="bypassAlert('${escapeHtml(alert.id)}')">Remind Me Later</button></div></article>`;
}
function refreshAlerts() {
  const current = buildCurrentAlerts();
  const history = getAlertHistory();
  byId("alertCountBadge").textContent = String(current.length);
  byId("alertCountBadge").hidden = current.length === 0;
  byId("alertSummary").innerHTML = current.length ? `<strong>${current.length} active reminder${current.length === 1 ? "" : "s"}</strong> — reminders stay open until completed.` : "<strong>No active reminders.</strong>";
  byId("activeAlerts").innerHTML = current.length ? current.map(a => alertCard(a, history)).join("") : '<p class="empty-message">Everything is current.</p>';
  const completed = Object.entries(history).filter(([,v]) => v.completedAt).sort((a,b) => new Date(b[1].completedAt)-new Date(a[1].completedAt));
  byId("completedAlerts").innerHTML = completed.length ? completed.map(([id,item]) => `<article class="alert-card completed"><div><span class="alert-type">Completed</span><h3>${escapeHtml(item.completedTitle || id)}</h3><p>Completed ${new Date(item.completedAt).toLocaleString()}</p><small>Bypassed ${item.bypassCount || 0} time(s) before completion.</small>${item.proof?.dataUrl ? `<a class="proof-link" href="${item.proof.dataUrl}" download="${escapeHtml(item.proof.name||"completion-proof")}">View completion proof</a>` : ""}</div></article>`).join("") : '<p class="empty-message">No completed alerts yet.</p>';
}



function intelligenceDateInPeriod(value, period) {
  if (period === "all") return true;
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  const today = normalizeDate(new Date());
  if (period === "30") return date >= addDays(today, -29) && date <= today;
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function equipmentDisplayName(key, item) {
  const parts = key.split("_");
  const typeIndex = Number(parts[1]);
  const unitIndex = Number(parts[2]);
  return item.name || `${equipmentTypes[typeIndex] || "Equipment"} ${unitIndex + 1}`;
}

function renderIntelligence() {
  // Intelligence now lives on the Home dashboard.
  refreshHomeDashboard();
  renderMaintenanceCalendar();
}

function initializeOperationsExpansion() {
  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  byId("scheduleAnchorDate").addEventListener("change", (event) => {
    saveSchedule();
    const parts = event.target.value.split("-").map(Number);
    if (parts.length === 3) {
      const requested = new Date(parts[0], parts[1] - 1, parts[2]);
      scheduleAnchor = requested < earliestScheduleDate() ? earliestScheduleDate() : requested;
    }
    renderSchedule();
  });
  byId("pdfModal").addEventListener("click", (event) => { if (event.target === byId("pdfModal")) closePdfPreview(); });
  scheduleAnchor = normalizeDate(new Date());
  byId("scheduleAnchorDate").min = dateKey(earliestScheduleDate());
  renderSchedule();
  renderMaintenanceRecords();
  renderIntelligence();
  refreshAlerts();
}

/* Paradise Operations Suite 2.0 modules */
const CUSTOMER_STORAGE_KEY = "paradise_customers_v2";
const EMPLOYEE_STORAGE_KEY = "paradise_employees_v2";
const EXPENSE_STORAGE_KEY = "paradise_operating_expenses_v2";
const INVENTORY_STORAGE_KEY = "paradise_inventory_v2";
const QUOTE_STORAGE_KEY = "paradise_quotes_v2";
const PAYROLL_STORAGE_KEY = "paradise_payroll_v2";
const DASHBOARD_ORDER_KEY = "paradise_dashboard_order_v3";
const MAINT_CALENDAR_KEY = "paradise_maintenance_calendar_v3";
let pendingProofAlertId = null;
let activeCustomerId = null;
let activeEmployeeId = null;
let activeQuoteId = null;

function readArray(key) {
  try { const data = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(data) ? data : []; }
  catch (error) { console.error(error); return []; }
}
function writeArray(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function formatDateLong(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "—"; }

function migratePreferredContactsV319() {
  const customers = readArray(CUSTOMER_STORAGE_KEY);
  let customersChanged = false;
  customers.forEach((customer) => {
    const preferredContact = preferredContactForRecord(customer);
    if (customer.preferredContact !== preferredContact) {
      customer.preferredContact = preferredContact;
      customersChanged = true;
    }
  });
  if (customersChanged) writeArray(CUSTOMER_STORAGE_KEY, customers);

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const quotes = readArray(QUOTE_STORAGE_KEY);
  let quotesChanged = false;
  quotes.forEach((quote) => {
    const linkedCustomer = customerMap.get(quote.customerId);
    const preferredContact = linkedCustomer ? preferredContactForRecord(linkedCustomer) : preferredContactForRecord(quote);
    if (quote.preferredContact !== preferredContact) {
      quote.preferredContact = preferredContact;
      quotesChanged = true;
    }
  });
  if (quotesChanged) writeArray(QUOTE_STORAGE_KEY, quotes);

  const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));
  const invoices = getSavedInvoices();
  let invoicesChanged = false;
  invoices.forEach((invoice) => {
    const linkedCustomer = customerMap.get(invoice.customerId);
    const linkedQuote = quoteMap.get(invoice.quoteId);
    const preferredContact = linkedCustomer
      ? preferredContactForRecord(linkedCustomer)
      : preferredContactForRecord(linkedQuote, preferredContactForRecord(invoice));
    if (invoice.preferredContact !== preferredContact) {
      invoice.preferredContact = preferredContact;
      invoicesChanged = true;
    }
  });
  if (invoicesChanged) storeInvoices(invoices);
}

function migrateInvoicePaymentMethodsV320() {
  const invoices = getSavedInvoices();
  let changed = false;
  invoices.forEach((invoice) => {
    const paymentCode = normalizePaymentCode(invoice.paymentCode, invoice.paymentMethod, invoice.paymentRate);
    const definition = PAYMENT_METHODS[paymentCode] || PAYMENT_METHODS.cash;
    if (invoice.paymentCode !== paymentCode || invoice.paymentMethod !== definition.label || Number(invoice.paymentRate || 0) !== definition.rate) {
      invoice.paymentCode = paymentCode;
      invoice.paymentMethod = definition.label;
      invoice.paymentRate = String(definition.rate);
      changed = true;
    }
  });
  if (changed) storeInvoices(invoices);
}


/* Revision 5 address-field bridges */
function splitAddressForFieldsV321(value="") {
  const text=String(value||"").trim();
  if(!text)return {street:"",city:"",state:"",zip:""};
  const parts=text.split(",").map(x=>x.trim()).filter(Boolean);
  let street=parts.shift()||"",city=parts.shift()||"",state="",zip="";
  const tail=parts.join(" ") || (city && /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(city) ? city : "");
  if(tail===city)city="";
  const match=tail.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i);
  if(match){state=match[1].toUpperCase();zip=match[2];}
  return {street,city,state,zip};
}
function composeAddressV321(street,city,state,zip){
  const locality=[String(city||"").trim(),String(state||"").trim().toUpperCase(),String(zip||"").trim()].filter(Boolean).join(" ");
  return [String(street||"").trim(),locality].filter(Boolean).join(", ");
}
function syncInvoiceAddressFieldsV321(){
  if(!byId("cityStateZip"))return;
  byId("cityStateZip").value=[byId("invoiceBillingCity")?.value.trim(),byId("invoiceBillingState")?.value.trim().toUpperCase(),byId("invoiceBillingZip")?.value.trim()].filter(Boolean).join(" ");
}
function loadInvoiceAddressFieldsV321(){
  const combined=[byId("billingAddress")?.value,byId("cityStateZip")?.value].filter(Boolean).join(", ");
  const a=splitAddressForFieldsV321(combined);
  if(byId("invoiceBillingCity"))byId("invoiceBillingCity").value=a.city;
  if(byId("invoiceBillingState"))byId("invoiceBillingState").value=a.state;
  if(byId("invoiceBillingZip"))byId("invoiceBillingZip").value=a.zip;
}
function syncQuoteAddressFieldsV321(){
  if(byId("quoteAddress"))byId("quoteAddress").value=composeAddressV321(byId("quoteStreet")?.value,byId("quoteCity")?.value,byId("quoteState")?.value,byId("quoteZip")?.value);
}
function loadQuoteAddressFieldsV321(value){
  const a=splitAddressForFieldsV321(value);
  if(byId("quoteStreet"))byId("quoteStreet").value=a.street;
  if(byId("quoteCity"))byId("quoteCity").value=a.city;
  if(byId("quoteState"))byId("quoteState").value=a.state;
  if(byId("quoteZip"))byId("quoteZip").value=a.zip;
  syncQuoteAddressFieldsV321();
}

/* Customer and property records */
function parseCustomerBillingAddress(customer = {}) {
  if (customer.billingStreet || customer.billingCity || customer.billingState || customer.billingZip) {
    return {
      street: customer.billingStreet || customer.billing || "",
      city: customer.billingCity || "",
      state: customer.billingState || "",
      zip: customer.billingZip || ""
    };
  }
  const legacy = String(customer.billing || "").trim();
  return { street: legacy, city: "", state: "", zip: "" };
}

function customerBillingAddressFromForm() {
  return {
    street: byId("customerBilling")?.value.trim() || "",
    city: byId("customerCity")?.value.trim() || "",
    state: byId("customerState")?.value.trim().toUpperCase() || "",
    zip: byId("customerZip")?.value.trim() || ""
  };
}

function formatCustomerBillingAddress(address = {}) {
  const locality = [address.city, address.state, address.zip].filter(Boolean).join(" ");
  return [address.street, locality].filter(Boolean).join(", ");
}

function blankCustomerForm() {
  activeCustomerId = null;
  ["customerId","customerName","customerBusiness","customerPhone","customerEmail","customerBilling","customerCity","customerState","customerZip","customerNotes"].forEach(id => { if(byId(id)) byId(id).value=""; });
  PreferredContactComponent.setValue("customerPreferredContact", "Phone");
  syncPreferredContactCheckboxes("customerPreferredContact");
  if (byId("propertyRows")) byId("propertyRows").innerHTML = "";
  addPropertyRow();
}
function newCustomer(){ blankCustomerForm(); }
function propertyTypeForRecord(data={}) {
  const explicit = String(data.type || data.propertyType || "").trim();
  if (["Residential","Commercial","HOA"].includes(explicit)) return explicit;
  if (String(data.hoa || "").trim()) return "HOA";
  if (/commercial|office|shop|store|business/i.test(String(data.name || ""))) return "Commercial";
  return "Residential";
}
function mowingHeightOptions(selected="") {
  const values=[];
  for(let value=1;value<=6;value+=0.5) values.push(value.toFixed(value % 1 ? 1 : 0));
  return '<option value="">Select height</option>'+values.map(value=>`<option value="${value}" ${String(selected)===value?'selected':''}>${value}&quot;</option>`).join("");
}
function updatePropertyTypeVisibility(row) {
  const type=row.querySelector(".prop-type")?.value || "Residential";
  row.dataset.propertyType=type;
  row.querySelectorAll(".hoa-only").forEach(element=>{ element.hidden=type!=="HOA"; });
}
function addPropertyRow(data={}) {
  const host=byId("propertyRows"); if(!host) return;
  const row=document.createElement("div"); row.className="property-row section";
  const type=propertyTypeForRecord(data);
  row.innerHTML=`<div class="property-row-head"><strong>Property / Job Site</strong><button type="button" class="remove-entry" aria-label="Remove property" onclick="this.closest('.property-row').remove()">×</button></div>
  <div class="property-primary-grid"><div><label>Property Name</label><input class="prop-name" value="${escapeHtml(data.name||"")}" placeholder="Smith Residence"></div><div><label>Property Type</label><select class="prop-type"><option ${type==="Residential"?"selected":""}>Residential</option><option ${type==="Commercial"?"selected":""}>Commercial</option><option ${type==="HOA"?"selected":""}>HOA</option></select></div></div>
  ${(()=>{const a=splitAddressForFieldsV321(data.address||"");return `<div class="property-address-grid"><div class="property-street-field"><label>Service Address</label><input class="prop-street" value="${escapeHtml(a.street)}" autocomplete="street-address"></div><div><label>City</label><input class="prop-city" value="${escapeHtml(a.city)}" autocomplete="address-level2"></div><div><label>State</label><input class="prop-state" value="${escapeHtml(a.state)}" maxlength="2" autocomplete="address-level1"></div><div><label>ZIP</label><input class="prop-zip" value="${escapeHtml(a.zip)}" inputmode="numeric" maxlength="10" autocomplete="postal-code"></div><input class="prop-address" type="hidden" value="${escapeHtml(data.address||"")}"></div>`;})()}
  <div class="property-compact-grid"><div><label>Gate Code</label><input class="prop-gate compact-code" value="${escapeHtml(data.gateCode||"")}"></div><div><label>Preferred Mowing Height</label><select class="prop-height compact-height">${mowingHeightOptions(data.mowingHeight||"")}</select></div><div class="hoa-only"><label>HOA / Time Restrictions</label><input class="prop-hoa compact-restriction" value="${escapeHtml(data.hoa||"")}"></div></div>
  <div class="row"><div><label>Dog / Safety Warnings</label><input class="prop-warning" value="${escapeHtml(data.warning||"")}"></div><div><label>Irrigation / Sprinkler Notes</label><input class="prop-irrigation" value="${escapeHtml(data.irrigation||"")}"></div></div>
  <label>Property Instructions</label><textarea class="prop-notes" rows="2">${escapeHtml(data.notes||"")}</textarea><div class="compact-actions"><button type="button" onclick="openPropertyMap(this)">Open Map</button></div>`;
  host.appendChild(row);
  row.querySelector(".prop-type")?.addEventListener("change",()=>updatePropertyTypeVisibility(row));
  row.querySelectorAll(".prop-street,.prop-city,.prop-state,.prop-zip").forEach(field=>field.addEventListener("input",()=>{row.querySelector(".prop-address").value=composeAddressV321(row.querySelector(".prop-street").value,row.querySelector(".prop-city").value,row.querySelector(".prop-state").value,row.querySelector(".prop-zip").value);}));
  updatePropertyTypeVisibility(row);
}
function collectProperties(){ return Array.from(document.querySelectorAll(".property-row")).map(r=>({name:r.querySelector(".prop-name").value.trim(),type:r.querySelector(".prop-type").value,address:r.querySelector(".prop-address").value.trim(),gateCode:r.querySelector(".prop-gate").value.trim(),mowingHeight:r.querySelector(".prop-height").value.trim(),hoa:r.querySelector(".prop-hoa")?.value.trim()||"",warning:r.querySelector(".prop-warning").value.trim(),irrigation:r.querySelector(".prop-irrigation").value.trim(),notes:r.querySelector(".prop-notes").value.trim()})).filter(p=>p.name||p.address); }
function openPropertyMap(button){ const row=button.closest(".property-row"); const address=composeAddressV321(row.querySelector(".prop-street")?.value,row.querySelector(".prop-city")?.value,row.querySelector(".prop-state")?.value,row.querySelector(".prop-zip")?.value)||row.querySelector(".prop-address").value.trim(); if(!address){alert("Enter a property address first.");return;} window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,"_blank","noopener"); }
function saveCustomer(){
  const name=byId("customerName").value.trim(), business=byId("customerBusiness").value.trim();
  if(!name&&!business){alert("Enter a customer or business name.");return;}
  const list=readArray(CUSTOMER_STORAGE_KEY); const id=activeCustomerId||makeId("customer");
  const i=list.findIndex(x=>x.id===id),previous=i>=0?list[i]:null;
  const billingAddress=customerBillingAddressFromForm();
  const item={...previous,id,name,business,phone:byId("customerPhone").value.trim(),email:byId("customerEmail").value.trim(),preferredContact:PreferredContactComponent.sync("customerPreferredContact"),billing:formatCustomerBillingAddress(billingAddress),billingStreet:billingAddress.street,billingCity:billingAddress.city,billingState:billingAddress.state,billingZip:billingAddress.zip,notes:byId("customerNotes").value.trim(),properties:collectProperties(),createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(i>=0)list[i]=item;else list.push(item);writeArray(CUSTOMER_STORAGE_KEY,list); activeCustomerId=id; setCustomerPreferredContactEverywhere(id,item.preferredContact,"customerPreferredContact"); renderCustomerList(); populateCustomerSelectors(); if(typeof renderCommunicationRecipients==="function")renderCommunicationRecipients(); alert("Customer saved.");
}
function renderCustomerList(){ const host=byId("customerList"); if(!host)return; const q=(byId("customerSearch")?.value||"").toLowerCase(); const list=readArray(CUSTOMER_STORAGE_KEY).filter(c=>JSON.stringify(c).toLowerCase().includes(q)); host.innerHTML=list.length?list.map(c=>`<button type="button" class="record-card" onclick="loadCustomer('${c.id}')"><strong>${escapeHtml(c.name||c.business)}</strong><span>${escapeHtml(c.phone||c.email||"No contact entered")}</span><small>${c.properties?.length||0} propert${(c.properties?.length||0)===1?"y":"ies"}</small></button>`).join(""):'<p class="empty-message">No customers saved.</p>'; }
function loadCustomer(id){ const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===id); if(!c)return; activeCustomerId=id; const address=parseCustomerBillingAddress(c); byId("customerId").value=id; byId("customerName").value=c.name||"";byId("customerBusiness").value=c.business||"";byId("customerPhone").value=c.phone||"";byId("customerEmail").value=c.email||"";PreferredContactComponent.setValue("customerPreferredContact",preferredContactForRecord(c));syncPreferredContactCheckboxes("customerPreferredContact");byId("customerBilling").value=address.street;byId("customerCity").value=address.city;byId("customerState").value=address.state;byId("customerZip").value=address.zip;byId("customerNotes").value=c.notes||"";byId("propertyRows").innerHTML="";(c.properties?.length?c.properties:[{}]).forEach(addPropertyRow); renderCustomerInvoiceHistory(); }
function deleteCurrentCustomer(){ if(!activeCustomerId)return; if(!confirm("Delete this customer and property records?"))return; writeArray(CUSTOMER_STORAGE_KEY,readArray(CUSTOMER_STORAGE_KEY).filter(c=>c.id!==activeCustomerId)); communicationSelectedCustomerIds.delete(activeCustomerId); blankCustomerForm();renderCustomerList();populateCustomerSelectors();populateInvoiceLinkSelectors();renderCommunicationRecipients(); }
function populateCustomerSelectors(){ const list=readArray(CUSTOMER_STORAGE_KEY); const options='<option value="">Select customer</option>'+list.map(c=>`<option value="${c.id}">${escapeHtml(c.name||c.business)}</option>`).join(""); ["quoteCustomer"].forEach(id=>{const el=byId(id);if(el){const old=el.value;el.innerHTML=options;el.value=old;}}); }
function populateQuoteProperties(){ const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===byId("quoteCustomer").value); byId("quoteProperty").innerHTML='<option value="">Select property</option>'+(c?.properties||[]).map((p,i)=>`<option value="${i}">${escapeHtml(p.name||p.address||`Property ${i+1}`)}</option>`).join(""); }

/* v3.19 Communication Center */
const communicationSelectedCustomerIds = new Set();
const COMMUNICATION_TEMPLATES = Object.freeze({
  weather: {
    subject: "Paradise Lawn Care Weather Delay",
    body: "Weather may delay your scheduled lawn service. We will keep you updated and complete the work as soon as conditions allow. Thank you for your patience."
  },
  holiday: {
    subject: "Paradise Lawn Care Holiday Schedule",
    body: "Paradise Lawn Care is adjusting the service schedule for the upcoming holiday. We will contact you if your regular service day changes."
  },
  payment: {
    subject: "Paradise Lawn Care Payment Reminder",
    body: "This is a friendly reminder that your Paradise Lawn Care invoice is still open. Please contact us if you need another copy or have any questions."
  },
  appointment: {
    subject: "Paradise Lawn Care Appointment Reminder",
    body: "This is a reminder of your upcoming Paradise Lawn Care service. Please make sure gates are accessible and pets are secured before our arrival."
  },
  completed: {
    subject: "Paradise Lawn Care Service Completed",
    body: "Your Paradise Lawn Care service has been completed. Thank you for trusting us to keep your property Paradise Perfect."
  },
  custom: { subject: "", body: "" }
});

function communicationCustomerFrequencies(customer) {
  const frequencies = new Set();
  readArray(QUOTE_STORAGE_KEY).filter((quote) => quote.customerId === customer.id).forEach((quote) => {
    frequencies.add(String(quote.frequency || "").toLowerCase().replace(/[\s-]+/g, ""));
  });
  frequencies.add(String(customer.billingMethod || "").toLowerCase().replace(/[\s-]+/g, ""));
  return frequencies;
}

function customerMatchesCommunicationAudience(customer, audience) {
  if (audience === "all" || audience === "selected") return true;
  const customerType = String(customer.customerType || customer.type || (customer.business ? "commercial" : "residential")).toLowerCase();
  if (audience === "residential" || audience === "commercial") return customerType === audience;
  const frequencies = communicationCustomerFrequencies(customer);
  if (audience === "weekly") return frequencies.has("weekly");
  if (audience === "biweekly") return frequencies.has("biweekly");
  if (audience === "monthly") return frequencies.has("monthly");
  return true;
}

function communicationVisibleCustomers() {
  const audience = byId("communicationAudience")?.value || "all";
  const search = (byId("communicationSearch")?.value || "").trim().toLowerCase();
  return readArray(CUSTOMER_STORAGE_KEY)
    .filter((customer) => customerMatchesCommunicationAudience(customer, audience))
    .filter((customer) => !search || JSON.stringify(customer).toLowerCase().includes(search))
    .sort((a, b) => String(a.name || a.business || "").localeCompare(String(b.name || b.business || "")));
}

function communicationChosenCustomers() {
  const customerMap = new Map(readArray(CUSTOMER_STORAGE_KEY).map((customer) => [customer.id, customer]));
  return [...document.querySelectorAll("#communicationRecipients [data-communication-customer]:checked")]
    .map((input) => customerMap.get(input.dataset.communicationCustomer))
    .filter(Boolean);
}

function updateCommunicationCounts() {
  const counts = { Phone: 0, Text: 0, Email: 0, "Smoke Signal": 0 };
  communicationChosenCustomers().forEach((customer) => {
    counts[preferredContactForRecord(customer)] += 1;
  });
  if (byId("communicationPhoneCount")) byId("communicationPhoneCount").textContent = `${counts.Phone} Phone`;
  if (byId("communicationTextCount")) byId("communicationTextCount").textContent = `${counts.Text} Text`;
  if (byId("communicationEmailCount")) byId("communicationEmailCount").textContent = `${counts.Email} Email`;
  if (byId("communicationSmokeCount")) byId("communicationSmokeCount").textContent = `${counts["Smoke Signal"]} Smoke Signal`;
  return counts;
}

function renderCommunicationRecipients() {
  const host = byId("communicationRecipients");
  if (!host) return;
  const audience = byId("communicationAudience")?.value || "all";
  const customers = communicationVisibleCustomers();
  host.innerHTML = customers.length ? customers.map((customer) => {
    const preferred = preferredContactForRecord(customer);
    const checked = audience === "selected" ? communicationSelectedCustomerIds.has(customer.id) : true;
    const contact = [customer.phone, customer.email].filter(Boolean).join(" · ") || "No phone or email saved";
    const address = customer.properties?.[0]?.address || customer.billing || "No address saved";
    const actionClass=(method)=>preferred===method?" class=\"is-preferred-action\"":"";
    return `<article class="communication-recipient ${checked ? "is-selected" : ""}" data-communication-row="${escapeHtml(customer.id)}">
      <label class="communication-recipient-choice">
        <input type="checkbox" data-communication-customer="${escapeHtml(customer.id)}" ${checked ? "checked" : ""}>
        <span class="communication-recipient-details"><strong>${escapeHtml(customer.name || customer.business || "Customer")}</strong><span>${escapeHtml(contact)}</span><small>${escapeHtml(address)}</small><span class="communication-method-badge">Preferred: ${escapeHtml(preferred)}</span></span>
      </label>
      <div class="communication-recipient-actions">
        <button type="button"${actionClass("Phone")} data-communication-action="Phone" data-customer-id="${escapeHtml(customer.id)}"><span class="contact-action-icon" aria-hidden="true">☎</span><span>Call</span></button>
        <button type="button"${actionClass("Text")} data-communication-action="Text" data-customer-id="${escapeHtml(customer.id)}"><span class="contact-action-icon" aria-hidden="true">▣</span><span>Text</span></button>
        <button type="button"${actionClass("Email")} data-communication-action="Email" data-customer-id="${escapeHtml(customer.id)}"><span class="contact-action-icon" aria-hidden="true">✉</span><span>Email</span></button>
        <button type="button"${actionClass("Smoke Signal")} data-communication-action="Smoke Signal" data-customer-id="${escapeHtml(customer.id)}"><span class="contact-action-icon" aria-hidden="true">♨</span><span>Smoke Signal</span></button>
      </div>
    </article>`;
  }).join("") : '<p class="empty-message">No customers match this audience and search.</p>';

  host.querySelectorAll("[data-communication-customer]").forEach((input) => {
    input.addEventListener("change", () => {
      if (audience === "selected") {
        if (input.checked) communicationSelectedCustomerIds.add(input.dataset.communicationCustomer);
        else communicationSelectedCustomerIds.delete(input.dataset.communicationCustomer);
      }
      input.closest(".communication-recipient")?.classList.toggle("is-selected", input.checked);
      updateCommunicationCounts();
    });
  });
  host.querySelectorAll("[data-communication-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const method = button.dataset.communicationAction === "preferred" ? null : button.dataset.communicationAction;
      prepareCustomerCommunication(button.dataset.customerId, method, button);
    });
  });
  updateCommunicationCounts();
}

function communicationMessage() {
  return {
    subject: byId("communicationSubject")?.value.trim() || "Paradise Lawn Care",
    body: byId("communicationBody")?.value.trim() || "A message from Paradise Lawn Care."
  };
}

function setCommunicationStatus(message) {
  if (byId("communicationStatus")) byId("communicationStatus").textContent = message;
}

function prepareCustomerCommunication(customerId, overrideMethod, sourceElement) {
  const customer = readArray(CUSTOMER_STORAGE_KEY).find((item) => item.id === customerId);
  if (!customer) return;
  const method = normalizePreferredContact(overrideMethod || preferredContactForRecord(customer));
  const message = communicationMessage();
  if (method === "Smoke Signal") {
    setCommunicationStatus(`Opening Smoke Signal for ${customer.name || customer.business || "customer"}.`);
    openSmokeSignal(sourceElement);
    return;
  }
  if (method === "Email") {
    return launchEmailV319(
      customer.email,
      message.subject,
      message.body,
      `${customer.name || customer.business || "Customer"} does not have a valid email address saved.`,
      setCommunicationStatus
    );
  }
  if (method === "Text") {
    return launchTextV319(
      customer.phone,
      message.body,
      `${customer.name || customer.business || "Customer"} does not have a valid phone number saved.`,
      setCommunicationStatus
    );
  }
  return launchPhoneV319(
    customer.phone,
    `${customer.name || customer.business || "Customer"} does not have a valid phone number saved.`,
    setCommunicationStatus
  );
}

function prepareMassEmail(customers = communicationChosenCustomers()) {
  const chosen = Array.isArray(customers) ? customers : communicationChosenCustomers();
  const emails = [...new Set(chosen.map((customer) => customer.email?.trim()).filter(Boolean))];
  if (!emails.length) {
    setCommunicationStatus("None of the selected customers have an email address.");
    return;
  }
  const message = communicationMessage();
  setCommunicationStatus(`Prepared an email for ${emails.length} customer${emails.length === 1 ? "" : "s"}.`);
  openDeviceLinkV319(`mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`);
}

function prepareMassText(customers = communicationChosenCustomers()) {
  const chosen = Array.isArray(customers) ? customers : communicationChosenCustomers();
  const phones = [...new Set(chosen.map((customer) => String(customer.phone || "").replace(/\D/g, "")).filter(Boolean))];
  if (!phones.length) {
    setCommunicationStatus("None of the selected customers have a phone number.");
    return;
  }
  const message = communicationMessage();
  setCommunicationStatus(`Prepared a text for ${phones.length} customer${phones.length === 1 ? "" : "s"}.`);
  openDeviceLinkV319(`sms:${phones.join(",")}?body=${encodeURIComponent(message.body)}`);
}

function preparePreferredCommunications(sourceElement) {
  const customers = communicationChosenCustomers();
  if (!customers.length) {
    setCommunicationStatus("Select at least one customer.");
    return;
  }
  if (customers.length === 1) {
    if (preferredContactForRecord(customers[0]) === "Smoke Signal") {
      updateCommunicationCounts();
      setCommunicationStatus("Smoke Signal was not launched. Use this customer's individual Smoke Signal action; mass communications never launch it automatically.");
      return;
    }
    prepareCustomerCommunication(customers[0].id, null, sourceElement);
    return;
  }
  const groups = new Map(PREFERRED_CONTACT_METHODS.map((method) => [method.value, []]));
  customers.forEach((customer) => groups.get(preferredContactForRecord(customer)).push(customer));
  const activeMethods = [...groups.entries()].filter(([, list]) => list.length);
  if (activeMethods.length === 1 && activeMethods[0][0] === "Email") {
    prepareMassEmail(activeMethods[0][1]);
    return;
  }
  if (activeMethods.length === 1 && activeMethods[0][0] === "Text") {
    prepareMassText(activeMethods[0][1]);
    return;
  }
  const counts = updateCommunicationCounts();
  setCommunicationStatus(`Preferences applied: ${counts.Phone} Phone, ${counts.Text} Text, ${counts.Email} Email, and ${counts["Smoke Signal"]} Smoke Signal. Use the individual actions or Email/Text override buttons. Smoke Signal was not launched.`);
}

function applyCommunicationTemplate() {
  const template = COMMUNICATION_TEMPLATES[byId("communicationTemplate")?.value] || COMMUNICATION_TEMPLATES.custom;
  if (byId("communicationTemplate")?.value !== "custom") {
    byId("communicationSubject").value = template.subject;
    byId("communicationBody").value = template.body;
  }
}

async function copyCommunicationMessage() {
  const message = communicationMessage();
  const text = `${message.subject}\n\n${message.body}`;
  try {
    await navigator.clipboard.writeText(text);
    setCommunicationStatus("The message was copied.");
  } catch (_) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    setCommunicationStatus("The message was copied.");
  }
}

function currentQuoteForCommunicationV319() {
  const customer = (typeof quoteSelectedCustomerV318 === "function" ? quoteSelectedCustomerV318() : null)
    || readArray(CUSTOMER_STORAGE_KEY).find((item) => item.id === byId("quoteCustomer")?.value);
  return {
    number: byId("quoteNumber")?.value || "Quote",
    customerName: customer?.name || customer?.business || "Customer",
    phone: byId("quotePhone")?.value || customer?.phone || "",
    email: byId("quoteEmail")?.value || customer?.email || "",
    amount: cleanMoney(byId("quoteAmount")?.value),
    scope: byId("quoteScope")?.value.trim() || "lawn care service"
  };
}

function buildQuoteMessageV319(quote) {
  return `Paradise Lawn Care quote ${quote.number} for ${quote.customerName}. ${quote.scope}. Estimated total: ${formatMoney(quote.amount)}. Please contact us with any questions.`;
}

function emailQuote() {
  const quote = currentQuoteForCommunicationV319();
  return launchEmailV319(
    quote.email,
    `Paradise Lawn Care Quote ${quote.number}`,
    buildQuoteMessageV319(quote),
    "Please add the customer's email address before emailing this quote."
  );
}

function textQuote() {
  const quote = currentQuoteForCommunicationV319();
  return launchTextV319(
    quote.phone,
    buildQuoteMessageV319(quote),
    "Please add the customer's phone number before texting this quote."
  );
}

function currentCustomerForCommunicationV319() {
  return {
    name: byId("customerName")?.value.trim() || byId("customerBusiness")?.value.trim() || "Customer",
    phone: byId("customerPhone")?.value || "",
    email: byId("customerEmail")?.value || ""
  };
}

function emailCustomer() {
  const customer = currentCustomerForCommunicationV319();
  return launchEmailV319(
    customer.email,
    "A message from Paradise Lawn Care",
    `Hello ${customer.name},\n\nThis is Paradise Lawn Care. Please contact us when convenient.\n\nThank you.`,
    "Please add the customer's email address before opening an email."
  );
}

function textCustomer() {
  const customer = currentCustomerForCommunicationV319();
  return launchTextV319(
    customer.phone,
    `Hello ${customer.name}, this is Paradise Lawn Care. Please contact us when convenient. Thank you.`,
    "Please add the customer's phone number before opening a text message."
  );
}

/* Employees and payroll */
function newEmployee(){
  activeEmployeeId=null;
  ["employeeId","employeeName","employeePhone","employeePayRate","employeeEmergency","employeeSkills","employeeEquipment","employeeNotes"].forEach(id=>byId(id).value="");
  byId("employeeStatus").value="Active";
  const list=byId("employeeList");
  if(list && !byId("newEmployeeNotice")) list.insertAdjacentHTML("afterbegin",'<div id="newEmployeeNotice" class="new-record-notice"><strong>New employee record started.</strong><br>Enter the employee information and select Save Employee.</div>');
  byId("employeeName").focus();
}
function saveEmployee(){ const name=byId("employeeName").value.trim();if(!name){alert("Enter an employee name.");return;}const list=readArray(EMPLOYEE_STORAGE_KEY);const id=activeEmployeeId||makeId("employee");const item={id,name,status:byId("employeeStatus").value,phone:byId("employeePhone").value.trim(),payRate:Number(byId("employeePayRate").value)||0,emergency:byId("employeeEmergency").value.trim(),skills:byId("employeeSkills").value.trim(),equipment:byId("employeeEquipment").value.trim(),notes:byId("employeeNotes").value.trim()};const i=list.findIndex(x=>x.id===id);if(i>=0)list[i]=item;else list.push(item);writeArray(EMPLOYEE_STORAGE_KEY,list);activeEmployeeId=id;renderEmployees();populateEmployeeSelectors();alert("Employee saved."); }
function renderEmployees(){ const host=byId("employeeList");if(!host)return;const list=readArray(EMPLOYEE_STORAGE_KEY);host.innerHTML=list.length?list.map(e=>`<button type="button" class="record-card" onclick="loadEmployee('${e.id}')"><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.status)} · ${formatMoney(e.payRate)}/hr</span><small>${escapeHtml(e.phone||e.skills||"No details")}</small></button>`).join(""):'<p class="empty-message">No employees saved.</p>';renderPayrollList(); }
function loadEmployee(id){const e=readArray(EMPLOYEE_STORAGE_KEY).find(x=>x.id===id);if(!e)return;activeEmployeeId=id;byId("employeeId").value=id;byId("employeeName").value=e.name||"";byId("employeeStatus").value=e.status||"Active";byId("employeePhone").value=e.phone||"";byId("employeePayRate").value=e.payRate||"";byId("employeeEmergency").value=e.emergency||"";byId("employeeSkills").value=e.skills||"";byId("employeeEquipment").value=e.equipment||"";byId("employeeNotes").value=e.notes||""; }
function populateEmployeeSelectors(){const list=readArray(EMPLOYEE_STORAGE_KEY);const el=byId("payrollEmployee");if(el)el.innerHTML='<option value="">Employee</option>'+list.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("");}
function savePayrollExpense(){const employeeId=byId("payrollEmployee").value;const emp=readArray(EMPLOYEE_STORAGE_KEY).find(e=>e.id===employeeId);if(!employeeId||!byId("payrollDate").value){alert("Choose a date and employee.");return;}const hours=Number(byId("payrollHours").value)||0;let amount=Number(byId("payrollAmount").value)||0;if(!amount&&emp)amount=hours*Number(emp.payRate||0);const list=readArray(PAYROLL_STORAGE_KEY);list.push({id:makeId("payroll"),date:byId("payrollDate").value,employeeId,employeeName:emp?.name||"Employee",hours,amount});writeArray(PAYROLL_STORAGE_KEY,list);renderPayrollList();renderIntelligence();refreshHomeDashboard();}
function renderPayrollList(){const host=byId("payrollList");if(!host)return;const list=readArray(PAYROLL_STORAGE_KEY).sort((a,b)=>b.date.localeCompare(a.date));host.innerHTML=list.length?list.slice(0,20).map(x=>`<div class="record-line"><span>${escapeHtml(formatDateLong(x.date))}</span><strong>${escapeHtml(x.employeeName)}</strong><span>${x.hours} hrs</span><span>${formatMoney(x.amount)}</span><button type="button" class="delete-mini" onclick="deleteArrayRecord('${PAYROLL_STORAGE_KEY}','${x.id}',renderPayrollList)">×</button></div>`).join(""):'<p class="empty-message">No payroll expenses recorded.</p>';}

/* Operating expenses and inventory */
function buildEquipmentOptions(){ const data=getMaintenanceData();return '<option value="General Operations">General Operations</option>'+Object.entries(data).map(([key,item])=>`<option value="${escapeHtml(equipmentDisplayName(key,item))}">${escapeHtml(equipmentDisplayName(key,item))}</option>`).join(""); }
function refreshEquipmentExpenseOptions(){const el=byId("expenseEquipment");if(el)el.innerHTML=buildEquipmentOptions();}
function calculateExpenseTotal(){const qty=Number(byId("expenseQuantity")?.value)||0,unit=Number(byId("expenseUnitPrice")?.value)||0;if(qty&&unit)byId("expenseTotal").value=(qty*unit).toFixed(2);}
function saveOperatingExpense(){const date=byId("expenseDate").value,total=Number(byId("expenseTotal").value)||0;if(!date||!total){alert("Enter an expense date and total cost.");return;}const list=readArray(EXPENSE_STORAGE_KEY);list.push({id:makeId("expense"),date,category:byId("expenseCategory").value,description:byId("expenseDescription").value.trim(),equipment:byId("expenseEquipment").value,vendor:byId("expenseVendor").value.trim(),quantity:Number(byId("expenseQuantity").value)||0,unitPrice:Number(byId("expenseUnitPrice").value)||0,total,payment:byId("expensePayment").value,reference:byId("expenseReference").value.trim(),notes:byId("expenseNotes").value.trim()});writeArray(EXPENSE_STORAGE_KEY,list);["expenseDescription","expenseVendor","expenseQuantity","expenseUnitPrice","expenseTotal","expenseReference","expenseNotes"].forEach(id=>byId(id).value="");renderOperatingExpenses();renderIntelligence();refreshHomeDashboard();}
function renderOperatingExpenses(){const host=byId("operatingExpenseList");if(!host)return;const list=readArray(EXPENSE_STORAGE_KEY).sort((a,b)=>b.date.localeCompare(a.date));host.innerHTML=list.length?list.slice(0,100).map(x=>`<div class="record-line expense-line"><span>${escapeHtml(formatDateLong(x.date))}</span><strong>${escapeHtml(x.category)}</strong><span>${escapeHtml(x.description||x.vendor||x.equipment)}</span><span>${formatMoney(x.total)}</span><button type="button" class="delete-mini" onclick="deleteArrayRecord('${EXPENSE_STORAGE_KEY}','${x.id}',renderOperatingExpenses)">×</button></div>`).join(""):'<p class="empty-message">No operating expenses recorded.</p>';}
function deleteArrayRecord(key,id,callback){if(!confirm("Delete this record?"))return;writeArray(key,readArray(key).filter(x=>x.id!==id));callback();renderIntelligence();refreshHomeDashboard();}
function defaultInventory(){return ["Engine Oil","Oil Filters","Air Filters","Weed Eater String","Mower Blades","Belts","Spark Plugs","Cleaning Supplies"].map((name,i)=>({id:makeId("stock"),name,category:"Supplies",quantity:0,reorderAt:i===3?2:1,unit:i===3?"spools":"each",cost:0}));}
function getInventory(){let list=readArray(INVENTORY_STORAGE_KEY);if(!list.length){list=defaultInventory();writeArray(INVENTORY_STORAGE_KEY,list);}return list;}
function renderInventory(){const host=byId("inventoryTable");if(!host)return;host.innerHTML=`<div class="inventory-grid inventory-head"><strong>Item</strong><strong>Category</strong><strong>On Hand</strong><strong>Reorder At</strong><strong>Unit</strong><strong>Unit Cost</strong><span></span></div>`+getInventory().map(x=>`<div class="inventory-grid inventory-row" data-id="${x.id}"><input class="inv-name" value="${escapeHtml(x.name)}"><input class="inv-category" value="${escapeHtml(x.category||"")}"><input class="inv-quantity" type="number" min="0" step="0.01" value="${x.quantity||0}"><input class="inv-reorder" type="number" min="0" step="0.01" value="${x.reorderAt||0}"><input class="inv-unit" value="${escapeHtml(x.unit||"")}"><input class="inv-cost" type="number" min="0" step="0.01" value="${x.cost||0}"><button type="button" class="remove-entry" onclick="this.closest('.inventory-row').remove()">×</button></div>`).join("");}
function addInventoryItem(){const list=getInventory();list.push({id:makeId("stock"),name:"New Item",category:"Supplies",quantity:0,reorderAt:1,unit:"each",cost:0});writeArray(INVENTORY_STORAGE_KEY,list);renderInventory();}
function saveInventory(){const list=Array.from(document.querySelectorAll(".inventory-row")).map(r=>({id:r.dataset.id||makeId("stock"),name:r.querySelector(".inv-name").value.trim(),category:r.querySelector(".inv-category").value.trim(),quantity:Number(r.querySelector(".inv-quantity").value)||0,reorderAt:Number(r.querySelector(".inv-reorder").value)||0,unit:r.querySelector(".inv-unit").value.trim(),cost:Number(r.querySelector(".inv-cost").value)||0})).filter(x=>x.name);writeArray(INVENTORY_STORAGE_KEY,list);refreshHomeDashboard();alert("Inventory saved.");}

/* Quotes */
function quoteSequence(){return `Q-${new Date().getFullYear()}-${String(readArray(QUOTE_STORAGE_KEY).length+1).padStart(4,"0")}`;}
function newQuote(){activeQuoteId=null;byId("quoteNumber").value=generateJobNumber();byId("quoteDate").value=getLocalDateString();byId("quoteValidThrough").value=getLocalDateString(addDays(new Date(),30));byId("quoteStatus").value="Draft";byId("quoteCustomer").value="";populateQuoteProperties();["quoteScope","quoteAmount","quoteNotes"].forEach(id=>byId(id).value="");renderQuotes();}
function saveQuote(){if(!byId("quoteCustomer").value){alert("Select a customer.");return;}const list=readArray(QUOTE_STORAGE_KEY);const id=activeQuoteId||makeId("quote");const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===byId("quoteCustomer").value);const p=c?.properties?.[Number(byId("quoteProperty").value)];const item={id,number:byId("quoteNumber").value,date:byId("quoteDate").value,validThrough:byId("quoteValidThrough").value,status:byId("quoteStatus").value,customerId:c?.id,customerName:c?.name||c?.business||"Customer",property:p||null,scope:byId("quoteScope").value.trim(),amount:Number(byId("quoteAmount").value)||0,frequency:byId("quoteFrequency").value,notes:""};const i=list.findIndex(x=>x.id===id);if(i>=0)list[i]=item;else list.push(item);writeArray(QUOTE_STORAGE_KEY,list);activeQuoteId=id;renderQuotes();alert("Quote saved.");}
function renderQuotes(){const host=byId("quoteList");if(!host)return;const list=readArray(QUOTE_STORAGE_KEY).sort((a,b)=>b.date.localeCompare(a.date));host.innerHTML=list.length?list.map(q=>`<button type="button" class="record-card" onclick="loadQuote('${q.id}')"><strong>${escapeHtml(q.number)} · ${escapeHtml(q.customerName)}</strong><span>${escapeHtml(q.status)} · ${formatMoney(q.amount)}</span><small>${escapeHtml(q.scope||q.frequency)}</small></button>`).join(""):'<p class="empty-message">No quotes saved.</p>';}
function loadQuote(id){const q=readArray(QUOTE_STORAGE_KEY).find(x=>x.id===id);if(!q)return;activeQuoteId=id;byId("quoteNumber").value=q.number;byId("quoteDate").value=q.date;byId("quoteValidThrough").value=q.validThrough;byId("quoteStatus").value=q.status;byId("quoteCustomer").value=q.customerId||"";populateQuoteProperties();const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===q.customerId);const pi=c?.properties?.findIndex(p=>p.address===q.property?.address);byId("quoteProperty").value=pi>=0?String(pi):"";byId("quoteScope").value=[q.scope,q.notes].filter(Boolean).join("\n\n");byId("quoteNotes").value="";byId("quoteAmount").value=q.amount||"";byId("quoteFrequency").value=q.frequency||"One Time";byId("quoteNotes").value=q.notes||"";renderQuoteAttachments();}
function convertQuoteToInvoice(){const q=readArray(QUOTE_STORAGE_KEY).find(x=>x.id===activeQuoteId);if(!q){alert("Save or select a quote first.");return;}const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===q.customerId);activeInvoiceId=null;pendingInvoiceCustomerId=q.customerId||null;pendingInvoiceQuoteId=q.id;clearInvoiceFields();byId("jobNumber").value=q.number;byId("todayDate").value=getLocalDateString();hideEditingBanner();byId("clientName").value=c?.name||q.customerName;byId("businessName").value=c?.business||"";byId("phone").value=q.phone||c?.phone||"";byId("email").value=q.email||c?.email||"";PreferredContactComponent.setValue("invoicePreferredContact",c?preferredContactForRecord(c):preferredContactForRecord(q));byId("billingAddress").value=c?.billing||"";byId("notes").value=`Converted from quote ${q.number}. ${q.notes||""}`.trim();resetServiceRows([{date:getLocalDateString(),address:q.property?.address||"",service:"Full Service",amount:q.amount}]);calculateTotals();populateInvoiceLinkSelectors({customerId:q.customerId,quoteId:q.id,preferredContact:preferredContactForRecord(q,preferredContactForRecord(c))});renderInvoiceAttachments();switchTab("invoiceTab");}

/* Home dashboard and expanded intelligence */
function getTodayScheduleItems(){const data=getScheduleData(),today=getLocalDateString();return Object.entries(data).filter(([key])=>key.startsWith(today)).map(([key,item])=>({time:key.slice(-4, -2)+":"+key.slice(-2),...item})).sort((a,b)=>a.time.localeCompare(b.time));}
function lowInventoryItems(){return getInventory().filter(i=>Number(i.quantity)<=Number(i.reorderAt));}
function expenseTotalsFor(period){const operating=readArray(EXPENSE_STORAGE_KEY).filter(x=>intelligenceDateInPeriod(x.date,period));const payroll=readArray(PAYROLL_STORAGE_KEY).filter(x=>intelligenceDateInPeriod(x.date,period));return {operating:operating.reduce((s,x)=>s+Number(x.total||0),0),payroll:payroll.reduce((s,x)=>s+Number(x.amount||0),0),operatingRecords:operating,payrollRecords:payroll};}
function maintenanceFinancials(period){let total=0,records=[];Object.entries(getMaintenanceData()).forEach(([key,item])=>(item.records||[]).forEach(r=>{if(intelligenceDateInPeriod(r.date,period)){const cost=Number(r.cost)||0;total+=cost;records.push({...r,equipment:equipmentDisplayName(key,item),cost});}}));return {total,records};}
function renderIntelligence(){
  // Intelligence was consolidated into the Home dashboard.
  if(byId("homeMetricCards")) refreshHomeDashboard();
  if(byId("maintenanceCalendar")) renderMaintenanceCalendar();
}
function invoicePaidRevenueDate(invoice){return typeof invoice?.paidAt==="string"&&invoice.paidAt?invoice.paidAt.slice(0,10):invoice?.invoiceDate||"";}
function invoiceDueState(invoice,today=new Date()){
  if((invoice?.status||"Unpaid")==="Paid"||!invoice?.dueDate)return "none";
  const due=normalizeDate(new Date(`${invoice.dueDate}T00:00:00`)),current=normalizeDate(today);
  if(due<current)return "overdue";
  if(due.getTime()===current.getTime())return "due-today";
  return "upcoming";
}
function refreshHomeDashboard(){
  const hour=new Date().getHours();byId("dailyGreeting").textContent=`Good ${hour<12?"morning":hour<18?"afternoon":"evening"}.`;
  const invoices=getSavedInvoices(),alerts=buildCurrentAlerts(),todayJobs=getTodayScheduleItems(),low=lowInventoryItems(),monthExp=expenseTotalsFor("month"),monthMaint=maintenanceFinancials("month"),monthPaid=invoices.filter(i=>(i.status||"Unpaid")==="Paid"&&intelligenceDateInPeriod(invoicePaidRevenueDate(i),"month")).reduce((s,i)=>s+Number(i.total||0),0),profit=monthPaid-monthExp.operating-monthExp.payroll-monthMaint.total;
  const overdue=invoices.filter(i=>invoiceDueState(i)==="overdue");
  byId("homeMetricCards").innerHTML=[["Jobs Today",todayJobs.length,""],["Active Alerts",alerts.length,"money-warning"],["Overdue Invoices",overdue.length,"money-negative"],["Month Revenue",monthPaid,"money-positive",true],["Month Expenses",monthExp.operating+monthExp.payroll+monthMaint.total,"money-negative",true],["Est. Month Profit",profit,profit>=0?"money-positive":"money-negative",true]].map(([l,v,c,m])=>`<article class="intelligence-card ${c}"><span>${l}</span><strong>${m?formatMoney(v):v}</strong></article>`).join("");
  byId("homeTodaySchedule").innerHTML=todayJobs.length?`<div class="insight-list">${todayJobs.map(j=>`<article><strong>${escapeHtml(j.time)} · ${escapeHtml(j.customer||"Customer")}</strong><span>${escapeHtml(j.jobNumber||"")} ${escapeHtml(j.service||"")} ${escapeHtml(j.status||"")}</span></article>`).join("")}</div>`:'<p class="empty-message">No jobs entered for today.</p>';
  byId("homeAttention").innerHTML=alerts.length?`<div class="insight-list issue-list">${alerts.slice(0,6).map(a=>`<article><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.detail)}</span></article>`).join("")}</div>`:'<p class="empty-message">No immediate alerts.</p>';
  const maintenance=getMaintenanceData(),up=[];Object.entries(maintenance).forEach(([key,item])=>{const reading=parseReading(item.currentReading);[["Oil Change",parseReading(item.oilInterval)],["Blade Service",parseReading(item.bladeInterval)]].forEach(([task,interval])=>{if(!interval)return;const source=task==="Oil Change"?"Oil Change":"Blade Sharpening",remaining=latestCompletedReading(item.records,source)+interval-reading;if(remaining>0&&remaining<=Math.max(interval*.25,10))up.push(`${equipmentDisplayName(key,item)}: ${task} in ${remaining.toFixed(1)} hours/miles`);});});byId("homeUpcoming").innerHTML=up.length?`<div class="simple-list">${up.map(x=>`<p>${escapeHtml(x)}</p>`).join("")}</div>`:'<p class="empty-message">No upcoming service warnings.</p>';
  byId("homeInventory").innerHTML=low.length?`<div class="simple-list">${low.map(i=>`<p><strong>${escapeHtml(i.name)}</strong>: ${i.quantity} ${escapeHtml(i.unit)} remaining</p>`).join("")}</div>`:'<p class="empty-message">Inventory is above reorder levels.</p>';
  const totalExpenses=monthExp.operating+monthExp.payroll+monthMaint.total;byId("homeFinancialOverview").innerHTML=`<div class="financial-table"><div><span>Paid Revenue</span><strong>${formatMoney(monthPaid)}</strong></div><div><span>Operating Expenses</span><strong>${formatMoney(monthExp.operating)}</strong></div><div><span>Payroll</span><strong>${formatMoney(monthExp.payroll)}</strong></div><div><span>Maintenance</span><strong>${formatMoney(monthMaint.total)}</strong></div><div class="financial-total"><strong>Estimated Profit</strong><strong>${formatMoney(profit)}</strong></div></div>`;
  const issueAlerts=alerts.filter(a=>a.type==="Maintenance"||a.type==="Repair");byId("homeMaintenanceIssues").innerHTML=issueAlerts.length?`<div class="insight-list issue-list">${issueAlerts.slice(0,8).map(a=>`<article><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.detail)}</span></article>`).join("")}</div>`:'<p class="empty-message">No overdue maintenance or open repairs.</p>';
  const scheduledMaint=getMaintenanceCalendar().filter(x=>x.status!=="Verified"&&x.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);if(scheduledMaint.length){byId("homeUpcoming").innerHTML=`<div class="insight-list">${scheduledMaint.map(x=>`<article><strong>${formatDateLong(x.date)} · ${escapeHtml(x.equipment||"Equipment")}</strong><span>${escapeHtml(x.task)} · ${escapeHtml(x.status)}</span></article>`).join("")}</div>`;}
  const lines=[];lines.push(`You have ${todayJobs.length} scheduled job${todayJobs.length===1?"":"s"} today.`);if(overdue.length)lines.push(`${overdue.length} invoice${overdue.length===1?" is":"s are"} overdue and still unpaid.`);if(alerts.length)lines.push(`${alerts.length} active maintenance or payment reminder${alerts.length===1?" needs":"s need"} attention.`);if(low.length)lines.push(`${low.length} inventory item${low.length===1?" is":"s are"} at or below reorder level.`);lines.push(`This month's recorded paid revenue is ${formatMoney(monthPaid)} and estimated operating profit is ${formatMoney(profit)}.`);byId("ownerBriefing").innerHTML=lines.map(x=>`<p>${escapeHtml(x)}</p>`).join("");
}


function openDashboardSection(tabId){ switchTab(tabId); window.scrollTo({top:0,behavior:"smooth"}); }
function scrollToHomeCard(cardId){
  switchTab("homeTab");
  setTimeout(()=>document.querySelector(`[data-card-id="${cardId}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}),50);
}
function openMaintenanceSubtab(panelId){
  switchTab("maintenanceTab");
  document.querySelectorAll(".subtab-button").forEach(b=>b.classList.toggle("active",b.dataset.maintPanel===panelId));
  document.querySelectorAll(".maint-subpanel").forEach(p=>p.classList.toggle("active",p.id===panelId));
  setTimeout(()=>byId(panelId)?.scrollIntoView({behavior:"smooth",block:"start"}),50);
}
function openMaintenanceCalendar(){
  renderMaintenanceCalendarModal();
  const modal=byId("maintenanceCalendarModal");
  if(modal)modal.hidden=false;
}
function closeMaintenanceCalendarModal(){const modal=byId("maintenanceCalendarModal");if(modal)modal.hidden=true;}
function renderMaintenanceCalendarModal(){
  const host=byId("maintenanceCalendarModalContent");if(!host)return;
  const items=getMaintenanceCalendar().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  host.innerHTML=items.length?`<div class="calendar-card-list">${items.map(x=>`<article class="calendar-edit-card"><label>Date<input type="date" value="${escapeHtml(x.date||"")}" data-id="${x.id}" data-field="date"></label><label>Equipment<input value="${escapeHtml(x.equipment||"")}" placeholder="Mower #1" data-id="${x.id}" data-field="equipment"></label><label>Service<select data-id="${x.id}" data-field="task">${maintenanceTasks.map(t=>`<option ${x.task===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select></label><label>Status<select data-id="${x.id}" data-field="status">${['Scheduled','Waiting for Parts','Completed - Awaiting Proof','Verified'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="calendar-notes">Notes<input value="${escapeHtml(x.notes||"")}" placeholder="Parts, appointment, employee" data-id="${x.id}" data-field="notes"></label><button type="button" class="danger-button calendar-delete" data-delete-id="${x.id}">Delete</button></article>`).join('')}</div>`:'<p class="empty-message">No future maintenance has been scheduled yet.</p>';
  host.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{updateMaintenanceCalendarItem(el.dataset.id,el.dataset.field,el.value);renderMaintenanceCalendarModal();}));
  host.querySelectorAll('[data-delete-id]').forEach(btn=>btn.addEventListener('click',()=>{deleteMaintenanceCalendarItem(btn.dataset.deleteId);renderMaintenanceCalendarModal();}));
}
function getMaintenanceCalendar(){return readArray(MAINT_CALENDAR_KEY);}
function saveMaintenanceCalendarData(items){writeArray(MAINT_CALENDAR_KEY,items);}
function addMaintenanceCalendarItem(){const items=getMaintenanceCalendar();items.push({id:makeId("maintcal"),date:getLocalDateString(addDays(new Date(),1)),equipment:"",task:"Oil Change",status:"Scheduled",notes:""});saveMaintenanceCalendarData(items);renderMaintenanceCalendar();refreshHomeDashboard();}
function updateMaintenanceCalendarItem(id,field,value){const items=getMaintenanceCalendar(),item=items.find(x=>x.id===id);if(item){item[field]=value;saveMaintenanceCalendarData(items);refreshHomeDashboard();}}
function deleteMaintenanceCalendarItem(id){saveMaintenanceCalendarData(getMaintenanceCalendar().filter(x=>x.id!==id));renderMaintenanceCalendar();refreshHomeDashboard();}
function renderMaintenanceCalendar(){
  const host=byId("maintenanceCalendar");if(!host)return;const items=getMaintenanceCalendar().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  host.innerHTML=items.length?`<table class="maintenance-calendar-table"><thead><tr><th>Date</th><th>Equipment</th><th>Service</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>${items.map(x=>`<tr class="maintenance-calendar-row"><td><input type="date" value="${escapeHtml(x.date||"")}" onchange="updateMaintenanceCalendarItem('${x.id}','date',this.value)"></td><td><input value="${escapeHtml(x.equipment||"")}" placeholder="Mower #1" onchange="updateMaintenanceCalendarItem('${x.id}','equipment',this.value)"></td><td><select onchange="updateMaintenanceCalendarItem('${x.id}','task',this.value)">${maintenanceTasks.map(t=>`<option ${x.task===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select></td><td><select onchange="updateMaintenanceCalendarItem('${x.id}','status',this.value)">${['Scheduled','Waiting for Parts','Completed - Awaiting Proof','Verified'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td><input value="${escapeHtml(x.notes||"")}" placeholder="Appointment or parts details" onchange="updateMaintenanceCalendarItem('${x.id}','notes',this.value)"></td><td><button type="button" class="danger-button" onclick="deleteMaintenanceCalendarItem('${x.id}')">Delete</button></td></tr>`).join('')}</tbody></table>`:'<p class="empty-message">No future maintenance has been placed on the calendar.</p>';
}
function initializeDashboardDragDrop(){
  const grid=byId("homeDashboardGrid");
  if(!grid)return;

  let saved=[];
  try{saved=JSON.parse(localStorage.getItem(DASHBOARD_ORDER_KEY)||"[]");}catch(_){saved=[];}
  saved.forEach(id=>{const card=grid.querySelector(`[data-card-id="${id}"]`);if(card)grid.appendChild(card);});

  let draggedCard=null;
  grid.querySelectorAll(".dashboard-card").forEach(card=>{
    card.draggable=true;
    const header=card.querySelector(".dashboard-card-header");
    if(header) header.title="Drag this card to change its position";
    card.addEventListener("dragstart",event=>{
      if(event.target.closest("button,input,select,a,textarea")){event.preventDefault();return;}
      draggedCard=card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed="move";
      event.dataTransfer.setData("text/plain",card.dataset.cardId||"");
    });
    card.addEventListener("dragend",()=>{
      card.classList.remove("is-dragging");
      draggedCard=null;
      saveDashboardOrder();
    });
  });
  grid.addEventListener("dragover",event=>{
    if(!draggedCard)return;
    event.preventDefault();
    event.dataTransfer.dropEffect="move";
    const target=event.target.closest(".dashboard-card");
    if(!target||target===draggedCard)return;
    const rect=target.getBoundingClientRect();
    const after=event.clientY>rect.top+rect.height/2 || (Math.abs(event.clientY-(rect.top+rect.height/2))<rect.height*.2 && event.clientX>rect.left+rect.width/2);
    grid.insertBefore(draggedCard,after?target.nextSibling:target);
  });
  grid.addEventListener("drop",event=>{
    if(!draggedCard)return;
    event.preventDefault();
    saveDashboardOrder();
  });
}
function saveDashboardOrder(){const grid=byId("homeDashboardGrid");if(grid)localStorage.setItem(DASHBOARD_ORDER_KEY,JSON.stringify([...grid.querySelectorAll(".dashboard-card")].map(c=>c.dataset.cardId)));}
function resetDashboardLayout(){localStorage.removeItem(DASHBOARD_ORDER_KEY);location.reload();}

function openFinancialOverviewModal(){
  refreshHomeDashboard();
  const invoices=getSavedInvoices(),monthExp=expenseTotalsFor("month"),monthMaint=maintenanceFinancials("month");
  const paid=invoices.filter(i=>(i.status||"Unpaid")==="Paid"&&intelligenceDateInPeriod(i.invoiceDate,"month")).reduce((s,i)=>s+Number(i.total||0),0);
  const invoiced=invoices.filter(i=>intelligenceDateInPeriod(i.invoiceDate,"month")).reduce((s,i)=>s+Number(i.total||0),0);
  const outstanding=invoices.filter(i=>(i.status||"Unpaid")!=="Paid").reduce((s,i)=>s+Number(i.total||0),0);
  const expenses=monthExp.operating+monthExp.payroll+monthMaint.total;
  const profit=paid-expenses;
  byId("financialOverviewDetail").innerHTML=`<div class="financial-table detailed-financial"><div><span>Total Invoiced This Month</span><strong>${formatMoney(invoiced)}</strong></div><div><span>Paid Revenue This Month</span><strong>${formatMoney(paid)}</strong></div><div><span>All Outstanding Invoices</span><strong>${formatMoney(outstanding)}</strong></div><div><span>Operating Expenses</span><strong>${formatMoney(monthExp.operating)}</strong></div><div><span>Payroll</span><strong>${formatMoney(monthExp.payroll)}</strong></div><div><span>Maintenance and Repairs</span><strong>${formatMoney(monthMaint.total)}</strong></div><div class="financial-total"><strong>Estimated Month Profit</strong><strong>${formatMoney(profit)}</strong></div></div>`;
  byId("financialOverviewModal").hidden=false;
}
function closeFinancialOverviewModal(){byId("financialOverviewModal").hidden=true;}
function openMaintenanceIssues(){
  openMaintenanceSubtab("equipmentMaintPanel");
  setTimeout(()=>{const el=byId("maintenanceRecords")||document.querySelector("#equipmentMaintPanel .section");el?.scrollIntoView({behavior:"smooth",block:"start"});},100);
}
function openScheduleMaintenanceModal(){
  const modal=byId("scheduleMaintenanceModal");
  byId("scheduleMaintDate").value=getLocalDateString(addDays(new Date(),1));
  byId("scheduleMaintEquipment").value="";
  byId("scheduleMaintTask").innerHTML=maintenanceTasks.map(t=>`<option>${escapeHtml(t)}</option>`).join("");
  byId("scheduleMaintStatus").value="Scheduled";
  byId("scheduleMaintNotes").value="";
  modal.hidden=false;
  setTimeout(()=>byId("scheduleMaintEquipment").focus(),30);
}
function closeScheduleMaintenanceModal(){byId("scheduleMaintenanceModal").hidden=true;}
function saveScheduledMaintenance(){
  const date=byId("scheduleMaintDate").value,equipment=byId("scheduleMaintEquipment").value.trim(),task=byId("scheduleMaintTask").value,status=byId("scheduleMaintStatus").value,notes=byId("scheduleMaintNotes").value.trim();
  if(!date||!equipment){alert("Please enter a maintenance date and equipment name.");return;}
  const items=getMaintenanceCalendar();
  items.push({id:makeId("maintcal"),date,equipment,task,status,notes});
  saveMaintenanceCalendarData(items);renderMaintenanceCalendar();refreshHomeDashboard();closeScheduleMaintenanceModal();openMaintenanceCalendar();
  setTimeout(()=>{const rows=document.querySelectorAll(".maintenance-calendar-row");rows[rows.length-1]?.classList.add("new-record-highlight");},120);
}

function initializeParadiseSuite(){
  PreferredContactComponent.mountAll();
  if(byId("customerSearch"))byId("customerSearch").addEventListener("input",renderCustomerList);
  if(byId("quoteCustomer"))byId("quoteCustomer").addEventListener("change",populateQuoteProperties);
  byId("invoicePhotoInput")?.addEventListener("change",event=>handleAttachmentFiles(event.target.files,"invoice-photo"));
  byId("signedInvoiceInput")?.addEventListener("change",event=>handleAttachmentFiles(event.target.files,"signed-invoice"));
  byId("quotePhotoInput")?.addEventListener("change",event=>handleAttachmentFiles(event.target.files,"quote-photo"));
  byId("customerInvoiceSearch")?.addEventListener("input",renderCustomerInvoiceHistory);
  byId("communicationAudience")?.addEventListener("change",renderCommunicationRecipients);
  byId("communicationSearch")?.addEventListener("input",renderCommunicationRecipients);
  byId("communicationTemplate")?.addEventListener("change",applyCommunicationTemplate);
  byId("invoiceCustomerLink")?.addEventListener("change",()=>{pendingInvoiceCustomerId=byId("invoiceCustomerLink").value||null;});
  byId("invoiceQuoteLink")?.addEventListener("change",()=>{pendingInvoiceQuoteId=byId("invoiceQuoteLink").value||null;});
  ["expenseQuantity","expenseUnitPrice"].forEach(id=>{if(byId(id))byId(id).addEventListener("input",calculateExpenseTotal);});
  document.querySelectorAll(".subtab-button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".subtab-button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".maint-subpanel").forEach(x=>x.classList.toggle("active",x.id===b.dataset.maintPanel));}));
  blankCustomerForm();renderCustomerList();populateCustomerSelectors();populateInvoiceLinkSelectors();newEmployee();renderEmployees();populateEmployeeSelectors();byId("payrollDate").value=getLocalDateString();byId("expenseDate").value=getLocalDateString();refreshEquipmentExpenseOptions();renderOperatingExpenses();renderInventory();newQuote();renderQuotes();renderMaintenanceCalendar();renderIntelligence();refreshHomeDashboard();initializeDashboardDragDrop();applyCommunicationTemplate();renderCommunicationRecipients();updateInvoicePreferredContactActions();
  byId("openMaintenanceCalendarButton")?.addEventListener("click",openMaintenanceCalendar);
  byId("closeMaintenanceCalendarButton")?.addEventListener("click",closeMaintenanceCalendarModal);
  byId("addMaintenanceCalendarButton")?.addEventListener("click",()=>{addMaintenanceCalendarItem();renderMaintenanceCalendarModal();});
  byId("openScheduleMaintenanceButton")?.addEventListener("click",()=>{closeMaintenanceCalendarModal();openScheduleMaintenanceModal();});
  byId("openFinancialOverviewButton")?.addEventListener("click",openFinancialOverviewModal);
  byId("maintenanceCalendarModal")?.addEventListener("click",e=>{if(e.target===e.currentTarget)closeMaintenanceCalendarModal();});
  byId("financialOverviewModal")?.addEventListener("click",e=>{if(e.target===e.currentTarget)closeFinancialOverviewModal();});
}
function runStartupStep(name, fn){
  try{fn();}
  catch(error){console.error(`Paradise startup failed in ${name}:`,error);}
}
function startParadiseApplication(){
  runStartupStep("core operations", initializeOperationsExpansion);
  runStartupStep("expanded suite", initializeParadiseSuite);
}
// Startup is registered after all v3.5 extensions are defined.

/* v3.5 Invoice Master Record and focused attachment system */
const ATTACHMENT_DB_NAME = "paradise_lawncare_files_v1";
const ATTACHMENT_STORE = "attachments";
const DAMAGE_STORAGE_KEY = "paradise_invoice_damages_v1";

function openAttachmentDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(ATTACHMENT_DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(ATTACHMENT_STORE)){
        const store=db.createObjectStore(ATTACHMENT_STORE,{keyPath:"id"});
        store.createIndex("recordKey","recordKey",{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function dbPutAttachment(item){const db=await openAttachmentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,"readwrite");tx.objectStore(ATTACHMENT_STORE).put(item);tx.oncomplete=()=>{db.close();resolve(item)};tx.onerror=()=>reject(tx.error);});}
async function dbGetAttachments(recordKey){const db=await openAttachmentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,"readonly");const req=tx.objectStore(ATTACHMENT_STORE).index("recordKey").getAll(recordKey);req.onsuccess=()=>{db.close();resolve(req.result||[])};req.onerror=()=>reject(req.error);});}
async function dbDeleteAttachment(id){const db=await openAttachmentDb();return new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,"readwrite");tx.objectStore(ATTACHMENT_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);});}
function currentRecordKey(kind){if(kind.startsWith("quote"))return activeQuoteId?`quote:${activeQuoteId}`:null;return activeInvoiceId?`invoice:${activeInvoiceId}`:null;}
async function handleAttachmentFiles(files,kind){
  const recordKey=currentRecordKey(kind);
  if(!recordKey){alert(`Save or open the ${kind.startsWith("quote")?"quote":"invoice"} before attaching files.`);return;}
  const allowed=[...files].filter(file=>kind==="signed-invoice"?file.type==="application/pdf"||file.type.startsWith("image/"):file.type.startsWith("image/"));
  if(!allowed.length){alert("No supported files were selected.");return;}
  for(const file of allowed){await dbPutAttachment({id:makeId("file"),recordKey,kind,name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),blob:file});}
  if(kind.startsWith("quote"))renderQuoteAttachments();else renderInvoiceAttachments();
}
function attachmentCard(file){
  const isImage=file.type?.startsWith("image/");
  return `<article class="attachment-card" data-file-id="${file.id}">${isImage?`<img class="attachment-thumb" data-blob-preview="${file.id}" alt="${escapeHtml(file.name)}">`:`<div class="attachment-file-icon">📄</div>`}<div class="attachment-meta"><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.kind.replaceAll("-"," "))}</small><small>${new Date(file.createdAt).toLocaleString()}</small></div><div class="attachment-card-actions"><button type="button" data-open-file="${file.id}">Open</button><button type="button" class="danger-button" data-delete-file="${file.id}">Delete</button></div></article>`;
}
async function wireAttachmentCards(host,files,rerender){
  for(const file of files){const img=host.querySelector(`[data-blob-preview="${file.id}"]`);if(img){const url=URL.createObjectURL(file.blob);img.src=url;img.onload=()=>URL.revokeObjectURL(url);}}
  host.querySelectorAll("[data-open-file]").forEach(btn=>btn.addEventListener("click",()=>{const file=files.find(x=>x.id===btn.dataset.openFile);if(!file)return;const url=URL.createObjectURL(file.blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}));
  host.querySelectorAll("[data-delete-file]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Delete this attached file?"))return;await dbDeleteAttachment(btn.dataset.deleteFile);rerender();}));
}
async function renderInvoiceAttachments(){
  const host=byId("invoiceAttachmentGallery"),count=byId("invoiceAttachmentCount");if(!host)return;
  if(!activeInvoiceId){host.innerHTML='<p class="empty-message">Save or open an invoice to attach files.</p>';if(count)count.textContent="0 files";renderDamageReports();return;}
  const files=(await dbGetAttachments(`invoice:${activeInvoiceId}`)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  host.innerHTML=files.length?files.map(attachmentCard).join(""):'<p class="empty-message">No pictures or signed invoice attached.</p>';if(count)count.textContent=`${files.length} file${files.length===1?"":"s"}`;await wireAttachmentCards(host,files,renderInvoiceAttachments);renderDamageReports();
}
async function renderQuoteAttachments(){
  const host=byId("quoteAttachmentGallery"),count=byId("quoteAttachmentCount");if(!host)return;
  if(!activeQuoteId){host.innerHTML='<p class="empty-message">Save or select a quote to attach pictures.</p>';if(count)count.textContent="0 files";return;}
  const files=(await dbGetAttachments(`quote:${activeQuoteId}`)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));host.innerHTML=files.length?files.map(attachmentCard).join(""):'<p class="empty-message">No quote pictures attached.</p>';if(count)count.textContent=`${files.length} file${files.length===1?"":"s"}`;await wireAttachmentCards(host,files,renderQuoteAttachments);
}
async function copyQuoteAttachmentsToInvoice(quoteId,invoiceId){if(!quoteId||!invoiceId)return;const existing=await dbGetAttachments(`invoice:${invoiceId}`);if(existing.some(x=>x.sourceQuoteId===quoteId))return;const files=await dbGetAttachments(`quote:${quoteId}`);for(const file of files){await dbPutAttachment({...file,id:makeId("file"),recordKey:`invoice:${invoiceId}`,kind:"invoice-photo",sourceQuoteId:quoteId,createdAt:new Date().toISOString()});}}

function getDamageReports(){return readArray(DAMAGE_STORAGE_KEY);}
function openDamageReportModal(){if(!activeInvoiceId){alert("Save or open the invoice before adding a damage report.");return;}byId("damageDate").value=getLocalDateString();byId("damageStatus").value="Documented";byId("damageDescription").value="";byId("damagePhotoInput").value="";byId("damageReportModal").hidden=false;}
function closeDamageReportModal(){byId("damageReportModal").hidden=true;}
async function saveDamageReport(){const description=byId("damageDescription").value.trim();if(!description){alert("Enter a damage description.");return;}const report={id:makeId("damage"),invoiceId:activeInvoiceId,date:byId("damageDate").value,status:byId("damageStatus").value,description,createdAt:new Date().toISOString()};const list=getDamageReports();list.push(report);writeArray(DAMAGE_STORAGE_KEY,list);for(const file of [...byId("damagePhotoInput").files]){if(file.type.startsWith("image/"))await dbPutAttachment({id:makeId("file"),recordKey:`invoice:${activeInvoiceId}`,kind:"damage-photo",damageId:report.id,name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),blob:file});}closeDamageReportModal();renderInvoiceAttachments();}
function deleteDamageReport(id){if(!confirm("Delete this damage report? Attached damage photos remain available until separately deleted."))return;writeArray(DAMAGE_STORAGE_KEY,getDamageReports().filter(x=>x.id!==id));renderDamageReports();}
function renderDamageReports(){const host=byId("invoiceDamageList");if(!host)return;const items=getDamageReports().filter(x=>x.invoiceId===activeInvoiceId).sort((a,b)=>b.date.localeCompare(a.date));host.innerHTML=items.map(x=>`<article class="damage-card"><div class="damage-card-head"><strong>${formatDateLong(x.date)} · ${escapeHtml(x.status)}</strong><button type="button" class="danger-button" onclick="deleteDamageReport('${x.id}')">Delete</button></div><p>${escapeHtml(x.description)}</p></article>`).join("");}

function findMatchingCustomerId(){const name=byId("clientName")?.value.trim().toLowerCase(),business=byId("businessName")?.value.trim().toLowerCase(),phone=byId("phone")?.value.replace(/\D/g,""),email=byId("email")?.value.trim().toLowerCase();const customer=readArray(CUSTOMER_STORAGE_KEY).find(c=>(email&&c.email?.toLowerCase()===email)||(phone&&c.phone?.replace(/\D/g,"")===phone)||(name&&c.name?.toLowerCase()===name)||(business&&c.business?.toLowerCase()===business));return customer?.id||null;}
function populateInvoiceLinkSelectors(invoice=null){
  const customers=readArray(CUSTOMER_STORAGE_KEY),quotes=readArray(QUOTE_STORAGE_KEY),customerSelect=byId("invoiceCustomerLink"),quoteSelect=byId("invoiceQuoteLink");
  if(customerSelect){const selected=invoice?.customerId||pendingInvoiceCustomerId||findMatchingCustomerId()||customerSelect.value;customerSelect.innerHTML='<option value="">Automatically match or select customer</option>'+customers.map(c=>`<option value="${c.id}">${escapeHtml(c.name||c.business)}</option>`).join("");customerSelect.value=selected||"";}
  if(quoteSelect){const selected=invoice?.quoteId||pendingInvoiceQuoteId||quoteSelect.value;quoteSelect.innerHTML='<option value="">No source quote</option>'+quotes.map(q=>`<option value="${q.id}">${escapeHtml(q.number)} · ${escapeHtml(q.customerName)}</option>`).join("");quoteSelect.value=selected||"";}
}
function activateInvoiceMasterRecord(invoice){
  const customerId=invoice.customerId||findMatchingCustomerId();pendingInvoiceCustomerId=customerId||null;pendingInvoiceQuoteId=invoice.quoteId||null;populateInvoiceLinkSelectors({...invoice,customerId});
  const status=byId("activeRecordStatus");if(status)status.textContent=`Active: ${invoice.jobNumber}`;
  if(customerId){loadCustomer(customerId);}
  if(invoice.quoteId){loadQuote(invoice.quoteId);}
  focusScheduleForInvoice(invoice);renderCustomerInvoiceHistory();
}
function focusScheduleForInvoice(invoice){
  document.querySelectorAll(".schedule-slot.active-record-focus").forEach(x=>x.classList.remove("active-record-focus"));
  const targets=[invoice.jobNumber,invoice.clientName,invoice.businessName,invoice.services?.[0]?.address].filter(Boolean).map(x=>String(x).toLowerCase());
  document.querySelectorAll(".schedule-slot").forEach(slot=>{const text=slot.textContent.toLowerCase();if(targets.some(t=>t&&text.includes(t)))slot.classList.add("active-record-focus");});
}
function renderCustomerInvoiceHistory(){
  const host=byId("customerInvoiceHistory"),count=byId("customerInvoiceCount");if(!host)return;if(!activeCustomerId){host.innerHTML='<p class="empty-message">Select a customer to view invoice history.</p>';if(count)count.textContent="0 invoices";return;}
  const customer=readArray(CUSTOMER_STORAGE_KEY).find(c=>c.id===activeCustomerId);const q=(byId("customerInvoiceSearch")?.value||"").toLowerCase();const invoices=getSavedInvoices().filter(i=>i.customerId===activeCustomerId||(!i.customerId&&customer&&((i.email&&i.email.toLowerCase()===customer.email?.toLowerCase())||(i.phone&&i.phone.replace(/\D/g,"")===customer.phone?.replace(/\D/g,""))))).filter(i=>searchableInvoiceText(i).includes(q)).sort((a,b)=>(b.invoiceDate||"").localeCompare(a.invoiceDate||""));
  if(count)count.textContent=`${invoices.length} invoice${invoices.length===1?"":"s"}`;host.innerHTML=invoices.length?invoices.map(i=>`<article class="customer-invoice-row ${i.id===activeInvoiceId?"active-record":""}"><strong>${escapeHtml(i.jobNumber)}</strong><span>${formatDisplayDate(i.invoiceDate)}</span><span>${escapeHtml(i.services?.[0]?.address||i.billingAddress||"No address")}</span><span>${formatMoney(i.total)}</span><span>${escapeHtml(i.status||"Unpaid")}</span><button type="button" onclick="openInvoiceFromCustomer('${i.id}')">Open Invoice</button></article>`).join(""):'<p class="empty-message">No connected invoices found for this customer.</p>';
}
function openInvoiceFromCustomer(id){switchTab("invoiceTab");loadInvoice(id);setTimeout(()=>byId("editingBanner")?.classList.add("record-focus-highlight"),50);}

const originalSaveInvoiceV35=saveInvoice;
saveInvoice=async function(){
  const beforeId=activeInvoiceId;originalSaveInvoiceV35();
  if(activeInvoiceId){const invoices=getSavedInvoices();const invoice=invoices.find(x=>x.id===activeInvoiceId);if(invoice?.quoteId)await copyQuoteAttachmentsToInvoice(invoice.quoteId,invoice.id);renderInvoiceAttachments();renderCustomerInvoiceHistory();}
  if(typeof renderBillingCenterV38==="function")renderBillingCenterV38();
  if(typeof refreshHomeDashboard==="function")refreshHomeDashboard();
};
const originalNewInvoiceV35=newInvoice;
newInvoice=function(){originalNewInvoiceV35();populateInvoiceLinkSelectors();const status=byId("activeRecordStatus");if(status)status.textContent="New invoice";renderInvoiceAttachments();};
const originalNewQuoteV35=newQuote;
newQuote=function(){originalNewQuoteV35();renderQuoteAttachments();};
const originalPopulateCustomerSelectorsV35=populateCustomerSelectors;
populateCustomerSelectors=function(){originalPopulateCustomerSelectorsV35();populateInvoiceLinkSelectors();};



/* Paradise Lawn Care Operations Suite v3.6 - Customer and Job record foundation */
const CUSTOMER_SEQUENCE_KEY_V36 = "pl_customer_sequence_v36";
const JOB_ID_SEQUENCE_KEY_V36 = "pl_job_id_sequence_v36";
const INVOICE_SEQUENCE_KEY_V36 = "pl_invoice_sequence_v36";
let activeScheduleSlotKeyV36 = null;

function nextPersistentNumber(key) {
  const next = (Number(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, String(next));
  return next;
}
function generateCustomerNumberV36(){ return `C-${String(nextPersistentNumber(CUSTOMER_SEQUENCE_KEY_V36)).padStart(6,"0")}`; }
function generateJobIdV36(){ return `J-${new Date().getFullYear()}-${String(nextPersistentNumber(JOB_ID_SEQUENCE_KEY_V36)).padStart(6,"0")}`; }
function generateInvoiceNumberV36(){ return `INV-${new Date().getFullYear()}-${String(nextPersistentNumber(INVOICE_SEQUENCE_KEY_V36)).padStart(5,"0")}`; }
function ensureCustomerNumberV36(customer){ if(!customer.customerNumber) customer.customerNumber=generateCustomerNumberV36(); return customer.customerNumber; }
function customerByIdV36(id){ return readArray(CUSTOMER_STORAGE_KEY).find(c=>c.id===id); }
function addressForRecordV36(record){ return record?.property?.address || record?.services?.[0]?.address || record?.billingAddress || customerByIdV36(record?.customerId)?.properties?.[0]?.address || customerByIdV36(record?.customerId)?.billing || ""; }
function customerLabelV36(c){ return c ? (c.name || c.business || "Customer") : "Customer"; }

function migrateRecordIdentifiersV36(){
  const customers=readArray(CUSTOMER_STORAGE_KEY); let changedCustomers=false;
  customers.forEach(c=>{if(!c.customerNumber){ensureCustomerNumberV36(c);changedCustomers=true;}});
  if(changedCustomers) writeArray(CUSTOMER_STORAGE_KEY,customers);
  const quotes=readArray(QUOTE_STORAGE_KEY); let changedQuotes=false;
  quotes.forEach(q=>{const c=customers.find(x=>x.id===q.customerId);if(!q.jobId){q.jobId=generateJobIdV36();changedQuotes=true;}if(c&&!q.customerNumber){q.customerNumber=c.customerNumber;changedQuotes=true;}if(!q.number||q.number.startsWith("PL-")){q.number=quoteSequence();changedQuotes=true;}});
  if(changedQuotes) writeArray(QUOTE_STORAGE_KEY,quotes);
  const invoices=getSavedInvoices(); let changedInvoices=false;
  invoices.forEach(i=>{const c=customers.find(x=>x.id===i.customerId);if(!i.invoiceNumber){i.invoiceNumber=i.jobNumber||generateInvoiceNumberV36();changedInvoices=true;}if(!i.jobNumber){i.jobNumber=i.invoiceNumber;changedInvoices=true;}if(!i.jobId){const q=quotes.find(x=>x.id===i.quoteId);i.jobId=q?.jobId||generateJobIdV36();changedInvoices=true;}if(c&&!i.customerNumber){i.customerNumber=c.customerNumber;changedInvoices=true;}});
  if(changedInvoices) storeInvoices(invoices);
}

const saveCustomerV35=saveCustomer;
saveCustomer=function(){
  const wasNew=!activeCustomerId;
  saveCustomerV35();
  const list=readArray(CUSTOMER_STORAGE_KEY);const c=list.find(x=>x.id===activeCustomerId);
  if(c&&!c.customerNumber){c.customerNumber=generateCustomerNumberV36();writeArray(CUSTOMER_STORAGE_KEY,list);}
  if(c) byId("customerNumberDisplay").textContent=c.customerNumber;
  if(wasNew) populateCustomerSelectors();
};
const loadCustomerV35=loadCustomer;
loadCustomer=function(id){loadCustomerV35(id);const c=customerByIdV36(id);if(byId("customerNumberDisplay"))byId("customerNumberDisplay").textContent=c?.customerNumber||"Not assigned";};
const newCustomerV35=newCustomer;
newCustomer=function(){newCustomerV35();if(byId("customerNumberDisplay"))byId("customerNumberDisplay").textContent="Assigned when saved";};

const newQuoteV36Base=newQuote;
newQuote=function(){newQuoteV36Base();byId("quoteNumber").value=quoteSequence();byId("quoteNumber").dataset.jobId=generateJobIdV36();};
const saveQuoteV36Base=saveQuote;
saveQuote=function(){
  const existing=activeQuoteId?readArray(QUOTE_STORAGE_KEY).find(q=>q.id===activeQuoteId):null;
  const c=customerByIdV36(byId("quoteCustomer").value);
  if(c&&!c.customerNumber){const list=readArray(CUSTOMER_STORAGE_KEY);const live=list.find(x=>x.id===c.id);ensureCustomerNumberV36(live);writeArray(CUSTOMER_STORAGE_KEY,list);}
  const jobId=existing?.jobId||byId("quoteNumber").dataset.jobId||generateJobIdV36();
  saveQuoteV36Base();
  const list=readArray(QUOTE_STORAGE_KEY),q=list.find(x=>x.id===activeQuoteId),customer=customerByIdV36(q?.customerId);
  if(q){q.jobId=jobId;q.customerNumber=customer?.customerNumber||"";writeArray(QUOTE_STORAGE_KEY,list);}
  renderQuotes();
};
const loadQuoteV36Base=loadQuote;
loadQuote=function(id){loadQuoteV36Base(id);const q=readArray(QUOTE_STORAGE_KEY).find(x=>x.id===id);if(q)byId("quoteNumber").dataset.jobId=q.jobId||"";};
const renderQuotesV36Base=renderQuotes;
renderQuotes=function(){
  const host=byId("quoteList");if(!host)return;
  const list=readArray(QUOTE_STORAGE_KEY).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  host.innerHTML=list.length?list.map(q=>`<button type="button" class="record-card" onclick="loadQuote('${q.id}')"><strong>${escapeHtml(q.number)} · ${escapeHtml(q.customerName)}</strong><span>${escapeHtml(q.jobId||"No Job ID")} · ${escapeHtml(q.status)} · ${formatMoney(q.amount)}</span><small>${escapeHtml(q.scope||q.frequency)}</small></button>`).join(""):'<p class="empty-message">No quotes saved.</p>';
};

const collectInvoiceV36Base=collectInvoice;
collectInvoice=function(){
  const invoice=collectInvoiceV36Base();const existing=activeInvoiceId?getSavedInvoices().find(x=>x.id===activeInvoiceId):null;const quote=readArray(QUOTE_STORAGE_KEY).find(q=>q.id===invoice.quoteId);const customer=customerByIdV36(invoice.customerId);
  invoice.invoiceNumber=existing?.invoiceNumber||byId("jobNumber").value||generateInvoiceNumberV36();invoice.jobNumber=invoice.invoiceNumber;
  invoice.jobId=existing?.jobId||quote?.jobId||byId("invoiceJobId")?.value||generateJobIdV36();invoice.customerNumber=customer?.customerNumber||byId("invoiceCustomerNumber")?.value||"";
  invoice.preferredContact=PreferredContactComponent.sync("invoicePreferredContact")||preferredContactForRecord(existing,preferredContactForRecord(quote,preferredContactForRecord(customer)));
  invoice.communicationStatus=existing?.communicationStatus||"";
  invoice.emailedAt=existing?.emailedAt||"";
  invoice.paidAt=existing?.paidAt||"";
  if(invoice.status==="Paid"){
    invoice.communicationStatus="Paid";
    invoice.paidAt=invoice.paidAt||new Date().toISOString();
  }else if(existing?.status==="Paid"&&invoice.status!=="Paid"){
    invoice.paidAt="";
    if(invoice.communicationStatus==="Paid")invoice.communicationStatus=invoice.email?"Ready to Email":"";
  }
  return invoice;
};
const newInvoiceV36Base=newInvoice;
newInvoice=function(){newInvoiceV36Base();byId("jobNumber").value=generateInvoiceNumberV36();byId("invoiceJobId").value=generateJobIdV36();byId("invoiceCustomerNumber").value="";};
const loadInvoiceV36Base=loadInvoice;
loadInvoice=function(id){loadInvoiceV36Base(id);const invoice=getSavedInvoices().find(x=>x.id===id);if(invoice){byId("jobNumber").value=invoice.invoiceNumber||invoice.jobNumber||"";byId("invoiceJobId").value=invoice.jobId||"";byId("invoiceCustomerNumber").value=invoice.customerNumber||customerByIdV36(invoice.customerId)?.customerNumber||"";}};
const populateInvoiceLinkSelectorsV36Base=populateInvoiceLinkSelectors;
populateInvoiceLinkSelectors=function(invoice=null){populateInvoiceLinkSelectorsV36Base(invoice);const c=customerByIdV36(invoice?.customerId||byId("invoiceCustomerLink")?.value);if(byId("invoiceCustomerNumber"))byId("invoiceCustomerNumber").value=invoice?.customerNumber||c?.customerNumber||"";if(byId("invoiceJobId")&&invoice?.jobId)byId("invoiceJobId").value=invoice.jobId;};
const convertQuoteToInvoiceV36Base=convertQuoteToInvoice;
convertQuoteToInvoice=function(){
  const q=readArray(QUOTE_STORAGE_KEY).find(x=>x.id===activeQuoteId);convertQuoteToInvoiceV36Base();if(q){byId("jobNumber").value=generateInvoiceNumberV36();byId("invoiceJobId").value=q.jobId||generateJobIdV36();byId("invoiceCustomerNumber").value=q.customerNumber||customerByIdV36(q.customerId)?.customerNumber||"";const invoiceDate=byId("todayDate").value||getLocalDateString();byId("dueDate").value=addDaysStringV38(invoiceDate,14);}
};

function allScheduleRecordsV36(){
  const customers=readArray(CUSTOMER_STORAGE_KEY);
  const customerMap=new Map(customers.map(c=>[c.id,c]));
  const quotes=readArray(QUOTE_STORAGE_KEY).map(q=>{
    const customer=customerMap.get(q.customerId);
    const property=q.property||customer?.properties?.[0]||null;
    return {
      recordType:"Quote",
      recordId:q.id,
      recordNumber:q.number,
      jobId:q.jobId,
      customerId:q.customerId,
      customerNumber:q.customerNumber||customer?.customerNumber||"",
      customer:customerLabelV36(customer)||q.customerName,
      business:customer?.business||"",
      address:addressForRecordV36(q),
      phone:q.phone||customer?.phone||"",
      email:q.email||customer?.email||"",
      preferredContact:preferredContactForRecord(q,preferredContactForRecord(customer)),
      property,
      service:q.scope||q.frequency||"",
      frequency:q.frequency||"",
      notes:q.notes||"",
      customerNotes:customer?.notes||"",
      status:q.status||"Draft",
      coordinates:coordinatesForRecordV319(q,customer,property)
    };
  });
  const invoices=getSavedInvoices().map(i=>{
    const customer=customerMap.get(i.customerId);
    const property=customer?.properties?.find(p=>p.address&&p.address===i.services?.[0]?.address)||customer?.properties?.[0]||null;
    return {
      recordType:"Invoice",
      recordId:i.id,
      recordNumber:i.invoiceNumber||i.jobNumber,
      jobId:i.jobId,
      customerId:i.customerId,
      customerNumber:i.customerNumber||customer?.customerNumber||"",
      customer:i.clientName||i.businessName||customerLabelV36(customer),
      business:i.businessName||customer?.business||"",
      address:addressForRecordV36(i),
      phone:i.phone||customer?.phone||"",
      email:i.email||customer?.email||"",
      preferredContact:preferredContactForRecord(i,preferredContactForRecord(customer)),
      property,
      service:i.services?.map(s=>s.service).filter(Boolean).join(", ")||"",
      frequency:i.frequency||"",
      notes:i.notes||"",
      customerNotes:customer?.notes||"",
      status:i.status||"Unpaid",
      coordinates:coordinatesForRecordV319(i,customer,property)
    };
  });
  return [...invoices,...quotes];
}
function searchableScheduleRecordV36(r){return [r.recordType,r.recordNumber,r.jobId,r.customerNumber,r.customer,r.address,r.phone,r.service,r.status].join(" ").toLowerCase();}
function openScheduleRecordFinder(slotKey){activeScheduleSlotKeyV36=slotKey;byId("scheduleRecordFinderModal").hidden=false;byId("scheduleRecordSearch").value="";renderScheduleRecordResultsV36();setTimeout(()=>byId("scheduleRecordSearch").focus(),20);}
function closeScheduleRecordFinder(){byId("scheduleRecordFinderModal").hidden=true;}
function renderScheduleRecordResultsV36(){const q=(byId("scheduleRecordSearch")?.value||"").toLowerCase();const records=allScheduleRecordsV36().filter(r=>searchableScheduleRecordV36(r).includes(q)).slice(0,60);byId("scheduleRecordResults").innerHTML=records.length?records.map(r=>`<button type="button" class="record-card schedule-result" onclick="selectScheduleRecordV36('${r.recordType}','${r.recordId}')"><strong>${escapeHtml(r.recordType)} ${escapeHtml(r.recordNumber||"")} · ${escapeHtml(r.customer)}</strong><span>${escapeHtml(r.jobId||"No Job ID")} · ${escapeHtml(r.customerNumber||"No Customer ID")}</span><small>${escapeHtml(r.address||"No address")}</small></button>`).join(""):'<p class="empty-message">No matching quotes or invoices found.</p>';}
function selectScheduleRecordV36(type,id){const r=allScheduleRecordsV36().find(x=>x.recordType===type&&x.recordId===id);const slot=document.querySelector(`.schedule-slot[data-schedule-key="${activeScheduleSlotKeyV36}"]`);if(!r||!slot)return;slot.querySelector(".sched-job").value=r.recordNumber||r.jobId||"";slot.querySelector(".sched-record-type").value=r.recordType;slot.querySelector(".sched-work-status").value="Scheduled";slot.querySelector(".sched-customer").value=r.customer||"";slot.querySelector(".sched-service").value=r.service||"";slot.dataset.recordId=r.recordId||"";slot.dataset.jobId=r.jobId||"";slot.dataset.customerId=r.customerId||"";slot.dataset.customerNumber=r.customerNumber||"";showScheduleCustomerCardV36(r);closeScheduleRecordFinder();saveSchedule();}
let activeScheduleDetailsV319=null;
function showScheduleCustomerCardV36(r,slotKey=activeScheduleSlotKeyV36){
  const card=byId("scheduleCustomerCard");
  if(!card||!r)return;
  const customer=readArray(CUSTOMER_STORAGE_KEY).find(c=>c.id===r.customerId)||null;
  const property=r.property||customer?.properties?.find(p=>p.address&&p.address===r.address)||customer?.properties?.[0]||null;
  const scheduleItem=slotKey?getScheduleData()[slotKey]||{}:{};
  const scheduledDate=scheduleDateFromKeyV37(slotKey);
  const scheduledTime=slotKey?timeLabel(phaseCTimeFromScheduleKey(slotKey).hour,phaseCTimeFromScheduleKey(slotKey).minute):"";
  const access=[
    property?.gateCode?`Gate: ${property.gateCode}`:"",
    property?.hoa?`Restrictions: ${property.hoa}`:"",
    property?.warning?`Safety: ${property.warning}`:"",
    property?.irrigation?`Irrigation: ${property.irrigation}`:"",
    property?.mowingHeight?`Mowing height: ${property.mowingHeight}`:""
  ].filter(Boolean).join(" · ");
  const notes=[property?.notes,r.notes,r.customerNotes,customer?.notes].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(" · ");
  activeScheduleDetailsV319={record:r,customer,property,slotKey,scheduleItem,address:r.address||property?.address||"",coordinates:r.coordinates||coordinatesForRecordV319(r,customer,property)};
  card.hidden=false;
  byId("scheduleSelectedRecord").textContent=`${r.recordType} ${r.recordNumber||""} · ${r.jobId||""}`;
  byId("scheduleSelectedCustomer").textContent=r.customer||customerLabelV36(customer)||"—";
  byId("scheduleSelectedCustomerId").textContent=r.customerNumber||customer?.customerNumber||"—";
  byId("scheduleSelectedAddress").textContent=activeScheduleDetailsV319.address||"Address incomplete";
  byId("scheduleSelectedPhone").textContent=r.phone||customer?.phone||"—";
  const details=byId("scheduleSelectedDetails");
  if(details)details.innerHTML=`
    <div><span>Business</span><strong>${escapeHtml(r.business||customer?.business||"—")}</strong></div>
    <div><span>Email</span><strong>${escapeHtml(r.email||customer?.email||"—")}</strong></div>
    <div><span>Preferred Contact</span><strong>${escapeHtml(preferredContactForRecord(r,preferredContactForRecord(customer)))}</strong></div>
    <div><span>Scheduled</span><strong>${escapeHtml([formatDateLong(scheduledDate),scheduledTime].filter(Boolean).join(" at ")||"—")}</strong></div>
    <div><span>Service / Frequency</span><strong>${escapeHtml([r.service,r.frequency].filter(Boolean).join(" · ")||"—")}</strong></div>
    <div><span>Work Status</span><strong>${escapeHtml(scheduleItem.workStatus||r.status||"—")}</strong></div>
    <div class="schedule-detail-wide"><span>Property &amp; Access</span><strong>${escapeHtml(property?.name||r.address||"Property")}</strong><small>${escapeHtml(access||"No gate, access, or safety instructions saved.")}</small></div>
    <div class="schedule-detail-wide"><span>Job &amp; Customer Notes</span><strong>${escapeHtml(notes||"No notes saved.")}</strong></div>`;
}
function clearScheduleSelection(){
  byId("scheduleCustomerCard").hidden=true;
  if(byId("scheduleSelectedDetails"))byId("scheduleSelectedDetails").innerHTML="";
  activeScheduleDetailsV319=null;
  activeScheduleSlotKeyV36=null;
}

const renderScheduleV36Base=renderSchedule;
renderSchedule=function(){
  const data=getScheduleData();const dates=Array.from({length:7},(_,index)=>addDays(scheduleAnchor,index));byId("scheduleAnchorDate").value=dateKey(scheduleAnchor);byId("scheduleHead").innerHTML=`<tr><th>Time</th>${dates.map(date=>`<th>${escapeHtml(displayDay(date))}</th>`).join("")}</tr>`;let html="";
  for(let hour=scheduleStartHour;hour<scheduleEndHour;hour+=1){for(const minute of [0,30]){html+=`<tr><td class="time-cell">${escapeHtml(timeLabel(hour,minute))}</td>`;dates.forEach(date=>{const key=scheduleRecordKey(date,hour,minute),item=data[key]||{};html+=`<td><div class="schedule-slot" data-schedule-key="${key}" data-record-id="${escapeHtml(item.recordId||"")}" data-job-id="${escapeHtml(item.jobId||"")}" data-customer-id="${escapeHtml(item.customerId||"")}" data-customer-number="${escapeHtml(item.customerNumber||"")}">
    <div class="schedule-id-row"><input class="sched-job" value="${escapeHtml(item.jobNumber||"")}" placeholder="Invoice / Quote #" aria-label="Invoice or quote number" readonly><button type="button" class="schedule-search-button" onclick="openScheduleRecordFinder('${key}')" aria-label="Search quotes and invoices">⌕</button></div>
    <div class="schedule-meta-row"><select class="sched-record-type" aria-label="Record type"><option value=""></option><option ${item.recordType==="Quote"?"selected":""}>Quote</option><option ${item.recordType==="Invoice"?"selected":""}>Invoice</option></select><select class="sched-work-status" aria-label="Work status"><option value=""></option>${["Scheduled","Assigned","On Route","In Progress","Completed","Cancelled"].map(s=>`<option ${item.workStatus===s?"selected":""}>${s}</option>`).join("")}</select></div>
    <input class="sched-customer" value="${escapeHtml(item.customer||"")}" placeholder="Customer" aria-label="Customer name" readonly><input class="sched-service" value="${escapeHtml(item.service||"")}" placeholder="Service" aria-label="Service"></div></td>`;});html+="</tr>";}}
  byId("scheduleBody").innerHTML=html;
};
const saveScheduleV36Base=saveSchedule;
saveSchedule=function(){const data=getScheduleData();document.querySelectorAll(".schedule-slot").forEach(slot=>{const item={recordType:slot.querySelector(".sched-record-type")?.value||"",workStatus:slot.querySelector(".sched-work-status")?.value||"",jobNumber:slot.querySelector(".sched-job")?.value.trim()||"",customer:slot.querySelector(".sched-customer")?.value.trim()||"",service:slot.querySelector(".sched-service")?.value.trim()||"",recordId:slot.dataset.recordId||"",jobId:slot.dataset.jobId||"",customerId:slot.dataset.customerId||"",customerNumber:slot.dataset.customerNumber||""};if(Object.values(item).some(Boolean))data[slot.dataset.scheduleKey]=item;else delete data[slot.dataset.scheduleKey];});localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));byId("scheduleSaveStatus").textContent=`Saved ${new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`;};

function installDemoRecordsV36(){
  if(getSavedInvoices().some(i=>i.isDemo)){alert("The five complete demo records are already installed.");return;}
  const customerTemplates=[
    ["Maria Santos","","772-555-0101","maria.santos@example.com","112 SE Ocean Blvd, Stuart, FL 34994","Full Service",85,"Paid"],
    ["James Walker","Walker Rentals","772-555-0102","james@walkerrentals.example.com","840 NW Federal Hwy, Stuart, FL 34994","Hedge Trim",165,"Unpaid"],
    ["Linda Parker","Seaside Villas HOA","772-555-0103","linda@seasidevillas.example.com","2250 NE Dixie Hwy, Jensen Beach, FL 34957","Debris Removal",240,"Paid"],
    ["Robert Green","","772-555-0104","robert.green@example.com","601 SW Saint Lucie Cres, Stuart, FL 34994","Land Clearing",475,"Unpaid"],
    ["Angela Morris","Treasure Coast Realty","772-555-0105","angela@treasurecoastrealty.example.com","3101 SE Federal Hwy, Stuart, FL 34997","Full Service",120,"Paid"]
  ];
  const customers=readArray(CUSTOMER_STORAGE_KEY),quotes=readArray(QUOTE_STORAGE_KEY),invoices=getSavedInvoices(),schedule=getScheduleData(),today=new Date();
  customerTemplates.forEach((t,index)=>{const customerId=`demo-customer-${index+1}`,customerNumber=`C-DEMO-${String(index+1).padStart(3,"0")}`,jobId=`J-DEMO-${new Date().getFullYear()}-${String(index+1).padStart(3,"0")}`,quoteId=`demo-quote-${index+1}`,invoiceId=`paradise-demo-${index+1}`,quoteNumber=`Q-DEMO-${String(index+1).padStart(3,"0")}`,invoiceNumber=`INV-DEMO-${String(index+1).padStart(3,"0")}`,date=getLocalDateString(addDays(today,-index)),preferredContact=PREFERRED_CONTACT_METHODS[index%PREFERRED_CONTACT_METHODS.length].value;
    customers.push({id:customerId,customerNumber,name:t[0],business:t[1],phone:t[2],email:t[3],preferredContact,billing:t[4],notes:"Complete v3.19 demo customer.",properties:[{name:"Primary Property",address:t[4],gateCode:index===2?"2468":"",mowingHeight:"3.5 inches",hoa:index===2?"Weekdays after 9:00 AM":"",warning:index===0?"Dog in fenced rear yard":"",irrigation:"Avoid sprinkler heads near driveway",notes:"Demo property instructions."}],isDemo:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    quotes.push({id:quoteId,number:quoteNumber,jobId,customerId,customerNumber,customerName:t[0],property:{name:"Primary Property",address:t[4]},phone:t[2],email:t[3],preferredContact,date,validThrough:getLocalDateString(addDays(new Date(date+"T00:00:00"),30)),status:"Accepted",scope:t[5],amount:t[6],frequency:index===0||index===4?"Weekly":"One Time",notes:"Demo quote linked to customer, job, schedule, and invoice.",isDemo:true});
    invoices.push({id:invoiceId,invoiceNumber,jobNumber:invoiceNumber,jobId,customerId,customerNumber,quoteId,invoiceDate:date,dueDate:date,status:t[7],clientName:t[0],businessName:t[1],billingAddress:t[4],cityStateZip:t[4].split(", ").slice(-2).join(", "),phone:t[2],email:t[3],preferredContact,services:[{date,address:t[4],service:t[5],amount:t[6]}],taxRate:"0",taxLabel:"No Tax",paymentCode:index%2===0?"cash":"business-check",paymentRate:"0",paymentMethod:index%2===0?"Cash":"Business Check",notes:index===3?"Demo damage note: photograph and document any property damage before leaving.":"Complete v3.19 demo invoice.",subtotal:t[6],total:t[6],isDemo:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    const scheduled=addDays(today,index),hour=8+index;const key=scheduleRecordKey(scheduled,hour,0);schedule[key]={recordType:"Invoice",workStatus:index<2?"Scheduled":index===2?"Assigned":index===3?"In Progress":"Completed",jobNumber:invoiceNumber,customer:t[0],service:t[5],recordId:invoiceId,jobId,customerId,customerNumber};
  });
  writeArray(CUSTOMER_STORAGE_KEY,customers);writeArray(QUOTE_STORAGE_KEY,quotes);storeInvoices(invoices);localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(schedule));renderCustomerList();populateCustomerSelectors();renderQuotes();renderInvoiceList();renderSchedule();renderCommunicationRecipients();refreshHomeDashboard();alert("Five complete demo customer, quote, schedule, and invoice records installed.");
}
installDemoInvoices=installDemoRecordsV36;
const deleteDemoInvoicesV35=deleteDemoInvoices;
deleteDemoInvoices=function(){
  const demoInvoices=getSavedInvoices().filter(x=>x.isDemo);if(!demoInvoices.length){alert("There are no demo records to delete.");return;}if(!confirm("Delete all complete demo customers, quotes, schedules, and invoices? Real records will not be affected."))return;
  const demoInvoiceIds=new Set(demoInvoices.map(x=>x.id)),demoCustomerIds=new Set(readArray(CUSTOMER_STORAGE_KEY).filter(x=>x.isDemo).map(x=>x.id)),demoQuoteIds=new Set(readArray(QUOTE_STORAGE_KEY).filter(x=>x.isDemo).map(x=>x.id));storeInvoices(getSavedInvoices().filter(x=>!x.isDemo));writeArray(CUSTOMER_STORAGE_KEY,readArray(CUSTOMER_STORAGE_KEY).filter(x=>!x.isDemo));writeArray(QUOTE_STORAGE_KEY,readArray(QUOTE_STORAGE_KEY).filter(x=>!x.isDemo));const schedule=getScheduleData();Object.keys(schedule).forEach(k=>{if(demoInvoiceIds.has(schedule[k].recordId)||demoCustomerIds.has(schedule[k].customerId)||demoQuoteIds.has(schedule[k].recordId))delete schedule[k];});localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(schedule));renderInvoiceList();renderCustomerList();populateCustomerSelectors();renderQuotes();renderSchedule();renderCommunicationRecipients();refreshHomeDashboard();alert("All demo records deleted. Real records were not changed.");
};


const searchableInvoiceTextV36Base=searchableInvoiceText;
searchableInvoiceText=function(invoice){return [searchableInvoiceTextV36Base(invoice),invoice.invoiceNumber,invoice.jobId,invoice.customerNumber].filter(Boolean).join(" ").toLowerCase();};

function initializeV36(){migratePreferredContactsV319();migrateInvoicePaymentMethodsV320();migrateRecordIdentifiersV36();if(byId("scheduleRecordSearch"))byId("scheduleRecordSearch").addEventListener("input",renderScheduleRecordResultsV36);if(byId("invoiceCustomerLink"))byId("invoiceCustomerLink").addEventListener("change",()=>{const c=customerByIdV36(byId("invoiceCustomerLink").value);byId("invoiceCustomerNumber").value=c?.customerNumber||"";PreferredContactComponent.setValue("invoicePreferredContact",preferredContactForRecord(c));});if(byId("jobNumber")&&!byId("jobNumber").value)byId("jobNumber").value=generateInvoiceNumberV36();if(byId("invoiceJobId")&&!byId("invoiceJobId").value)byId("invoiceJobId").value=generateJobIdV36();renderCustomerList();renderQuotes();renderInvoiceList();renderSchedule();renderCommunicationRecipients();}

function startParadiseV36(){startParadiseApplication();setTimeout(initializeV36,0);}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",startParadiseV36,{once:true});
else startParadiseV36();

/* v3.7 simplified schedule workflow */
function scheduleDateFromKeyV37(key){
  const match=String(key||"").match(/^(\d{4}-\d{2}-\d{2})_/);
  return match?match[1]:"";
}
function scheduleIsPastV37(slotKey){
  const date=scheduleDateFromKeyV37(slotKey);
  if(!date)return false;
  const today=getLocalDateString(new Date());
  return date<today;
}
function normalizeScheduleItemV37(item={}){
  return {
    scheduleType:item.scheduleType||item.status||"BP",
    workStatus:item.workStatus==="Completed"?"Completed":"Upcoming",
    jobNumber:item.jobId||item.jobNumber||"",
    customer:item.customer||item.customerName||"",
    recordId:item.recordId||"",
    recordType:item.recordType||"",
    jobId:item.jobId||item.jobNumber||"",
    customerId:item.customerId||"",
    customerNumber:item.customerNumber||""
  };
}
function allScheduleJobsV37(){
  const map=new Map();
  allScheduleRecordsV36().forEach((r)=>{
    const key=r.jobId||`${r.recordType}-${r.recordId}`;
    const existing=map.get(key);
    if(!existing||r.recordType==="Invoice")map.set(key,r);
  });
  return [...map.values()];
}
function renderScheduleRecordResultsV36(){
  const query=(byId("scheduleRecordSearch")?.value||"").toLowerCase();
  const records=allScheduleJobsV37().filter((r)=>searchableScheduleRecordV36(r).includes(query)).slice(0,60);
  byId("scheduleRecordResults").innerHTML=records.length?records.map((r)=>`<button type="button" class="record-card schedule-result" onclick="selectScheduleRecordV37('${r.recordType}','${r.recordId}')"><strong>${escapeHtml(r.jobId||"Job number unavailable")} · ${escapeHtml(r.customer||"Customer")}</strong><span>${escapeHtml(r.recordType)} ${escapeHtml(r.recordNumber||"")}</span><small>${escapeHtml(r.address||"No address")}</small></button>`).join(""):'<p class="empty-message">No matching jobs found.</p>';
}
function selectScheduleRecordV37(type,id){
  const r=allScheduleJobsV37().find((x)=>x.recordType===type&&x.recordId===id);
  const slot=document.querySelector(`.schedule-slot[data-schedule-key="${activeScheduleSlotKeyV36}"]`);
  if(!r||!slot)return;
  slot.querySelector(".sched-job-number").textContent=r.jobId||r.recordNumber||"";
  slot.querySelector(".sched-customer-name").textContent=r.customer||"Customer";
  slot.querySelector(".sched-status-toggle").dataset.status="Upcoming";
  slot.querySelector(".sched-status-toggle").textContent=scheduleIsPastV37(activeScheduleSlotKeyV36)?"Past Due":"Upcoming";
  slot.dataset.recordId=r.recordId||"";
  slot.dataset.recordType=r.recordType||"";
  slot.dataset.jobId=r.jobId||"";
  slot.dataset.customerId=r.customerId||"";
  slot.dataset.customerNumber=r.customerNumber||"";
  slot.dataset.customer=r.customer||"";
  closeScheduleRecordFinder();
  saveSchedule();
  renderSchedule();
  showScheduleCustomerCardV36(r);
  byId("scheduleSelectedRecord").textContent=r.jobId||r.recordNumber||"Job";
}
function findScheduleRecordForSlotV37(slot){
  const jobId=slot?.dataset.jobId||slot?.querySelector(".sched-job-number")?.textContent.trim()||"";
  const recordId=slot?.dataset.recordId||"";
  return allScheduleJobsV37().find((r)=>(recordId&&r.recordId===recordId)||(jobId&&r.jobId===jobId));
}
function showScheduleAddressV37(slotKey){
  const slot=document.querySelector(`.schedule-slot[data-schedule-key="${slotKey}"]`);
  const record=findScheduleRecordForSlotV37(slot);
  if(!record){alert("Select a job with the search button first.");return;}
  activeScheduleSlotKeyV36=slotKey;
  showScheduleCustomerCardV36(record,slotKey);
  byId("scheduleSelectedRecord").textContent=record.jobId||record.recordNumber||"Job";
}
function openScheduleMapV319(slotKey){
  const slot=document.querySelector(`.schedule-slot[data-schedule-key="${slotKey}"]`);
  const record=findScheduleRecordForSlotV37(slot);
  if(!record){alert("Select a job with the search button first.");return;}
  const address=record.address||"";
  if(!address){alert("This job does not have a service address saved.");return;}
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,"_blank","noopener");
}
function deleteScheduleJobV319(slotKey){
  const data=getScheduleData();
  if(!data[slotKey])return;
  const item=normalizeScheduleItemV37(data[slotKey]);
  const label=[item.jobNumber,item.customer].filter(Boolean).join(" · ")||"this scheduled job";
  if(!confirm(`Remove ${label} from the schedule?`))return;
  delete data[slotKey];
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));
  if(activeScheduleSlotKeyV36===slotKey)clearScheduleSelection();
  renderSchedule();
  byId("scheduleSaveStatus").textContent="Scheduled job removed.";
  if(typeof refreshHomeDashboard==="function")refreshHomeDashboard();
}
function wireScheduleInteractionsV319(){
  byId("scheduleBody")?.querySelectorAll("[data-schedule-details]").forEach((button)=>{
    button.addEventListener("click",()=>showScheduleAddressV37(button.dataset.scheduleDetails));
  });
}
function toggleScheduleStatusV37(button){
  const next=button.dataset.status==="Completed"?"Upcoming":"Completed";
  button.dataset.status=next;
  const slot=button.closest(".schedule-slot");
  button.textContent=next==="Upcoming"&&scheduleIsPastV37(slot.dataset.scheduleKey)?"Past Due":next;
  button.classList.toggle("is-completed",next==="Completed");
  button.classList.toggle("is-past-due",next==="Upcoming"&&scheduleIsPastV37(slot.dataset.scheduleKey));
  saveSchedule();
}
renderSchedule=function(){
  const data=getScheduleData();
  const dates=Array.from({length:7},(_,index)=>addDays(scheduleAnchor,index));
  byId("scheduleAnchorDate").value=dateKey(scheduleAnchor);
  byId("scheduleHead").innerHTML=`<tr><th>Time</th>${dates.map((date)=>`<th>${escapeHtml(displayDay(date))}</th>`).join("")}</tr>`;
  let html="";
  for(let hour=scheduleStartHour;hour<scheduleEndHour;hour+=1){
    for(const minute of [0,30]){
      html+=`<tr><td class="time-cell">${escapeHtml(timeLabel(hour,minute))}</td>`;
      dates.forEach((date)=>{
        const key=scheduleRecordKey(date,hour,minute);
        const item=normalizeScheduleItemV37(data[key]||{});
        const pastDue=item.workStatus!=="Completed"&&scheduleIsPastV37(key);
        const statusText=item.workStatus==="Completed"?"Completed":pastDue?"Past Due":"Upcoming";
        html+=`<td><div class="schedule-slot" data-schedule-key="${key}" data-record-id="${escapeHtml(item.recordId)}" data-record-type="${escapeHtml(item.recordType)}" data-job-id="${escapeHtml(item.jobId)}" data-customer-id="${escapeHtml(item.customerId)}" data-customer-number="${escapeHtml(item.customerNumber)}" data-customer="${escapeHtml(item.customer)}">
          <div class="schedule-main-row">
            <select class="sched-type" aria-label="Schedule type"><option value="BP" ${item.scheduleType==="BP"?"selected":""}>BP</option><option value="E1" ${item.scheduleType==="E1"||item.scheduleType==="RS"?"selected":""}>E1</option><option value="E2" ${item.scheduleType==="E2"?"selected":""}>E2</option><option value="E3" ${item.scheduleType==="E3"?"selected":""}>E3</option></select>
            <button type="button" class="schedule-search-button" onclick="openScheduleRecordFinder('${key}')" aria-label="Search jobs">⌕</button>
            <button type="button" class="sched-job job-number-button" data-schedule-details="${key}"><span class="sched-job-number">${escapeHtml(item.jobNumber||"Job Number")}</span><span class="sched-customer-name">${escapeHtml(item.customer||"")}</span></button>
            <button type="button" class="schedule-map-button" onclick="openScheduleMapV319('${key}')" aria-label="Open job address in maps" title="Open Map">📍</button>
            <button type="button" class="schedule-delete-button" onclick="deleteScheduleJobV319('${key}')" aria-label="Remove job from schedule" title="Delete">×</button>
          </div>
          <button type="button" class="sched-status-toggle ${item.workStatus==="Completed"?"is-completed":""} ${pastDue?"is-past-due":""}" data-status="${escapeHtml(item.workStatus)}" onclick="toggleScheduleStatusV37(this)">${statusText}</button>
        </div></td>`;
      });
      html+="</tr>";
    }
  }
  byId("scheduleBody").innerHTML=html;
  wireScheduleInteractionsV319();
};
saveSchedule=function(){
  const data=getScheduleData();
  document.querySelectorAll(".schedule-slot").forEach((slot)=>{
    const displayedJob=slot.querySelector(".sched-job-number")?.textContent.trim()||"";
    const jobNumber=displayedJob==="Job Number"?"":displayedJob;
    const customer=slot.dataset.customer||slot.querySelector(".sched-customer-name")?.textContent.trim()||"";
    const item={scheduleType:slot.querySelector(".sched-type")?.value||"BP",workStatus:slot.querySelector(".sched-status-toggle")?.dataset.status||"Upcoming",jobNumber,customer,recordId:slot.dataset.recordId||"",recordType:slot.dataset.recordType||"",jobId:slot.dataset.jobId||jobNumber,customerId:slot.dataset.customerId||"",customerNumber:slot.dataset.customerNumber||""};
    if(jobNumber||item.recordId)data[slot.dataset.scheduleKey]=item;else delete data[slot.dataset.scheduleKey];
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));
  byId("scheduleSaveStatus").textContent=`Saved ${new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`;
};
const installDemoRecordsV37Base=installDemoInvoices;
installDemoInvoices=function(){
  installDemoRecordsV37Base();
  const data=getScheduleData();
  Object.keys(data).forEach((key,index)=>{
    if(String(data[key].recordId||"").startsWith("paradise-demo-")){
      data[key]={...normalizeScheduleItemV37(data[key]),scheduleType:["BP","E1","E2","E3"][index%4],workStatus:index===4?"Completed":"Upcoming"};
    }
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));
  renderSchedule();
};

/* Paradise Lawn Care Operations Suite v3.8 - customer billing schedules and owner's action center */
const BILLING_VERSION_V38 = "3.19";
const normalizeScheduleItemV37Base = normalizeScheduleItemV37;
normalizeScheduleItemV37 = function(item={}){
  const normalized=normalizeScheduleItemV37Base(item);
  const savedStatus=String(item.workStatus||"").trim();
  if(savedStatus==="Cancelled"||savedStatus==="Canceled")normalized.workStatus=savedStatus;
  return {...normalized, completedAt:item.completedAt||"", billingInvoiceId:item.billingInvoiceId||""};
};

function billingMethodForCustomerV38(customer){return customer?.billingMethod||"Per Service";}
function billingAnchorForCustomerV38(customer){return customer?.billingAnchor||customer?.createdAt?.slice(0,10)||getLocalDateString();}
function updateBillingHelpV38(){
  const method=byId("customerBillingMethod")?.value||"Per Service";
  const help=byId("customerBillingHelp"); if(!help)return;
  help.textContent=method==="Per Service"?"Each completed service becomes ready to invoice immediately.":method==="Bi-Weekly"?"Completed services are grouped into a single invoice every 14 days from the selected start date.":"Completed services are grouped into one invoice each month using the selected date as the billing day.";
}

const blankCustomerFormV38Base=blankCustomerForm;
blankCustomerForm=function(){
  blankCustomerFormV38Base();
  if(byId("customerNumberDisplay"))byId("customerNumberDisplay").textContent="Not assigned";
  if(byId("customerBillingMethod"))byId("customerBillingMethod").value="Per Service";
  if(byId("customerBillingAnchor"))byId("customerBillingAnchor").value=getLocalDateString();
  if(byId("customerInvoiceSearch"))byId("customerInvoiceSearch").value="";
  if(byId("customerInvoiceCount"))byId("customerInvoiceCount").textContent="0 invoices";
  if(byId("customerInvoiceHistory"))byId("customerInvoiceHistory").innerHTML='<p class="empty-message">Select a customer to view invoice history.</p>';
  updateBillingHelpV38();
};
const loadCustomerV38Base=loadCustomer;
loadCustomer=function(id){loadCustomerV38Base(id);const c=readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===id);if(byId("customerBillingMethod"))byId("customerBillingMethod").value=billingMethodForCustomerV38(c);if(byId("customerBillingAnchor"))byId("customerBillingAnchor").value=billingAnchorForCustomerV38(c);updateBillingHelpV38();};
const saveCustomerV38Base=saveCustomer;
saveCustomer=function(){
  saveCustomerV38Base();
  if(!activeCustomerId)return;
  const list=readArray(CUSTOMER_STORAGE_KEY),c=list.find(x=>x.id===activeCustomerId);if(!c)return;
  c.billingMethod=byId("customerBillingMethod")?.value||"Per Service";
  c.billingAnchor=byId("customerBillingAnchor")?.value||getLocalDateString();
  writeArray(CUSTOMER_STORAGE_KEY,list);renderCustomerList();refreshHomeDashboard();
};
const renderCustomerListV38Base=renderCustomerList;
renderCustomerList=function(){renderCustomerListV38Base();const host=byId("customerList");if(!host)return;const customers=readArray(CUSTOMER_STORAGE_KEY);host.querySelectorAll(".record-card").forEach(btn=>{const name=btn.querySelector("strong")?.textContent;const c=customers.find(x=>(x.name||x.business)===name);if(c)btn.querySelector("small").textContent+=` · ${billingMethodForCustomerV38(c)}`;});};

function dateDiffDaysV38(a,b){return Math.floor((new Date(`${b}T00:00:00`)-new Date(`${a}T00:00:00`))/86400000);}
function addDaysStringV38(value,days){return getLocalDateString(addDays(new Date(`${value}T00:00:00`),days));}
function completedScheduleServicesV38(){
  const data=getScheduleData(),records=allScheduleJobsV37(),invoices=getSavedInvoices();
  return Object.entries(data).map(([key,item])=>{
    const normalized=normalizeScheduleItemV37(item);if(normalized.workStatus!=="Completed"||normalized.billingInvoiceId)return null;
    const record=records.find(r=>(normalized.recordId&&r.recordId===normalized.recordId)||(normalized.jobId&&r.jobId===normalized.jobId));
    const representedByInvoice=invoices.some(i=>(normalized.recordId&&i.id===normalized.recordId)||(normalized.jobId&&i.jobId===normalized.jobId)||(record?.recordType==="Invoice"&&record.recordId&&i.id===record.recordId)||(record?.recordType==="Quote"&&record.recordId&&i.quoteId===record.recordId));
    if(representedByInvoice)return null;
    const customer=customerByIdV36(normalized.customerId||record?.customerId);if(!customer)return null;
    const date=scheduleDateFromKeyV37(key),invoice=null,quote=record?.recordType==="Quote"?readArray(QUOTE_STORAGE_KEY).find(q=>q.id===record.recordId):null;
    const amount=Number(invoice?.total||quote?.amount||0),service=invoice?.services?.[0]?.service||quote?.scope||record?.service||"Lawn service",address=addressForRecordV36(invoice||quote||record);
    return {key,item:normalized,record,customer,date,amount,service,address,jobId:normalized.jobId||record?.jobId||""};
  }).filter(Boolean);
}
function billingPeriodV38(service){
  const method=billingMethodForCustomerV38(service.customer),today=getLocalDateString(),anchor=billingAnchorForCustomerV38(service.customer);
  if(method==="Per Service")return {key:`service:${service.key}`,label:formatDateLong(service.date),ready:true,readyDate:service.date};
  if(method==="Bi-Weekly"){
    const diff=Math.max(0,dateDiffDaysV38(anchor,service.date)),index=Math.floor(diff/14),start=addDaysStringV38(anchor,index*14),end=addDaysStringV38(start,13),readyDate=addDaysStringV38(end,1);
    return {key:`biweekly:${start}`,label:`${formatDateLong(start)} – ${formatDateLong(end)}`,ready:service.customer?.isDemo||today>=readyDate,readyDate};
  }
  const day=Math.min(28,Math.max(1,new Date(`${anchor}T00:00:00`).getDate())),month=service.date.slice(0,7),readyDate=`${month}-${String(day).padStart(2,"0")}`;
  return {key:`monthly:${month}`,label:new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined,{month:"long",year:"numeric"}),ready:service.customer?.isDemo||today>=readyDate,readyDate};
}
function billingGroupsV38(){
  const groups=new Map();completedScheduleServicesV38().forEach(s=>{const period=billingPeriodV38(s),key=`${s.customer.id}|${period.key}`;if(!groups.has(key))groups.set(key,{key,customer:s.customer,method:billingMethodForCustomerV38(s.customer),period,services:[],total:0});const g=groups.get(key);g.services.push(s);g.total+=s.amount;});return [...groups.values()];
}
function billingSummaryV38(){
  const groups=billingGroupsV38(),ready=groups.filter(g=>g.period.ready),per=ready.filter(g=>g.method==="Per Service"),bi=ready.filter(g=>g.method==="Bi-Weekly"),monthly=ready.filter(g=>g.method==="Monthly"),invoices=getSavedInvoices(),email=invoices.filter(i=>i.communicationStatus==="Ready to Email"&&(i.status||"Unpaid")!=="Paid");
  return {groups,ready,per,bi,monthly,email,readyTotal:ready.reduce((s,g)=>s+g.total,0)};
}
function generateBillingInvoiceV38(groupKey){
  const group=billingGroupsV38().find(g=>g.key===groupKey);if(!group||!group.period.ready){alert("That billing period is not ready yet.");return;}
  const invoices=getSavedInvoices(),number=generateInvoiceNumberV36(),jobId=group.services[0]?.jobId||generateJobIdV36(),today=getLocalDateString();
  const invoice={id:makeId("invoice"),invoiceNumber:number,jobNumber:number,jobId,customerId:group.customer.id,customerNumber:group.customer.customerNumber,invoiceDate:today,dueDate:addDaysStringV38(today,14),status:"Unpaid",communicationStatus:"Ready to Email",clientName:group.customer.name||"",businessName:group.customer.business||"",billingAddress:group.customer.billing||group.services[0]?.address||"",cityStateZip:"",phone:group.customer.phone||"",email:group.customer.email||"",preferredContact:preferredContactForRecord(group.customer),services:group.services.map(s=>({date:s.date,address:s.address,service:s.service,amount:s.amount})),taxRate:"0",taxLabel:"No Tax",paymentCode:"business-check",paymentRate:"0",paymentMethod:"Business Check",notes:`${group.method} billing: ${group.period.label}`,subtotal:group.total,total:group.total,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  invoices.push(invoice);storeInvoices(invoices);const schedule=getScheduleData();group.services.forEach(s=>{if(schedule[s.key])schedule[s.key].billingInvoiceId=invoice.id;});localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(schedule));renderInvoiceList();renderSchedule();refreshHomeDashboard();renderBillingCenterV38();alert(`Invoice ${number} created and placed in Ready to Email.`);
}
function markInvoiceEmailedV38(id){const invoices=getSavedInvoices(),i=invoices.find(x=>x.id===id);if(!i)return;i.communicationStatus="Emailed";i.emailedAt=new Date().toISOString();storeInvoices(invoices);refreshHomeDashboard();renderBillingCenterV38();}
function openBillingInvoiceV38(id){closeBillingCenter();switchTab("invoiceTab");loadInvoice(id);}
function openBillingCenter(){renderBillingCenterV38();byId("billingCenterModal").hidden=false;}
function closeBillingCenter(){byId("billingCenterModal").hidden=true;}
function renderBillingCenterV38(){
  const host=byId("billingCenterList"),summary=billingSummaryV38();if(!host)return;
  byId("billingCenterSummary").innerHTML=[["Per Service Ready",summary.per.length],["Bi-Weekly Ready",summary.bi.length],["Monthly Ready",summary.monthly.length],["Ready to Email",summary.email.length],["Unbilled Total",summary.readyTotal,true]].map(([l,v,m])=>`<article class="intelligence-card"><span>${l}</span><strong>${m?formatMoney(v):v}</strong></article>`).join("");
  const readyHtml=summary.ready.length?summary.ready.map(g=>`<article class="billing-record"><div><strong>${escapeHtml(customerLabelV36(g.customer))}</strong><small>${escapeHtml(g.customer.customerNumber||"")} · ${escapeHtml(g.method)}</small></div><div>${escapeHtml(g.period.label)}<small>${g.services.length} completed service${g.services.length===1?"":"s"}</small></div><strong>${formatMoney(g.total)}</strong><div class="billing-record-actions"><button type="button" onclick="generateBillingInvoiceV38('${g.key}')">Create Invoice</button></div></article>`).join(""):'<p class="empty-message">No completed billing periods are ready.</p>';
  const emailHtml=summary.email.length?summary.email.map(i=>`<article class="billing-record"><div><strong>${escapeHtml(i.jobNumber)}</strong><small>${escapeHtml(i.clientName||i.businessName||"Customer")}</small></div><div>${escapeHtml(i.email||"No email address")}<small>Due ${formatDisplayDate(i.dueDate)}</small></div><strong>${formatMoney(i.total)}</strong><div class="billing-record-actions"><button type="button" onclick="openBillingInvoiceV38('${i.id}')">Open</button><button type="button" onclick="markInvoiceEmailedV38('${i.id}')">Mark Emailed</button></div></article>`).join(""):'<p class="empty-message">No invoices are waiting to be emailed.</p>';
  host.innerHTML=`<section class="billing-group"><h3>Ready to Generate</h3>${readyHtml}</section><section class="billing-group"><h3>Ready to Email</h3>${emailHtml}</section>`;
}

const refreshHomeDashboardV38Base=refreshHomeDashboard;
refreshHomeDashboard=function(){
  refreshHomeDashboardV38Base();const s=billingSummaryV38();
  if(byId("homeBillingCenter"))byId("homeBillingCenter").innerHTML=`<div class="financial-table"><div><span>Per-Service Ready</span><strong>${s.per.length}</strong></div><div><span>Bi-Weekly Ready</span><strong>${s.bi.length}</strong></div><div><span>Monthly Ready</span><strong>${s.monthly.length}</strong></div><div class="financial-total"><strong>Waiting to Invoice</strong><strong>${formatMoney(s.readyTotal)}</strong></div></div>`;
  if(byId("homeCommunicationCenter"))byId("homeCommunicationCenter").innerHTML=`<div class="simple-list"><p><strong>${s.email.length}</strong> invoice${s.email.length===1?" is":"s are"} ready to email.</p><p><strong>${getSavedInvoices().filter(i=>i.communicationStatus==="Emailed"&&(i.status||"Unpaid")!=="Paid").length}</strong> emailed invoice${getSavedInvoices().filter(i=>i.communicationStatus==="Emailed"&&(i.status||"Unpaid")!=="Paid").length===1?" remains":"s remain"} unpaid.</p></div>`;
  const priorities=[];if(s.ready.length)priorities.push(`Generate ${s.ready.length} ready billing batch${s.ready.length===1?"":"es"} totaling ${formatMoney(s.readyTotal)}.`);if(s.email.length)priorities.push(`Email ${s.email.length} completed invoice${s.email.length===1?"":"s"}.`);const past=Object.entries(getScheduleData()).filter(([k,v])=>normalizeScheduleItemV37(v).workStatus!=="Completed"&&scheduleIsPastV37(k)).length;if(past)priorities.push(`Review ${past} past-due scheduled job${past===1?"":"s"}.`);const alerts=buildCurrentAlerts();if(alerts.length)priorities.push(`Resolve ${alerts.length} active alert${alerts.length===1?"":"s"}.`);if(!priorities.length)priorities.push("No urgent billing, scheduling, or alert tasks are waiting.");
  if(byId("homePriorities"))byId("homePriorities").innerHTML=`<div class="priority-list">${priorities.slice(0,5).map((p,i)=>`<div class="priority-item"><span class="priority-number">${i+1}</span><span>${escapeHtml(p)}</span></div>`).join("")}</div>`;
  const briefing=byId("ownerBriefing");if(briefing){const additions=[];if(s.bi.length)additions.push(`${s.bi.length} bi-weekly invoice batch${s.bi.length===1?" is":"es are"} ready to generate.`);if(s.monthly.length)additions.push(`${s.monthly.length} monthly invoice batch${s.monthly.length===1?" is":"es are"} ready to generate.`);if(s.per.length)additions.push(`${s.per.length} per-service invoice${s.per.length===1?" is":"s are"} ready to generate.`);if(s.email.length)additions.push(`${s.email.length} invoice${s.email.length===1?" is":"s are"} ready to email.`);briefing.insertAdjacentHTML("beforeend",additions.map(x=>`<p><strong>${escapeHtml(x)}</strong></p>`).join(""));}
};

const toggleScheduleStatusV38Base=toggleScheduleStatusV37;
toggleScheduleStatusV37=function(button){
  const becomingCompleted=button.dataset.status!=="Completed";toggleScheduleStatusV38Base(button);const slot=button.closest(".schedule-slot"),data=getScheduleData(),key=slot.dataset.scheduleKey;if(data[key]){data[key].completedAt=becomingCompleted?new Date().toISOString():"";if(!becomingCompleted)data[key].billingInvoiceId="";localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));}refreshHomeDashboard();
};
const saveScheduleV38Base=saveSchedule;
saveSchedule=function(){
  const previous=getScheduleData();
  saveScheduleV38Base();
  const current=getScheduleData();
  Object.keys(current).forEach(k=>{
    current[k]={
      ...(previous[k]||{}),
      ...current[k],
      completedAt:previous[k]?.completedAt||current[k].completedAt||"",
      billingInvoiceId:previous[k]?.billingInvoiceId||current[k].billingInvoiceId||""
    };
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(current));
  refreshHomeDashboard();
};

const installDemoInvoicesV38Base=installDemoInvoices;
installDemoInvoices=function(){
  installDemoInvoicesV38Base();const methods=["Per Service","Bi-Weekly","Monthly","Bi-Weekly","Monthly"],customers=readArray(CUSTOMER_STORAGE_KEY);customers.filter(c=>c.isDemo).forEach((c,i)=>{c.billingMethod=methods[i%methods.length];c.billingAnchor=addDaysStringV38(getLocalDateString(),-35);});writeArray(CUSTOMER_STORAGE_KEY,customers);
  const schedule=getScheduleData();Object.keys(schedule).filter(k=>String(schedule[k].recordId||"").startsWith("paradise-demo-")).forEach((k,i)=>{schedule[k].workStatus=i===4?"Upcoming":"Completed";schedule[k].completedAt=i===4?"":new Date().toISOString();schedule[k].billingInvoiceId="";});localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(schedule));
  const invoices=getSavedInvoices();invoices.filter(i=>i.isDemo).forEach((i,index)=>{i.communicationStatus=index===0||index===3?"Ready to Email":index===1?"Emailed":"";});storeInvoices(invoices);renderCustomerList();renderSchedule();renderInvoiceList();renderCommunicationRecipients();refreshHomeDashboard();
};

function initializeV38(){
  byId("customerBillingMethod")?.addEventListener("change",updateBillingHelpV38);byId("billingCenterModal")?.addEventListener("click",e=>{if(e.target===e.currentTarget)closeBillingCenter();});updateBillingHelpV38();refreshHomeDashboard();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializeV38,20),{once:true});else setTimeout(initializeV38,20);

/* v3.12 actionable home dashboard */
const DASHBOARD_VERSION_V39="3.19";
let activeHomeJobV39=null;
function scheduleRecordFromDashboardV39(job){
  const jobId=job?.jobId||job?.jobNumber||"",recordId=job?.recordId||"";
  return allScheduleJobsV37().find(r=>(recordId&&r.recordId===recordId)||(jobId&&r.jobId===jobId))||null;
}
function openHomeJobQuickViewV39(slotKey){
  const item=getScheduleData()[slotKey];if(!item)return;
  const job={slotKey,...item,date:scheduleDateFromKeyV37(slotKey),time:slotKey.slice(-4,-2)+":"+slotKey.slice(-2)};
  const record=scheduleRecordFromDashboardV39(job),customer=readArray(CUSTOMER_STORAGE_KEY).find(c=>c.id===(job.customerId||record?.customerId));
  const invoice=getSavedInvoices().find(i=>i.id===(job.billingInvoiceId||((record?.recordType==="Invoice")?record.recordId:""))||i.jobId===(job.jobId||job.jobNumber));
  activeHomeJobV39={job,record,customer,invoice};
  byId("homeJobQuickViewTitle").textContent=job.jobId||job.jobNumber||"Scheduled Job";
  byId("homeJobQuickViewSubtitle").textContent=`${formatDateLong(job.date)} at ${job.time}`;
  const address=record?.address||customer?.properties?.[0]?.address||"No address available";
  const name=record?.customer||customerLabelV36(customer);
  byId("homeJobQuickViewDetails").innerHTML=`<div><span>Customer</span><strong>${escapeHtml(name)}</strong></div><div><span>Status</span><strong>${escapeHtml(job.workStatus||"Upcoming")}</strong></div><div class="full-span"><span>Service Address</span><strong>${escapeHtml(address)}</strong></div><div><span>Customer ID</span><strong>${escapeHtml(customer?.customerNumber||job.customerNumber||"—")}</strong></div><div><span>Invoice</span><strong>${escapeHtml(invoice?.jobNumber||invoice?.invoiceNumber||"Not created")}</strong></div>`;
  const actions=[];
  if(customer)actions.push(`<button type="button" onclick="openHomeCustomerV39('${customer.id}')">Open Customer</button>`);
  if(invoice)actions.push(`<button type="button" onclick="openHomeInvoiceV39('${invoice.id}')">Open Invoice</button>`);
  actions.push(`<button type="button" onclick="openHomeScheduleJobV39('${slotKey}')">Open Schedule</button>`);
  actions.push(`<button type="button" class="secondary-button" onclick="closeHomeJobQuickViewV39()">Close</button>`);
  byId("homeJobQuickViewActions").innerHTML=actions.join("");byId("homeJobQuickViewModal").hidden=false;
}
function closeHomeJobQuickViewV39(){byId("homeJobQuickViewModal").hidden=true;activeHomeJobV39=null;}
function openHomeCustomerV39(id){closeHomeJobQuickViewV39();switchTab("customersTab");loadCustomer(id);window.scrollTo({top:0,behavior:"smooth"});}
function openHomeInvoiceV39(id){closeHomeJobQuickViewV39();switchTab("invoiceTab");loadInvoice(id);window.scrollTo({top:0,behavior:"smooth"});}
function openHomeScheduleJobV39(slotKey){closeHomeJobQuickViewV39();switchTab("scheduleTab");setTimeout(()=>{const slot=document.querySelector(`.schedule-slot[data-schedule-key="${slotKey}"]`);slot?.scrollIntoView({behavior:"smooth",block:"center"});slot?.classList.add("record-focus-highlight");setTimeout(()=>slot?.classList.remove("record-focus-highlight"),2200);},80);}
function dashboardAttentionItemsV39(){
  const items=[];
  buildCurrentAlerts().forEach(a=>items.push({kind:a.type==="Invoice"?"invoice":"maintenance",title:a.title,detail:a.detail,id:a.sourceId,urgent:true}));
  const billing=billingSummaryV38();
  billing.ready.forEach(g=>items.push({kind:"billing",title:`${customerLabelV36(g.customer)} · ${g.method} billing ready`,detail:`${g.period.label} · ${g.services.length} service${g.services.length===1?"":"s"} · ${formatMoney(g.total)}`,key:g.key}));
  billing.email.forEach(i=>items.push({kind:"email",title:`${i.jobNumber} ready to email`,detail:`${i.clientName||i.businessName||"Customer"} · ${formatMoney(i.total)}`,id:i.id}));
  Object.entries(getScheduleData()).forEach(([key,item])=>{if(scheduleIsPastV37(key)&&(item.workStatus||"Upcoming")!=="Completed")items.push({kind:"schedule",title:`${item.jobId||item.jobNumber||"Job"} is past schedule`,detail:`Scheduled ${formatDateLong(scheduleDateFromKeyV37(key))} · Open scheduling to complete or reschedule`,key,urgent:true});});
  return items;
}
function openDashboardAttentionV39(kind,idOrKey){
  if(kind==="invoice"||kind==="email"){switchTab("invoiceTab");loadInvoice(idOrKey);window.scrollTo({top:0,behavior:"smooth"});return;}
  if(kind==="billing"){openBillingCenter();setTimeout(()=>document.querySelector(".billing-center-modal")?.scrollIntoView({behavior:"smooth",block:"start"}),30);return;}
  if(kind==="schedule"){openHomeScheduleJobV39(idOrKey);return;}
  if(kind==="maintenance"){switchTab("maintenanceTab");setTimeout(()=>{document.querySelector(`[data-equipment-key="${idOrKey}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});},80);return;}
  switchTab("alertsTab");
}
const refreshHomeDashboardV39Base=refreshHomeDashboard;
refreshHomeDashboard=function(){
  refreshHomeDashboardV39Base();
  const today=getLocalDateString(),data=getScheduleData();
  const todayEntries=Object.entries(data).filter(([key])=>key.startsWith(today)).sort(([a],[b])=>a.localeCompare(b));
  if(byId("homeTodaySchedule"))byId("homeTodaySchedule").innerHTML=todayEntries.length?`<div class="insight-list">${todayEntries.map(([key,j])=>`<button type="button" class="dashboard-action-item is-schedule" onclick="openHomeJobQuickViewV39('${key}')"><strong>${escapeHtml(key.slice(-4,-2)+":"+key.slice(-2))} · ${escapeHtml(j.jobId||j.jobNumber||"Scheduled Job")}</strong><span>${escapeHtml(j.workStatus||"Upcoming")} · Click for address, customer, or invoice</span></button>`).join("")}</div>`:'<p class="empty-message">No jobs entered for today.</p>';
  const attention=dashboardAttentionItemsV39();
  if(byId("homeAttention"))byId("homeAttention").innerHTML=attention.length?`<div class="insight-list issue-list">${attention.slice(0,10).map(a=>`<button type="button" class="dashboard-action-item ${a.urgent?"is-urgent":a.kind==="billing"?"is-billing":a.kind==="email"?"is-communication":""}" onclick="openDashboardAttentionV39('${a.kind}','${a.id||a.key||""}')"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.detail)}</span><small>Open the screen that needs attention</small></button>`).join("")}</div>`:'<p class="empty-message">No immediate alerts.</p>';
  refreshAlerts();
};
function initializeV39(){byId("homeJobQuickViewModal")?.addEventListener("click",e=>{if(e.target===e.currentTarget)closeHomeJobQuickViewV39();});refreshHomeDashboard();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializeV39,40),{once:true});else setTimeout(initializeV39,40);


/* Paradise Lawn Care Operations Suite v3.17 - Touch property selection and preferred contact */
function chooseCustomerPropertiesV317(customer) {
  const properties = Array.isArray(customer?.properties) ? customer.properties.filter(p => p && (p.name || p.address)) : [];
  if (properties.length <= 1) return Promise.resolve(properties);

  return new Promise(resolve => {
    let modal = byId("customerPropertyPickerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "customerPropertyPickerModal";
      modal.className = "modal property-picker-modal";
      modal.hidden = true;
      modal.innerHTML = `<div class="modal-card property-picker-card" role="dialog" aria-modal="true" aria-labelledby="propertyPickerTitle">
        <div class="modal-header"><div><h2 id="propertyPickerTitle">Choose Property</h2><p>Tap one property, or select all properties.</p></div><button type="button" class="close-button" data-property-cancel>×</button></div>
        <div id="propertyPickerChoices" class="property-picker-choices"></div>
        <div class="compact-actions property-picker-footer"><button type="button" class="secondary-button" data-property-cancel>Cancel</button></div>
      </div>`;
      document.body.appendChild(modal);
    }

    const choices = byId("propertyPickerChoices");
    choices.innerHTML = `<button type="button" class="property-choice select-all-property" data-property-index="all"><strong>Select All Properties</strong><span>Create one invoice with a service line for every property.</span></button>` + properties.map((property,index)=>`<button type="button" class="property-choice" data-property-index="${index}"><strong>${escapeHtml(property.name||`Property ${index+1}`)}</strong><span>${escapeHtml(property.address||"No address entered")}</span></button>`).join("");

    const finish = value => {
      modal.hidden = true;
      modal.onclick = null;
      resolve(value);
    };
    modal.onclick = event => {
      const choice = event.target.closest("[data-property-index]");
      if (choice) {
        finish(choice.dataset.propertyIndex === "all" ? properties : [properties[Number(choice.dataset.propertyIndex)]]);
        return;
      }
      if (event.target.closest("[data-property-cancel]") || event.target === modal) finish(undefined);
    };
    modal.hidden = false;
  });
}

async function createInvoiceFromCustomerV316() {
  const name = byId("customerName")?.value.trim() || "";
  const business = byId("customerBusiness")?.value.trim() || "";
  if (!name && !business) {
    alert("Enter a customer or business name first.");
    return;
  }

  // Save the current form without requiring the user to press Save Customer first.
  const customers = readArray(CUSTOMER_STORAGE_KEY);
  const customerId = activeCustomerId || makeId("customer");
  const existingIndex = customers.findIndex(customer => customer.id === customerId);
  const previous = existingIndex >= 0 ? customers[existingIndex] : null;
  const customer = {
    ...previous,
    id: customerId,
    customerNumber: previous?.customerNumber || (typeof generateCustomerNumberV36 === "function" ? generateCustomerNumberV36() : ""),
    name,
    business,
    phone: byId("customerPhone")?.value.trim() || "",
    email: byId("customerEmail")?.value.trim() || "",
    preferredContact: PreferredContactComponent.sync("customerPreferredContact") || preferredContactForRecord(previous),
    billing: formatCustomerBillingAddress(customerBillingAddressFromForm()),
    billingStreet: byId("customerBilling")?.value.trim() || "",
    billingCity: byId("customerCity")?.value.trim() || "",
    billingState: byId("customerState")?.value.trim().toUpperCase() || "",
    billingZip: byId("customerZip")?.value.trim() || "",
    notes: byId("customerNotes")?.value.trim() || "",
    properties: collectProperties(),
    billingMethod: byId("customerBillingMethod")?.value || previous?.billingMethod || "Per Service",
    billingAnchor: byId("customerBillingAnchor")?.value || previous?.billingAnchor || getLocalDateString(),
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existingIndex >= 0) customers[existingIndex] = customer; else customers.push(customer);
  writeArray(CUSTOMER_STORAGE_KEY, customers);
  activeCustomerId = customerId;
  if (byId("customerId")) byId("customerId").value = customerId;
  if (byId("customerNumberDisplay")) byId("customerNumberDisplay").textContent = customer.customerNumber || "Assigned";

  const selectedProperties = await chooseCustomerPropertiesV317(customer);
  if (selectedProperties === undefined) return;
  const propertiesForInvoice = selectedProperties.length ? selectedProperties : [{address: customer.billing || "", name: "Billing Address"}];

  activeInvoiceId = null;
  pendingInvoiceCustomerId = customerId;
  pendingInvoiceQuoteId = null;
  clearInvoiceFields();
  byId("jobNumber").value = typeof generateInvoiceNumberV36 === "function" ? generateInvoiceNumberV36() : generateJobNumber();
  if (byId("invoiceJobId")) byId("invoiceJobId").value = typeof generateJobIdV36 === "function" ? generateJobIdV36() : "";
  if (byId("invoiceCustomerNumber")) byId("invoiceCustomerNumber").value = customer.customerNumber || "";
  byId("todayDate").value = getLocalDateString();
  if (byId("dueDate") && !byId("dueDate").value) {
    byId("dueDate").value = typeof addDaysStringV38 === "function" ? addDaysStringV38(getLocalDateString(), 14) : getLocalDateString();
  }
  byId("clientName").value = customer.name || "";
  byId("businessName").value = customer.business || "";
  byId("phone").value = customer.phone || "";
  byId("email").value = customer.email || "";
  PreferredContactComponent.setValue("invoicePreferredContact", customer.preferredContact);
  byId("billingAddress").value = customer.billing || "";
  byId("cityStateZip").value = propertiesForInvoice[0]?.address || customer.billing || "";
  byId("notes").value = customer.notes || "";
  resetServiceRows(propertiesForInvoice.map(property => ({date: getLocalDateString(), address: property?.address || customer.billing || "", service: "Full Service", amount: 0})));
  calculateTotals();
  populateCustomerSelectors();
  populateInvoiceLinkSelectors({customerId});
  if (byId("invoiceCustomerLink")) byId("invoiceCustomerLink").value = customerId;

  // Register the draft immediately so it appears in Invoice Finder and Customer History.
  const invoice = collectInvoice();
  invoice.customerId = customerId;
  invoice.customerNumber = customer.customerNumber || "";
  invoice.invoiceNumber = invoice.jobNumber;
  invoice.jobId = byId("invoiceJobId")?.value || invoice.jobId || "";
  invoice.status = invoice.status || "Unpaid";
  const invoices = getSavedInvoices();
  invoices.push(invoice);
  storeInvoices(invoices);
  activeInvoiceId = invoice.id;
  showEditingBanner(invoice.jobNumber);
  renderCustomerList();
  renderInvoiceList();
  renderCustomerInvoiceHistory();
  if (typeof refreshHomeDashboard === "function") refreshHomeDashboard();
  switchTab("invoiceTab");
  window.scrollTo({top: 0, behavior: "smooth"});
  alert(`Invoice ${invoice.jobNumber} was created and linked to ${customer.name || customer.business}.`);
}

/* v3.16 Complete - Weather Command Center */
const WEATHER_DEFAULT = { name: "Stuart", lat: 27.1975, lon: -80.2528 };
const WEATHER_BOUNDS = [[26.74, -80.58], [27.62, -79.92]];
let weatherMap = null;
let radarFrames = [];
let radarLayer = null;
let radarLayers = [];
let radarFrameIndex = 0;
let radarTimer = null;
let weatherInitialized = false;
let activeWeatherLocation = { ...WEATHER_DEFAULT };
let radarLoadPromiseV319 = null;
let radarTileFailureReportedV319 = false;
function cToF(value) { return value == null ? null : Math.round((Number(value) * 9 / 5) + 32); }
function kphToMph(value) { return value == null ? null : Math.round(Number(value) * 0.621371); }
function weatherText(id, value) { const el = byId(id); if (el) el.textContent = value; }
function setRadarStatusV319(message,isError=false){
  const status=byId("radarStatus");
  if(!status)return;
  status.textContent=message;
  status.classList.toggle("is-error",Boolean(isError));
}
function initializeWeatherMap() {
  const container=byId("weatherRadarMap");
  if(weatherMap){
    window.setTimeout(()=>weatherMap.invalidateSize(),50);
    return weatherMap;
  }
  if(!container)return null;
  if(typeof L==="undefined"){
    setRadarStatusV319("Radar map library did not load. Select Refresh Radar after checking the application files.",true);
    weatherText("radarTimeLabel","Map library unavailable");
    console.warn("Radar initialization failed: Leaflet library unavailable.");
    return null;
  }
  try{
    weatherMap=L.map("weatherRadarMap",{maxBounds:[[26.55,-81.0],[27.85,-79.55]],minZoom:7}).setView([27.18,-80.27],9);
    const base=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap"});
    base.on?.("tileerror",()=>console.warn("Radar base-map tile could not be loaded."));
    base.addTo(weatherMap);
    L.rectangle(WEATHER_BOUNDS,{color:"#2f7d32",weight:2,fillOpacity:.03}).addTo(weatherMap).bindTooltip("Paradise Lawn Care service area");
    [["Fort Pierce",27.4467,-80.3256],["Port St. Lucie",27.2730,-80.3582],["Stuart",27.1975,-80.2528],["Hobe Sound",27.0595,-80.1364],["Jupiter",26.9342,-80.0942],["Palm Beach Gardens",26.8234,-80.1387]].forEach(([name,lat,lon])=>L.circleMarker([lat,lon],{radius:5,weight:2,fillOpacity:.8}).addTo(weatherMap).bindTooltip(name));
    window.setTimeout(()=>weatherMap.invalidateSize(),100);
    setRadarStatusV319("Radar map is ready. Loading current radar frames...");
    return weatherMap;
  }catch(error){
    weatherMap=null;
    setRadarStatusV319("Radar map could not initialize. Select Refresh Radar to try again.",true);
    console.error("Radar initialization failed:",error);
    return null;
  }
}
async function loadRadarFrames() {
  if(radarLoadPromiseV319)return radarLoadPromiseV319;
  if(!initializeWeatherMap())return false;
  radarLoadPromiseV319=(async()=>{
    stopRadarAnimation();
    setRadarStatusV319("Contacting the radar provider...");
    weatherText("radarTimeLabel","Loading radar...");
    try{
      const response=await fetch("https://api.rainviewer.com/public/weather-maps.json",{cache:"no-store"});
      if(!response.ok)throw new Error(`Radar API response ${response.status}`);
      const data=await response.json();
      if(!data?.host)throw new Error("Radar API did not return a tile host");
      const past=Array.isArray(data.radar?.past)?data.radar.past:[];
      const nowcast=Array.isArray(data.radar?.nowcast)?data.radar.nowcast:[];
      radarFrames=[...past.slice(-6),...nowcast].filter(frame=>frame?.path&&Number.isFinite(Number(frame.time))).map(frame=>({...frame,host:data.host}));
      if(!radarFrames.length)throw new Error("Radar API returned no usable frames");
      radarFrameIndex=Math.max(0,Math.min(radarFrames.length-1,past.slice(-6).length-1));
      radarTileFailureReportedV319=false;
      buildRadarLayers();
      showRadarFrame(radarFrameIndex);
      startRadarAnimation();
      setRadarStatusV319(`Radar loaded with ${radarFrames.length} frame${radarFrames.length===1?"":"s"}.`);
      return true;
    }catch(error){
      radarFrames=[];
      radarLayers.forEach(layer=>weatherMap?.removeLayer(layer));
      radarLayers=[];
      radarLayer=null;
      weatherText("radarTimeLabel","Radar unavailable");
      setRadarStatusV319("Radar tiles could not be reached. Weather conditions remain available; select Refresh Radar to retry.",true);
      console.error("Radar provider failure:",error);
      return false;
    }finally{
      radarLoadPromiseV319=null;
    }
  })();
  return radarLoadPromiseV319;
}
function buildRadarLayers() {
  if(!weatherMap)return;
  radarLayers.forEach(layer=>weatherMap.removeLayer(layer));
  radarLayers=radarFrames.map(frame=>{
    const layer=L.tileLayer(`${frame.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,{opacity:0,zIndex:500,maxNativeZoom:7,maxZoom:18,updateWhenIdle:true,keepBuffer:2,attribution:"Radar by RainViewer"});
    layer.on?.("tileerror",()=>{
      if(radarTileFailureReportedV319)return;
      radarTileFailureReportedV319=true;
      setRadarStatusV319("Some radar tiles were blocked or unavailable. Select Refresh Radar if the map remains blank.",true);
      console.warn("Radar tile failure: the provider, network, or browser blocked a tile request.");
    });
    layer.addTo(weatherMap);
    return layer;
  });
}
function showRadarFrame(index) { if (!weatherMap || !radarFrames.length) return; if (radarLayers.length !== radarFrames.length) buildRadarLayers(); radarLayers.forEach((layer, layerIndex) => layer.setOpacity(layerIndex === index ? .72 : 0)); radarLayer = radarLayers[index] || null; const frame = radarFrames[index]; weatherText("radarTimeLabel", new Date(frame.time * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })); }
function startRadarAnimation() { stopRadarAnimation(); if(!radarFrames.length){weatherText("radarPlayButton","Play");return;} radarTimer = setInterval(() => { radarFrameIndex = (radarFrameIndex + 1) % radarFrames.length; showRadarFrame(radarFrameIndex); }, 1200); weatherText("radarPlayButton", "Pause"); }
function stopRadarAnimation() { if (radarTimer) clearInterval(radarTimer); radarTimer = null; weatherText("radarPlayButton", "Play"); }
function toggleRadarAnimation() { if(!radarFrames.length){refreshRadarV319();return;} radarTimer ? stopRadarAnimation() : startRadarAnimation(); }
function resetWeatherMap() { if (weatherMap) weatherMap.fitBounds(WEATHER_BOUNDS, { padding: [18,18] }); }
async function fetchJson(url) { const response = await fetch(url, { headers: { Accept: "application/geo+json, application/json" }, cache: "no-store" }); if (!response.ok) throw new Error(`Weather request failed (${response.status})`); return response.json(); }
async function loadWeatherForLocation(location = activeWeatherLocation) { activeWeatherLocation = location; weatherText("weatherStatus", `Loading live weather for ${location.name}...`); try { const point = await fetchJson(`https://api.weather.gov/points/${location.lat.toFixed(4)},${location.lon.toFixed(4)}`); const [forecast, stations, alerts] = await Promise.all([fetchJson(point.properties.forecast),fetchJson(point.properties.observationStations),fetchJson("https://api.weather.gov/alerts/active?area=FL")]); let observation = null; const stationUrl = stations.features?.[0]?.id; if (stationUrl) observation = await fetchJson(`${stationUrl}/observations/latest`); renderWeather(location, forecast, observation, alerts); } catch (error) { weatherText("weatherStatus", `Unable to load live weather: ${error.message}. Verify the computer is online.`); console.error(error); } }
function getHomeWeatherGraphic(description = "") {
  const text = String(description || "").toLowerCase();
  if (/thunder|lightning|storm/.test(text)) return "⛈️";
  if (/rain|shower|drizzle/.test(text)) return "🌧️";
  if (/snow|sleet|ice|freezing/.test(text)) return "🌨️";
  if (/fog|mist|haze|smoke/.test(text)) return "🌫️";
  if (/mostly cloudy|partly cloudy|cloud/.test(text)) return "⛅";
  if (/wind|breezy|gust/.test(text)) return "💨";
  if (/sun|clear|fair/.test(text)) return "☀️";
  return "🌤️";
}
function renderWeather(location, forecast, observation, alerts) { const periods = forecast.properties?.periods || []; const current = observation?.properties || {}; const temp = cToF(current.temperature?.value); const wind = kphToMph(current.windSpeed?.value); weatherText("weatherCurrentTemp", temp == null ? (periods[0] ? `${periods[0].temperature}°F` : "--") : `${temp}°F`); weatherText("weatherCurrentText", current.textDescription || periods[0]?.shortForecast || "Current conditions"); weatherText("weatherRainChance", periods[0]?.probabilityOfPrecipitation?.value == null ? "--" : `${periods[0].probabilityOfPrecipitation.value}%`); weatherText("weatherWind", wind == null ? (periods[0]?.windSpeed || "--") : `${wind} mph`); weatherText("weatherWindDirection", current.windDirection?.value == null ? (periods[0]?.windDirection || location.name) : `${Math.round(current.windDirection.value)}°`); const list = byId("weatherForecastList"); if (list) list.innerHTML = periods.slice(0, 8).map(p => `<article class="weather-period"><div><strong>${p.name}</strong><span>${p.temperature}°${p.temperatureUnit}</span></div><p>${p.shortForecast}</p><small>Rain ${p.probabilityOfPrecipitation?.value ?? 0}% · Wind ${p.windDirection} ${p.windSpeed}</small></article>`).join(""); const countyTerms = ["St. Lucie", "Saint Lucie", "Martin", "Northern Palm Beach", "Palm Beach"]; const relevant = (alerts.features || []).filter(item => countyTerms.some(term => `${item.properties.areaDesc} ${item.properties.headline}`.toLowerCase().includes(term.toLowerCase()))); weatherText("weatherAlertCount", String(relevant.length)); const homeSummary = byId("homeWeatherSummary"); if (homeSummary) { const displayedTemp = temp == null ? (periods[0] ? `${periods[0].temperature}°F` : "--") : `${temp}°F`; const rainChance = periods[0]?.probabilityOfPrecipitation?.value; const windText = wind == null ? (periods[0]?.windSpeed || "--") : `${wind} mph`; const conditionText = current.textDescription || periods[0]?.shortForecast || "Current conditions"; homeSummary.innerHTML = `<div class="home-weather-graphic" aria-hidden="true">${getHomeWeatherGraphic(conditionText)}</div><div class="home-weather-main"><strong>${displayedTemp}</strong><span>${escapeHtml(conditionText)}</span></div><div class="home-weather-details"><span><b>Rain:</b> ${rainChance == null ? "--" : `${rainChance}%`}</span><span><b>Wind:</b> ${escapeHtml(windText)}</span><span><b>Alerts:</b> ${relevant.length}</span></div><small>${escapeHtml(location.name)} · Updated ${new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</small>`; } const alertList = byId("weatherAlertsList"); if (alertList) alertList.innerHTML = relevant.length ? relevant.map(item => `<article class="weather-alert"><strong>${item.properties.event}</strong><span>${item.properties.areaDesc}</span><p>${item.properties.headline || item.properties.description || "Weather alert"}</p></article>`).join("") : '<p class="empty-message">No active alerts affecting the selected service area.</p>'; weatherText("weatherStatus", `Live weather loaded for ${location.name}. Updated ${new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}.`); }
function selectWeatherLocation(name, lat, lon) { loadWeatherForLocation({ name, lat, lon }); if (weatherMap) weatherMap.setView([lat, lon], 10); }
async function refreshRadarV319(){
  initializeWeatherMap();
  weatherMap?.invalidateSize();
  return loadRadarFrames();
}
function getRadarStateV319(){
  return {
    frameCount:radarFrames.length,
    layerCount:radarLayers.length,
    mapInitialized:Boolean(weatherMap)
  };
}
async function refreshWeatherCenter() { initializeWeatherMap(); await Promise.all([loadWeatherForLocation(activeWeatherLocation), refreshRadarV319()]); }
function initializePhaseBWeather() {
  loadWeatherForLocation(activeWeatherLocation);
  document.querySelectorAll('[data-tab="weatherTab"]').forEach(button=>button.addEventListener("click",()=>{
    window.setTimeout(()=>{
      const map=initializeWeatherMap();
      map?.invalidateSize();
      if(!weatherInitialized||!radarFrames.length){
        weatherInitialized=true;
        loadRadarFrames();
      }else{
        showRadarFrame(radarFrameIndex);
        setRadarStatusV319(`Radar ready with ${radarFrames.length} frame${radarFrames.length===1?"":"s"}.`);
      }
    },80);
  }));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePhaseBWeather, { once: true }); else initializePhaseBWeather();

/* v3.16 Complete - Route and Schedule Center */
let phaseCRouteMap=null;
let phaseCRouteLayer=null;
let phaseCRouteMarkers=[];
let phaseCRouteStopMarkersV319=[];
let phaseCActiveStopsV319=[];
let phaseCActiveStartV319=null;
let scheduleSelectionMarkerV319=null;
let phaseCLastGeocodeRequestV319=0;
const PHASE_C_HOME_BASE={lat:27.1975,lon:-80.2528,name:"Paradise Lawn Care Business",source:"business"};
const ROUTE_START_STORAGE_KEY_V319="paradise_route_start_v319";
const ROUTE_GEOCODE_CACHE_KEY_V319="paradise_geocode_cache_v319";
const ROUTE_LOCATION_MAX_AGE_V319=5*60*1000;

function phaseCDateFromScheduleKey(key){return String(key||"").split("_")[0];}
function phaseCTimeFromScheduleKey(key){
  const t=String(key||"").split("_")[1]||"0800";
  return {hour:Number(t.slice(0,2))||8,minute:Number(t.slice(2,4))||0};
}
function phaseCNormalizeItem(item){
  if(typeof normalizeScheduleItemV37==="function")return {...item,...normalizeScheduleItemV37(item)};
  return item||{};
}
function validRoutePointV319(value){
  if(Array.isArray(value))value={lat:value[0],lon:value[1]};
  const lat=Number(value?.lat??value?.latitude);
  const lon=Number(value?.lon??value?.lng??value?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return null;
  return {lat,lon};
}
function coordinatesForRecordV319(record,customer,property){
  const candidates=[
    record?.coordinates,
    record,
    record?.location,
    property?.coordinates,
    property,
    property?.location,
    customer?.coordinates,
    customer?.location
  ];
  for(const candidate of candidates){
    const point=validRoutePointV319(candidate);
    if(point)return point;
  }
  return null;
}
function phaseCInvoiceForItem(item){
  return getSavedInvoices().find(x=>x.id===item.recordId||x.jobNumber===item.jobNumber||x.invoiceNumber===item.jobNumber)||null;
}
function phaseCCustomerForItem(item,invoice){
  return readArray(CUSTOMER_STORAGE_KEY).find(x=>x.id===(item.customerId||invoice?.customerId))||null;
}
function phaseCPropertyForItem(item,invoice,customer){
  const address=item.address||invoice?.services?.[0]?.address||"";
  return customer?.properties?.find(property=>property.address&&property.address===address)||customer?.properties?.[0]||null;
}
function phaseCAddressForItem(item){
  const invoice=phaseCInvoiceForItem(item);
  const customer=phaseCCustomerForItem(item,invoice);
  return item.address||invoice?.services?.[0]?.address||invoice?.billingAddress||customer?.properties?.[0]?.address||customer?.billing||"";
}
function phaseCRevenueForItem(item){
  const invoice=phaseCInvoiceForItem(item);
  return Number(invoice?.total||invoice?.services?.reduce((sum,service)=>sum+Number(service.amount||0),0)||item.amount||0);
}
function phaseCTodayJobs(includeCompleted=true){
  const today=getLocalDateString(new Date());
  return Object.entries(getScheduleData())
    .filter(([key])=>phaseCDateFromScheduleKey(key)===today)
    .map(([key,raw])=>{
      const item=phaseCNormalizeItem(raw);
      const invoice=phaseCInvoiceForItem(item);
      const customer=phaseCCustomerForItem(item,invoice);
      const property=phaseCPropertyForItem(item,invoice,customer);
      return {
        key,
        item,
        invoice,
        customer,
        property,
        address:phaseCAddressForItem(item),
        coordinates:coordinatesForRecordV319(item,customer,property)||coordinatesForRecordV319(invoice,customer,property),
        revenue:phaseCRevenueForItem(item),
        time:phaseCTimeFromScheduleKey(key)
      };
    })
    .filter(job=>job.item.customer||job.item.jobNumber||job.item.service||job.item.recordId)
    .filter(job=>includeCompleted||!["Completed","Cancelled","Canceled"].includes(job.item.workStatus));
}
function phaseCFormatDuration(minutes){
  minutes=Math.max(0,Math.round(minutes||0));
  return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} hr ${minutes%60} min`;
}
function phaseCInitMap(){
  if(!byId("routeMap"))return null;
  if(phaseCRouteMap){
    window.setTimeout(()=>phaseCRouteMap.invalidateSize(),50);
    return phaseCRouteMap;
  }
  if(typeof L==="undefined"){
    if(byId("routeStatus"))byId("routeStatus").textContent="The local map library did not load. Route details can still be listed after the application files are repaired.";
    console.warn("Route map initialization failed: Leaflet library unavailable.");
    return null;
  }
  try{
    phaseCRouteMap=L.map("routeMap").setView([27.18,-80.25],9);
    const tiles=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
    tiles.on?.("tileerror",()=>console.warn("Route base-map tile could not be loaded."));
    tiles.addTo(phaseCRouteMap);
    window.setTimeout(()=>phaseCRouteMap.invalidateSize(),50);
    return phaseCRouteMap;
  }catch(error){
    phaseCRouteMap=null;
    console.error("Route map initialization failed:",error);
    return null;
  }
}
function readObjectV319(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"{}");
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }catch(error){
    console.warn(`Unable to read ${key}:`,error);
    return {};
  }
}
function writeObjectV319(key,value){
  localStorage.setItem(key,JSON.stringify(value));
}
function normalizedAddressKeyV319(address){
  return String(address||"").trim().toLowerCase().replace(/\s+/g," ");
}
async function phaseCGeocode(address){
  const clean=String(address||"").trim();
  if(!clean)throw new Error("Address is incomplete");
  const key=normalizedAddressKeyV319(clean);
  const cache=readObjectV319(ROUTE_GEOCODE_CACHE_KEY_V319);
  const cached=cache[key];
  const cachedPoint=validRoutePointV319(cached);
  if(cachedPoint)return {...cachedPoint,label:cached.label||clean,fromCache:true};
  const waitFor=Math.max(0,1050-(Date.now()-phaseCLastGeocodeRequestV319));
  if(waitFor)await new Promise(resolve=>window.setTimeout(resolve,waitFor));
  phaseCLastGeocodeRequestV319=Date.now();
  const query=encodeURIComponent(clean);
  const response=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${query}`,{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error(`Address lookup failed (${response.status})`);
  const data=await response.json();
  const point=validRoutePointV319({lat:data?.[0]?.lat,lon:data?.[0]?.lon});
  if(!point)throw new Error(`Address not found: ${clean}`);
  cache[key]={...point,label:data[0].display_name||clean,cachedAt:new Date().toISOString()};
  const entries=Object.entries(cache).slice(-100);
  writeObjectV319(ROUTE_GEOCODE_CACHE_KEY_V319,Object.fromEntries(entries));
  return {...point,label:cache[key].label,fromCache:false};
}
function phaseCDistance(a,b){
  const R=3958.8;
  const radians=Math.PI/180;
  const dLat=(b.lat-a.lat)*radians;
  const dLon=(b.lon-a.lon)*radians;
  const value=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(value));
}
function routeManualOrderV319(stop){
  const value=Number(stop.item.routeOrder??stop.item.manualOrder);
  return Number.isFinite(value)&&value>0?Math.round(value)-1:null;
}
function routeIsFixedV319(stop){
  return routeManualOrderV319(stop)!==null||Boolean(
    stop.item.routeLocked||
    stop.item.locked||
    stop.item.appointmentLocked||
    stop.item.appointmentWindow||
    stop.item.windowStart||
    stop.item.windowEnd
  );
}
function phaseCNearestOrder(stops,start=PHASE_C_HOME_BASE){
  const original=[...stops].sort((a,b)=>a.key.localeCompare(b.key));
  const fixed=new Map();
  const remaining=[];
  original.forEach((stop,index)=>{
    if(!routeIsFixedV319(stop)){
      remaining.push(stop);
      return;
    }
    let position=routeManualOrderV319(stop);
    if(position===null)position=index;
    position=Math.max(0,Math.min(original.length-1,position));
    while(fixed.has(position)&&position<original.length-1)position+=1;
    while(fixed.has(position)&&position>0)position-=1;
    fixed.set(position,stop);
  });
  const ordered=[];
  let cursor=start;
  for(let position=0;position<original.length;position+=1){
    let next=fixed.get(position);
    if(!next){
      const urgent=remaining.filter(stop=>stop.item.urgent||stop.item.priority==="Urgent");
      const candidates=urgent.length?urgent:remaining;
      let best=candidates[0];
      let distance=Infinity;
      candidates.forEach(candidate=>{
        const nextDistance=phaseCDistance(cursor,candidate);
        if(nextDistance<distance){
          distance=nextDistance;
          best=candidate;
        }
      });
      next=best;
      const remainingIndex=remaining.indexOf(next);
      if(remainingIndex>=0)remaining.splice(remainingIndex,1);
    }
    if(next){
      ordered.push(next);
      cursor=next;
    }
  }
  return ordered;
}
async function phaseCFetchRoute(points){
  const coordinates=points.map(point=>`${point.lon},${point.lat}`).join(";");
  const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
  if(!response.ok)throw new Error(`Routing service failed (${response.status})`);
  const data=await response.json();
  if(data.code!=="Ok"||!data.routes?.[0])throw new Error("No drivable route was returned.");
  return {...data.routes[0],approximate:false};
}
function phaseCFallbackRouteV319(points){
  let miles=0;
  for(let index=1;index<points.length;index+=1)miles+=phaseCDistance(points[index-1],points[index]);
  return {
    geometry:{type:"LineString",coordinates:points.map(point=>[point.lon,point.lat])},
    distance:miles*1609.344,
    duration:(miles/28)*3600,
    approximate:true
  };
}
function routeStartMessageV319(message,isError=false){
  const element=byId("routeStartStatus");
  if(!element)return;
  element.textContent=message;
  element.classList.toggle("is-error",Boolean(isError));
}
function routeCurrentPositionV319(){
  return new Promise((resolve,reject)=>{
    const localHost=["localhost","127.0.0.1"].includes(location.hostname);
    if(window.isSecureContext===false&&!localHost){
      reject(new Error("Current location requires HTTPS, localhost, or Live Server."));
      return;
    }
    if(!navigator.geolocation?.getCurrentPosition){
      reject(new Error("This browser does not provide current location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(position=>{
      const point=validRoutePointV319(position?.coords);
      const timestamp=Number(position?.timestamp)||Date.now();
      const age=Date.now()-timestamp;
      if(!point){
        reject(new Error("The browser returned invalid coordinates."));
        return;
      }
      if(age>ROUTE_LOCATION_MAX_AGE_V319){
        reject(new Error("The browser returned an old location. Select Refresh Location & Route to try again."));
        return;
      }
      const accuracy=Number(position.coords.accuracy);
      const distanceFromServiceArea=phaseCDistance(point,PHASE_C_HOME_BASE);
      if(distanceFromServiceArea>150&&!confirm(`Your detected location appears to be about ${Math.round(distanceFromServiceArea)} miles from the Paradise Lawn Care service area. Use it as the route start?`)){
        reject(new Error("The detected location was outside the service area and was not selected."));
        return;
      }
      resolve({
        ...point,
        name:"Current Location",
        source:"current",
        accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,
        obtainedAt:new Date(timestamp).toISOString()
      });
    },error=>{
      const messages={
        1:"Location permission was denied.",
        2:"Current location is unavailable.",
        3:"The current-location request timed out."
      };
      reject(new Error(messages[error?.code]||"Current location could not be obtained."));
    },{enableHighAccuracy:true,timeout:9000,maximumAge:0});
  });
}
async function routeManualStartV319(address,savePreferred=false){
  const located=await phaseCGeocode(address);
  const start={...located,name:`Manual Start: ${address}`,address,source:"manual"};
  if(savePreferred){
    writeObjectV319(ROUTE_START_STORAGE_KEY_V319,{address,...validRoutePointV319(start),savedAt:new Date().toISOString()});
  }
  return start;
}
function savedRouteStartV319(){
  const saved=readObjectV319(ROUTE_START_STORAGE_KEY_V319);
  const point=validRoutePointV319(saved);
  return saved.address&&point?{...point,address:saved.address,name:`Preferred Start: ${saved.address}`,source:"saved"}:null;
}
async function resolveRouteStartV319(){
  const mode=byId("routeStartMode")?.value||"current";
  const manualAddress=byId("routeStartAddress")?.value.trim()||"";
  if(mode==="business"){
    routeStartMessageV319("Using the Paradise Lawn Care business location as the route start.");
    return {...PHASE_C_HOME_BASE};
  }
  if(mode==="manual"){
    if(!manualAddress)throw new Error("Enter a complete manual starting address.");
    routeStartMessageV319("Locating the manual route starting address...");
    const start=await routeManualStartV319(manualAddress,Boolean(byId("routeSaveStart")?.checked));
    routeStartMessageV319(byId("routeSaveStart")?.checked?"Manual route start located and saved as the preferred start.":"Manual route start located.");
    return start;
  }
  routeStartMessageV319("Requesting your current location to determine the most practical starting point. It is used only for this route.");
  try{
    const current=await routeCurrentPositionV319();
    const accuracy=current.accuracy==null?"":` Approximate accuracy: ${current.accuracy<1000?`${Math.round(current.accuracy)} m`:`${(current.accuracy/1609.344).toFixed(1)} mi`}.`;
    routeStartMessageV319(`Current location detected at ${new Date(current.obtainedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}.${accuracy}`);
    return current;
  }catch(error){
    console.warn("Route location fallback:",error.message);
    if(manualAddress){
      const manual=await routeManualStartV319(manualAddress,Boolean(byId("routeSaveStart")?.checked));
      routeStartMessageV319(`${error.message} Using the entered manual starting address instead.`);
      return manual;
    }
    const saved=savedRouteStartV319();
    if(saved){
      routeStartMessageV319(`${error.message} Using the saved preferred route start instead.`);
      return saved;
    }
    routeStartMessageV319(`${error.message} Using the Paradise Lawn Care business location instead.`);
    return {...PHASE_C_HOME_BASE};
  }
}
function routeStopRecordV319(stop){
  return allScheduleJobsV37().find(record=>
    (stop.item.recordId&&record.recordId===stop.item.recordId)||
    (stop.item.jobId&&record.jobId===stop.item.jobId)||
    (stop.item.jobNumber&&record.jobId===stop.item.jobNumber)
  )||null;
}
function routeNumberedIconV319(index){
  return typeof L?.divIcon==="function"?L.divIcon({className:"route-numbered-icon",html:String(index),iconSize:[30,30],iconAnchor:[15,15]}):undefined;
}
function routeStartIconV319(){
  return typeof L?.divIcon==="function"?L.divIcon({className:"route-start-icon",html:"START",iconSize:[42,42],iconAnchor:[21,21]}):undefined;
}
function selectRouteStopV319(index){
  const stop=phaseCActiveStopsV319[index];
  if(!stop)return;
  document.querySelectorAll("#routeStopList .route-stop").forEach((button,buttonIndex)=>button.classList.toggle("is-selected",buttonIndex===index));
  const marker=phaseCRouteStopMarkersV319[index];
  marker?.openPopup?.();
  phaseCRouteMap?.panTo?.([stop.lat,stop.lon]);
  const record=routeStopRecordV319(stop);
  if(record)showScheduleCustomerCardV36(record,stop.key);
}
function renderPhaseCRoute(stops,route,startPoint){
  const map=phaseCInitMap();
  phaseCActiveStopsV319=stops;
  phaseCActiveStartV319=startPoint;
  if(map){
    if(phaseCRouteLayer)map.removeLayer(phaseCRouteLayer);
    phaseCRouteMarkers.forEach(marker=>map.removeLayer(marker));
    phaseCRouteMarkers=[];
    phaseCRouteStopMarkersV319=[];
    if(route.geometry)phaseCRouteLayer=L.geoJSON(route.geometry,{style:{color:route.approximate?"#b57d1b":"#2f6b3f",weight:5,opacity:.85,dashArray:route.approximate?"8 7":null}}).addTo(map);
    const startOptions={};
    const startIcon=routeStartIconV319();
    if(startIcon)startOptions.icon=startIcon;
    const startMarker=L.marker([startPoint.lat,startPoint.lon],startOptions).addTo(map).bindPopup(`<strong>${escapeHtml(startPoint.name||"Route Start")}</strong>`);
    phaseCRouteMarkers.push(startMarker);
    stops.forEach((stop,index)=>{
      const markerOptions={};
      const icon=routeNumberedIconV319(index+1);
      if(icon)markerOptions.icon=icon;
      const marker=L.marker([stop.lat,stop.lon],markerOptions).addTo(map).bindPopup(`<strong>${index+1}. ${escapeHtml(stop.item.customer||stop.customer?.name||stop.item.jobNumber||"Job")}</strong><br>${escapeHtml(stop.address)}`);
      marker.on?.("click",()=>selectRouteStopV319(index));
      phaseCRouteMarkers.push(marker);
      phaseCRouteStopMarkersV319.push(marker);
    });
    if(phaseCRouteLayer?.getBounds)map.fitBounds(phaseCRouteLayer.getBounds(),{padding:[25,25]});
  }
  let elapsed=0;
  const serviceMinutes=60;
  const routeStartTime=new Date();
  const eachDrive=(route.duration/60)/Math.max(1,stops.length);
  byId("routeStopList").innerHTML=stops.map((stop,index)=>{
    elapsed+=eachDrive;
    const arrival=new Date(routeStartTime.getTime()+elapsed*60000);
    elapsed+=serviceMinutes;
    const label=arrival.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    return `<button type="button" class="route-stop" data-route-index="${index}"><span class="route-stop-number">${index+1}</span><div><strong>${escapeHtml(stop.item.customer||stop.customer?.name||stop.item.jobNumber||"Scheduled Job")}</strong><span>${escapeHtml(stop.item.service||stop.invoice?.services?.[0]?.service||"Lawn service")}</span><small>${escapeHtml(stop.address)}</small></div><span class="route-stop-time">${label}</span></button>`;
  }).join("");
  byId("routeStopList")?.querySelectorAll("[data-route-index]").forEach((button)=>{
    button.addEventListener("click",()=>selectRouteStopV319(Number(button.dataset.routeIndex)));
  });
  const miles=route.distance/1609.344;
  const driveMinutes=route.duration/60;
  const revenue=stops.reduce((sum,stop)=>sum+stop.revenue,0);
  const finish=new Date(routeStartTime.getTime()+(driveMinutes+stops.length*serviceMinutes)*60000);
  byId("routeJobCount").textContent=stops.length;
  byId("routeMiles").textContent=`${miles.toFixed(1)} mi${route.approximate?"*":""}`;
  byId("routeDriveTime").textContent=`${phaseCFormatDuration(driveMinutes)}${route.approximate?"*":""}`;
  byId("routeRevenue").textContent=formatMoney(revenue);
  byId("routeFinish").textContent=finish.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
}
async function buildTodayRoute(){
  const status=byId("routeStatus");
  const jobs=phaseCTodayJobs(false);
  if(!jobs.length){
    clearRouteCenter();
    status.textContent="No incomplete, active jobs are saved for today.";
    renderPhaseCCommandCenter();
    return false;
  }
  status.textContent=`Preparing ${jobs.length} active job${jobs.length===1?"":"s"}...`;
  try{
    const startPoint=await resolveRouteStartV319();
    const located=[];
    const skipped=[];
    for(const job of jobs){
      if(job.coordinates){
        located.push({...job,...job.coordinates});
        continue;
      }
      if(!job.address){
        skipped.push(job);
        continue;
      }
      try{
        located.push({...job,...await phaseCGeocode(job.address)});
      }catch(error){
        skipped.push(job);
        console.warn(`Route address lookup failed for ${job.item.jobNumber||job.key}:`,error.message);
      }
    }
    if(!located.length)throw new Error("No active job has a complete address or valid saved coordinates.");
    const ordered=phaseCNearestOrder(located,startPoint);
    status.textContent="Building the driving route...";
    let route;
    let routingWarning="";
    try{
      route=await phaseCFetchRoute([startPoint,...ordered]);
    }catch(error){
      route=phaseCFallbackRouteV319([startPoint,...ordered]);
      routingWarning=" The driving service was unavailable, so mileage and time are straight-line estimates marked with an asterisk.";
      console.warn("Route service fallback:",error.message);
    }
    renderPhaseCRoute(ordered,route,startPoint);
    const skippedMessage=skipped.length?` ${skipped.length} job${skipped.length===1?" was":"s were"} omitted because the address could not be located.`:"";
    status.textContent=`Route built from ${startPoint.name||"Route Start"} for ${ordered.length} stop${ordered.length===1?"":"s"}.${skippedMessage}${routingWarning}`;
    return true;
  }catch(error){
    clearRouteCenter();
    status.textContent=`Unable to build route: ${error.message}`;
    console.error("Route build failed:",error);
    return false;
  }
}
function clearRouteCenter(){
  if(phaseCRouteMap){
    if(phaseCRouteLayer){
      phaseCRouteMap.removeLayer(phaseCRouteLayer);
      phaseCRouteLayer=null;
    }
    phaseCRouteMarkers.forEach(marker=>phaseCRouteMap.removeLayer(marker));
    phaseCRouteMarkers=[];
    phaseCRouteStopMarkersV319=[];
    if(scheduleSelectionMarkerV319){
      phaseCRouteMap.removeLayer(scheduleSelectionMarkerV319);
      scheduleSelectionMarkerV319=null;
    }
  }
  phaseCActiveStopsV319=[];
  phaseCActiveStartV319=null;
  ["routeJobCount","routeMiles","routeDriveTime","routeRevenue","routeFinish"].forEach((id,index)=>{
    if(byId(id))byId(id).textContent=["0","--","--","$0.00","--"][index];
  });
  if(byId("routeStopList"))byId("routeStopList").innerHTML='<p class="empty-message">No route built yet.</p>';
}
function openSchedulePropertyMapV319(){
  const details=activeScheduleDetailsV319;
  if(!details)return;
  const point=validRoutePointV319(details.coordinates);
  const query=point?`${point.lat},${point.lon}`:details.address;
  if(!query){
    alert("This property needs a complete service address before it can be opened on a map.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,"_blank","noopener");
}
async function showSchedulePropertyOnRouteMapV319(){
  const details=activeScheduleDetailsV319;
  if(!details)return;
  if(!details.address&&!validRoutePointV319(details.coordinates)){
    alert("This property needs a complete service address before it can be shown on the map.");
    return;
  }
  const map=phaseCInitMap();
  if(!map){
    alert("The route map is unavailable. You can still use Open Maps.");
    return;
  }
  try{
    const point=validRoutePointV319(details.coordinates)||await phaseCGeocode(details.address);
    details.coordinates=point;
    if(scheduleSelectionMarkerV319)map.removeLayer(scheduleSelectionMarkerV319);
    const options={};
    if(typeof L.divIcon==="function")options.icon=L.divIcon({className:"schedule-map-icon",html:"JOB",iconSize:[34,34],iconAnchor:[17,17]});
    scheduleSelectionMarkerV319=L.marker([point.lat,point.lon],options).addTo(map).bindPopup(`<strong>${escapeHtml(details.record.customer||"Selected Job")}</strong><br>${escapeHtml(details.address)}`);
    scheduleSelectionMarkerV319.openPopup?.();
    map.setView([point.lat,point.lon],14);
    byId("routeStatus").textContent=`Showing ${details.record.customer||"the selected job"} at ${details.address}.`;
  }catch(error){
    alert(`The property location could not be opened: ${error.message}`);
  }
}
function textScheduleCustomerV319(){
  const details=activeScheduleDetailsV319;
  if(!details)return false;
  const record=details.record;
  const when=details.slotKey?`${formatDateLong(scheduleDateFromKeyV37(details.slotKey))} at ${timeLabel(phaseCTimeFromScheduleKey(details.slotKey).hour,phaseCTimeFromScheduleKey(details.slotKey).minute)}`:"the scheduled time";
  return launchTextV319(record.phone||details.customer?.phone,`Hello ${record.customer||"Customer"}, this is Paradise Lawn Care regarding your service scheduled for ${when}. Please contact us if you have any questions.`,`${record.customer||"This customer"} does not have a valid phone number saved.`);
}
function emailScheduleCustomerV319(){
  const details=activeScheduleDetailsV319;
  if(!details)return false;
  const record=details.record;
  const when=details.slotKey?`${formatDateLong(scheduleDateFromKeyV37(details.slotKey))} at ${timeLabel(phaseCTimeFromScheduleKey(details.slotKey).hour,phaseCTimeFromScheduleKey(details.slotKey).minute)}`:"the scheduled time";
  return launchEmailV319(record.email||details.customer?.email,"Paradise Lawn Care Service Schedule",`Hello ${record.customer||"Customer"},\n\nThis is Paradise Lawn Care regarding your service scheduled for ${when}. Please contact us if you have any questions.\n\nThank you.`,`${record.customer||"This customer"} does not have a valid email address saved.`);
}
function prepareRunningLateNotices(){
  const jobs=phaseCTodayJobs(false);
  if(!jobs.length){
    alert("There are no incomplete jobs today.");
    return;
  }
  communicationSelectedCustomerIds.clear();
  jobs.forEach(job=>{
    const customerId=job.item?.customerId||phaseCCustomerForItem(job.item,phaseCInvoiceForItem(job.item))?.id;
    if(customerId)communicationSelectedCustomerIds.add(customerId);
  });
  openDashboardSection("communicationTab");
  if(byId("communicationAudience"))byId("communicationAudience").value="selected";
  if(byId("communicationSubject"))byId("communicationSubject").value="Paradise Lawn Care Schedule Update";
  if(byId("communicationBody"))byId("communicationBody").value="Paradise Lawn Care is running behind schedule today. We are still planning to service your property and will arrive as soon as possible. Thank you for your patience.";
  if(typeof renderCommunicationRecipients==="function")renderCommunicationRecipients();
}
function moveIncompleteJobsToTomorrow(){
  const data=getScheduleData();
  const today=getLocalDateString(new Date());
  const tomorrow=getLocalDateString(addDays(new Date(),1));
  const keys=Object.keys(data).filter(key=>phaseCDateFromScheduleKey(key)===today&&!["Completed","Cancelled","Canceled"].includes(phaseCNormalizeItem(data[key]).workStatus));
  if(!keys.length){
    alert("There are no incomplete jobs to move.");
    return;
  }
  if(!confirm(`Move ${keys.length} incomplete job${keys.length===1?"":"s"} to tomorrow?`))return;
  keys.forEach(key=>{
    const time=String(key).split("_")[1];
    let newKey=`${tomorrow}_${time}`;
    let offset=0;
    while(data[newKey]){
      offset+=30;
      const total=Number(time.slice(0,2))*60+Number(time.slice(2))+offset;
      newKey=`${tomorrow}_${String(Math.floor(total/60)).padStart(2,"0")}${String(total%60).padStart(2,"0")}`;
    }
    data[newKey]=data[key];
    delete data[key];
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));
  renderSchedule();
  refreshHomeDashboard();
  renderPhaseCCommandCenter();
  alert("Incomplete jobs were moved to tomorrow.");
}
function renderPhaseCCommandCenter(){
  const host=byId("homeCommandCenter");
  if(!host)return;
  const jobs=phaseCTodayJobs(true);
  const completed=jobs.filter(job=>job.item.workStatus==="Completed").length;
  const incomplete=jobs.filter(job=>!["Completed","Cancelled","Canceled"].includes(job.item.workStatus));
  const revenue=jobs.reduce((sum,job)=>sum+job.revenue,0);
  const alerts=typeof buildCurrentAlerts==="function"?buildCurrentAlerts().length:0;
  host.innerHTML=`<div class="command-metrics"><div class="command-metric"><span>Scheduled</span><strong>${jobs.length}</strong></div><div class="command-metric"><span>Completed</span><strong>${completed}</strong></div><div class="command-metric"><span>Remaining</span><strong>${incomplete.length}</strong></div><div class="command-metric"><span>Expected Revenue</span><strong>${formatMoney(revenue)}</strong></div></div>${alerts?`<div class="command-alert"><strong>${alerts} item${alerts===1?"":"s"} need attention.</strong></div>`:""}`;
}
function getRouteStateV319(){
  return {
    start:phaseCActiveStartV319?{...phaseCActiveStartV319}:null,
    stopCount:phaseCActiveStopsV319.length,
    stopMarkerCount:phaseCRouteStopMarkersV319.length
  };
}
function bindStaticClickV319(id,handler){
  const element=byId(id);
  if(!element||element.dataset.v319Bound==="true")return;
  element.dataset.v319Bound="true";
  element.addEventListener("click",handler);
}
function initializeDirectActionsV319(){
  bindStaticClickV319("invoiceEmailAction",emailInvoice);
  bindStaticClickV319("invoiceTextAction",textInvoice);
  bindStaticClickV319("viewInvoicePdfButton",viewInvoicePdf);
  bindStaticClickV319("quoteEmailAction",emailQuote);
  bindStaticClickV319("quoteTextAction",textQuote);
  bindStaticClickV319("customerEmailAction",emailCustomer);
  bindStaticClickV319("customerTextAction",textCustomer);
  bindStaticClickV319("scheduleShowMapButton",showSchedulePropertyOnRouteMapV319);
  bindStaticClickV319("scheduleOpenMapsButton",openSchedulePropertyMapV319);
  bindStaticClickV319("scheduleTextCustomerButton",textScheduleCustomerV319);
  bindStaticClickV319("scheduleEmailCustomerButton",emailScheduleCustomerV319);
  bindStaticClickV319("scheduleBuildRouteButton",buildTodayRoute);
  bindStaticClickV319("buildTodayRouteButton",buildTodayRoute);
  bindStaticClickV319("routeRefreshLocationButton",buildTodayRoute);
  bindStaticClickV319("radarRefreshButton",refreshRadarV319);
  bindStaticClickV319("printInvoicePreviewButton",printInvoicePreview);
}
const phaseCRefreshHome=refreshHomeDashboard;
refreshHomeDashboard=function(){
  phaseCRefreshHome();
  renderPhaseCCommandCenter();
};
function initializePhaseC(){
  const saved=savedRouteStartV319();
  if(saved&&byId("routeStartAddress"))byId("routeStartAddress").value=saved.address;
  byId("routeStartMode")?.addEventListener("change",event=>{
    if(event.target.value==="current")routeStartMessageV319("Current location will be requested only when you build or refresh the route.");
    if(event.target.value==="manual")routeStartMessageV319("Enter a starting address. It is saved only if you select Remember this manual address.");
    if(event.target.value==="business")routeStartMessageV319("The route will begin at the Paradise Lawn Care business location.");
  });
  initializeDirectActionsV319();
  wireScheduleInteractionsV319();
  renderPhaseCCommandCenter();
  document.querySelectorAll('[data-tab="scheduleTab"]').forEach(button=>button.addEventListener("click",()=>window.setTimeout(()=>{
    phaseCInitMap();
    renderPhaseCCommandCenter();
  },60)));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializePhaseC,{once:true});
else initializePhaseC();

/* Paradise Lawn Care Operations Suite v3.19 - Complete touch quote workflow */
function quoteCustomersV318(){return readArray(CUSTOMER_STORAGE_KEY);}
function quoteSelectedCustomerV318(){return quoteCustomersV318().find(c=>c.id===byId("quoteCustomer")?.value)||null;}
function quoteSelectedPropertyV318(){const c=quoteSelectedCustomerV318(),i=Number(byId("quoteProperty")?.value);return Number.isInteger(i)&&i>=0?c?.properties?.[i]||null:null;}
function setQuoteCustomerDisplayV318(customer){if(byId("quoteCustomerDisplay"))byId("quoteCustomerDisplay").textContent=customer?(customer.name||customer.business||"Selected customer"):"Tap to choose a customer";}
function setQuotePropertyDisplayV318(property){if(byId("quotePropertyDisplay"))byId("quotePropertyDisplay").textContent=property?(property.name||property.address||"Selected property"):"Choose property";}
function setQuoteCustomerModeV322(mode="new"){
  const isExisting=mode==="existing";
  if(byId("quoteCustomerMode"))byId("quoteCustomerMode").value=isExisting?"existing":"new";
  byId("quoteNewCustomerMode")?.classList.toggle("is-active",!isExisting);
  byId("quoteExistingCustomerMode")?.classList.toggle("is-active",isExisting);
  if(!isExisting){
    if(byId("quoteCustomer"))byId("quoteCustomer").value="";
    if(byId("quoteProperty"))byId("quoteProperty").value="";
    setQuoteCustomerDisplayV318(null);setQuotePropertyDisplayV318(null);
    if(byId("quotePropertyCompactRow"))byId("quotePropertyCompactRow").hidden=true;
    ["quoteBusinessName","quoteClientName","quoteStreet","quoteCity","quoteState","quoteZip","quotePhone","quoteEmail"].forEach(id=>{const el=byId(id);if(el)el.readOnly=false;});
    return;
  }
  openQuoteCustomerPicker();
}
function updateQuotePropertyCompactV322(customer){
  const row=byId("quotePropertyCompactRow");if(!row)return;
  const count=(customer?.properties||[]).filter(p=>p&&(p.name||p.address)).length;
  row.hidden=count<2;
}
function fillQuoteCustomerDetailsV318(customer,property){
  if(byId("quoteBusinessName"))byId("quoteBusinessName").value=customer?.business||"";
  if(byId("quoteClientName"))byId("quoteClientName").value=customer?.name||"";
  if(byId("quotePhone"))byId("quotePhone").value=customer?.phone||"";
  if(byId("quoteEmail"))byId("quoteEmail").value=customer?.email||"";
  PreferredContactComponent.setValue("quotePreferredContact",preferredContactForRecord(customer));
  const address=property?.address||customer?.billing||"";
  if(byId("quoteAddress"))byId("quoteAddress").value=address;
  if(typeof loadQuoteAddressFieldsV321==="function")loadQuoteAddressFieldsV321(address);
  resizeAllEmailFieldsV322();
}
function closeQuotePickerV318(){const m=byId("quoteTouchPickerModal");if(m)m.hidden=true;}
function ensureQuotePickerV318(){
  let modal=byId("quoteTouchPickerModal");
  if(modal)return modal;
  modal=document.createElement("div");modal.id="quoteTouchPickerModal";modal.className="modal";modal.hidden=true;
  modal.innerHTML=`<div class="modal-card quote-picker-card" role="dialog" aria-modal="true"><div class="modal-header"><div><h2 id="quotePickerTitle">Select</h2><p id="quotePickerHelp">Tap one choice.</p></div><button type="button" class="close-button" onclick="closeQuotePickerV318()">×</button></div><div id="quotePickerList" class="quote-picker-list"></div><div class="compact-actions"><button type="button" class="secondary-button" onclick="closeQuotePickerV318()">Cancel</button></div></div>`;
  modal.addEventListener("click",e=>{if(e.target===modal)closeQuotePickerV318();});document.body.appendChild(modal);return modal;
}
function openQuoteCustomerPicker(){
  const customers=quoteCustomersV318(),modal=ensureQuotePickerV318();
  byId("quotePickerTitle").textContent="Select Customer";byId("quotePickerHelp").textContent="Tap the customer for this quote.";
  byId("quotePickerList").innerHTML=customers.length?customers.map(c=>`<button type="button" class="quote-picker-choice" onclick="selectQuoteCustomerV318('${c.id}')"><strong>${escapeHtml(c.name||c.business||'Customer')}</strong><span>${escapeHtml(c.phone||c.email||c.billing||'No contact information')}</span></button>`).join(""):'<p class="empty-message">No customers are saved. Create the customer on the Customers page first.</p>';
  modal.hidden=false;
}
function selectQuoteCustomerV318(id){
  const c=quoteCustomersV318().find(x=>x.id===id);if(!c)return;
  byId("quoteCustomer").value=id;byId("quoteProperty").value="";if(byId("quoteCustomerMode"))byId("quoteCustomerMode").value="existing";byId("quoteNewCustomerMode")?.classList.remove("is-active");byId("quoteExistingCustomerMode")?.classList.add("is-active");setQuoteCustomerDisplayV318(c);setQuotePropertyDisplayV318(null);fillQuoteCustomerDetailsV318(c,null);updateQuotePropertyCompactV322(c);closeQuotePickerV318();
  const properties=(c.properties||[]).filter(p=>p&&(p.name||p.address));if(properties.length===1)selectQuotePropertyV318(0);else if(properties.length>1)openQuotePropertyPicker();
}
function openQuotePropertyPicker(){
  const c=quoteSelectedCustomerV318();if(!c){openQuoteCustomerPicker();return;}
  const properties=(c.properties||[]).filter(p=>p&&(p.name||p.address)),modal=ensureQuotePickerV318();
  byId("quotePickerTitle").textContent="Select Property";byId("quotePickerHelp").textContent="Tap the property for this quote.";
  byId("quotePickerList").innerHTML=properties.length?properties.map((p,i)=>`<button type="button" class="quote-picker-choice" onclick="selectQuotePropertyV318(${i})"><strong>${escapeHtml(p.name||`Property ${i+1}`)}</strong><span>${escapeHtml(p.address||'No address entered')}</span></button>`).join(""):'<button type="button" class="quote-picker-choice" onclick="selectQuotePropertyV318(-1)"><strong>Use Billing Address</strong><span>'+escapeHtml(c.billing||'No billing address entered')+'</span></button>';
  modal.hidden=false;
}
function selectQuotePropertyV318(index){
  const c=quoteSelectedCustomerV318(),p=index>=0?c?.properties?.[index]||null:null;byId("quoteProperty").value=index>=0?String(index):"";setQuotePropertyDisplayV318(p||{name:"Billing Address",address:c?.billing||""});fillQuoteCustomerDetailsV318(c,p);closeQuotePickerV318();
}
function populateCustomerSelectors(){setQuoteCustomerDisplayV318(quoteSelectedCustomerV318());setQuotePropertyDisplayV318(quoteSelectedPropertyV318());}
function populateQuoteProperties(){setQuotePropertyDisplayV318(quoteSelectedPropertyV318());}
function normalizeQuoteMoneyV318(){const el=byId("quoteAmount");if(!el)return 0;const n=cleanMoney(el.value);el.value=n?Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"";return n;}
function newQuote(){
  activeQuoteId=null;byId("quoteNumber").value=quoteSequence();byId("quoteNumber").dataset.jobId=generateJobIdV36();byId("quoteDate").value=getLocalDateString();byId("quoteValidThrough").value=getLocalDateString(addDays(new Date(),30));byId("quoteStatus").value="Draft";
  ["quoteCustomer","quoteProperty","quoteAddress","quoteBusinessName","quoteClientName","quotePhone","quoteEmail","quoteScope","quoteAmount","quoteNotes"].forEach(id=>{if(byId(id))byId(id).value="";});PreferredContactComponent.setValue("quotePreferredContact","Phone");setQuoteCustomerDisplayV318(null);setQuotePropertyDisplayV318(null);setQuoteCustomerModeV322("new");renderQuotes();resizeAllEmailFieldsV322();
}
function saveQuote(){
  syncQuoteAddressFieldsV321();
  let c=quoteSelectedCustomerV318();
  const newMode=(byId("quoteCustomerMode")?.value||"new")==="new";
  if(!c&&newMode){
    const name=byId("quoteClientName")?.value.trim()||"";
    const business=byId("quoteBusinessName")?.value.trim()||"";
    if(!name&&!business){alert("Enter a client name or business name.");return;}
    const customers=readArray(CUSTOMER_STORAGE_KEY),id=makeId("customer"),address=byId("quoteAddress")?.value.trim()||"";
    c={id,customerNumber:typeof generateCustomerNumberV36==="function"?generateCustomerNumberV36():"",name,business,phone:byId("quotePhone")?.value.trim()||"",email:byId("quoteEmail")?.value.trim()||"",preferredContact:PreferredContactComponent.sync("quotePreferredContact"),billing:address,billingStreet:byId("quoteStreet")?.value.trim()||"",billingCity:byId("quoteCity")?.value.trim()||"",billingState:byId("quoteState")?.value.trim()||"",billingZip:byId("quoteZip")?.value.trim()||"",notes:"Created from Quote Builder.",properties:address?[{name:"Primary Property",address}]:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    customers.push(c);writeArray(CUSTOMER_STORAGE_KEY,customers);byId("quoteCustomer").value=id;setQuoteCustomerDisplayV318(c);
  }
  if(!c){alert("Select a customer account or choose New Customer.");return;}
  const amount=normalizeQuoteMoneyV318(),list=readArray(QUOTE_STORAGE_KEY),id=activeQuoteId||makeId("quote"),existing=list.find(x=>x.id===id)||null,p=quoteSelectedPropertyV318()||{name:"Service Address",address:byId("quoteAddress")?.value.trim()||c.billing||""};
  const item={...existing,id,number:byId("quoteNumber").value||existing?.number||quoteSequence(),jobId:existing?.jobId||byId("quoteNumber").dataset.jobId||generateJobIdV36(),date:byId("quoteDate").value,validThrough:byId("quoteValidThrough").value,status:byId("quoteStatus").value,customerId:c.id,customerNumber:c.customerNumber||existing?.customerNumber||"",customerName:c.name||c.business||"Customer",businessName:c.business||"",property:{...p,address:byId("quoteAddress")?.value.trim()||p.address||""},phone:byId("quotePhone")?.value.trim()||c.phone||"",email:byId("quoteEmail")?.value.trim()||c.email||"",preferredContact:PreferredContactComponent.sync("quotePreferredContact")||preferredContactForRecord(c),scope:byId("quoteScope").value.trim(),amount,frequency:byId("quoteFrequency").value,notes:"",createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const i=list.findIndex(x=>x.id===id);if(i>=0)list[i]=item;else list.push(item);writeArray(QUOTE_STORAGE_KEY,list);activeQuoteId=id;renderQuotes();alert("Quote saved.");
}
function loadQuote(id){
  const q=readArray(QUOTE_STORAGE_KEY).find(x=>x.id===id);if(!q)return;activeQuoteId=id;byId("quoteNumber").value=q.number||"";byId("quoteDate").value=q.date||"";byId("quoteValidThrough").value=q.validThrough||"";byId("quoteStatus").value=q.status||"Draft";byId("quoteCustomer").value=q.customerId||"";
  const c=quoteSelectedCustomerV318(),pi=c?.properties?.findIndex(p=>p.address===q.property?.address);byId("quoteNumber").dataset.jobId=q.jobId||"";byId("quoteProperty").value=pi>=0?String(pi):"";if(byId("quoteCustomerMode"))byId("quoteCustomerMode").value=c?"existing":"new";byId("quoteNewCustomerMode")?.classList.toggle("is-active",!c);byId("quoteExistingCustomerMode")?.classList.toggle("is-active",!!c);setQuoteCustomerDisplayV318(c);setQuotePropertyDisplayV318(pi>=0?c.properties[pi]:q.property);updateQuotePropertyCompactV322(c);if(byId("quoteBusinessName"))byId("quoteBusinessName").value=c?.business||q.businessName||"";if(byId("quoteClientName"))byId("quoteClientName").value=c?.name||q.customerName||"";byId("quoteAddress").value=q.property?.address||c?.billing||"";byId("quotePhone").value=q.phone||c?.phone||"";byId("quoteEmail").value=q.email||c?.email||"";PreferredContactComponent.setValue("quotePreferredContact",c?preferredContactForRecord(c):preferredContactForRecord(q));byId("quoteScope").value=[q.scope,q.notes].filter(Boolean).join("\n\n");byId("quoteNotes").value="";byId("quoteAmount").value=q.amount?Number(q.amount).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"";byId("quoteFrequency").value=q.frequency||"One Time";byId("quoteNotes").value=q.notes||"";renderQuoteAttachments();
}
function initializeQuoteV318(){const a=byId("quoteAmount");if(a){a.addEventListener("blur",normalizeQuoteMoneyV318);a.addEventListener("input",()=>{a.value=a.value.replace(/[^0-9.,]/g,"");});}populateCustomerSelectors();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeQuoteV318,{once:true});else initializeQuoteV318();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureParadiseBrandingLayoutV319, { once: true });
} else {
  ensureParadiseBrandingLayoutV319();
}


/* v3.20 Phase One - customer/property modernization initialization */
document.addEventListener("DOMContentLoaded", () => {
  bindPreferredContactCheckboxes();
});

/* Paradise Lawn Care Operations Suite v3.20 Phase Two - Shared data and Operations Command Center */
const ACTIVITY_HISTORY_KEY_V320 = "paradise_activity_history_v320";
const ACTIVITY_ACTIVE_SNAPSHOT_KEY_V320 = "paradise_activity_active_snapshot_v320";
let activeBriefingPeriodV320 = "today";
let activePriorityCategoryV320 = "all";
let activeHistoryRangeV320 = "all";

function activityHistoryV320(){ return readArray(ACTIVITY_HISTORY_KEY_V320); }
function saveActivityHistoryV320(items){ writeArray(ACTIVITY_HISTORY_KEY_V320, items.slice(-5000)); }
function logActivityV320({category="System",title,detail="",severity="green",recordType="",recordId="",sourceKey=""}){
  if(!title) return null;
  const items=activityHistoryV320();
  const now=new Date().toISOString();
  const duplicate=items.find(x=>x.sourceKey&&sourceKey&&x.sourceKey===sourceKey);
  if(duplicate) return duplicate;
  const entry={id:makeId("activity"),timestamp:now,category,title,detail,severity,recordType,recordId,sourceKey};
  items.push(entry); saveActivityHistoryV320(items); return entry;
}
function activityDateV320(timestamp){ return String(timestamp||"").slice(0,10); }
function dateOffsetV320(days){ const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return getLocalDateString(d); }
function startOfWeekV320(){ const d=new Date();d.setHours(12,0,0,0);const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return getLocalDateString(d); }
function openActivityRecordV320(type,id){
  if(type==="invoice"&&id){switchTab("invoiceTab");loadInvoice(id);return;}
  if(type==="customer"&&id){switchTab("customersTab");loadCustomer(id);return;}
  if(type==="quote"&&id){switchTab("quoteTab");loadQuote(id);return;}
  if(type==="schedule"){switchTab("scheduleTab");return;}
  if(type==="maintenance"){switchTab("maintenanceTab");return;}
  if(type==="inventory"){switchTab("maintenanceTab");setTimeout(()=>openMaintenanceSubtab("inventoryMaintPanel"),20);return;}
  if(type==="employee"){switchTab("employeesTab");return;}
}
function renderActivityHistoryV320(){
  const host=byId("activityHistoryList");if(!host)return;
  const q=(byId("historySearch")?.value||"").trim().toLowerCase(),date=byId("historyDate")?.value||"",category=byId("historyCategory")?.value||"all";
  const today=getLocalDateString(),yesterday=dateOffsetV320(-1),weekStart=startOfWeekV320(),month=today.slice(0,7);
  let items=activityHistoryV320().slice().sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  items=items.filter(x=>{
    const d=activityDateV320(x.timestamp),text=`${x.category} ${x.title} ${x.detail}`.toLowerCase();
    if(q&&!text.includes(q))return false;if(date&&d!==date)return false;if(category!=="all"&&x.category!==category)return false;
    if(activeHistoryRangeV320==="today"&&d!==today)return false;if(activeHistoryRangeV320==="yesterday"&&d!==yesterday)return false;
    if(activeHistoryRangeV320==="week"&&(d<weekStart||d>today))return false;if(activeHistoryRangeV320==="month"&&!d.startsWith(month))return false;return true;
  });
  if(!items.length){host.innerHTML='<p class="empty-message">No activity matches the selected filters.</p>';return;}
  let last="";host.innerHTML=items.map(x=>{const d=activityDateV320(x.timestamp),heading=d!==last?`<h3 class="history-day-heading">${formatDateLong(d)}</h3>`:"";last=d;const time=new Date(x.timestamp).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return `${heading}<article class="history-entry ${escapeHtml(x.severity||"green")}"><time>${escapeHtml(time)}</time><span class="history-category">${escapeHtml(x.category)}</span><div><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.detail||"")}</span></div>${x.recordType?`<button type="button" onclick="openActivityRecordV320('${escapeHtml(x.recordType)}','${escapeHtml(x.recordId||"")}')">Open</button>`:"<span></span>"}</article>`;}).join("");
}

function renderHomeHistoryPreviewV320(){
  const host=byId("homeHistoryPreview");if(!host)return;
  const items=activityHistoryV320().slice().sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,5);
  if(!items.length){host.innerHTML='<p class="empty-message">No completed activity has been recorded yet.</p>';return;}
  host.innerHTML=items.map(x=>{const d=activityDateV320(x.timestamp),label=d===getLocalDateString()?"Today":formatDisplayDate(d),time=new Date(x.timestamp).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return `<article class="home-history-entry"><time>${escapeHtml(label)} ${escapeHtml(time)}</time><div><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.detail||x.category||"")}</span></div></article>`;}).join("");
}

function exportActivityHistoryCsv(){
  const rows=[["Date/Time","Category","Title","Detail","Severity"],...activityHistoryV320().map(x=>[x.timestamp,x.category,x.title,x.detail,x.severity])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`Paradise-Activity-History-${getLocalDateString()}.csv`;a.click();URL.revokeObjectURL(url);
}
function priorityCategoryV320(kind,type=""){
  const normalized=String(type||"").toLowerCase();
  if(kind==="invoice"||kind==="billing"||normalized.includes("invoice"))return "invoice";
  if(kind==="inventory"||normalized.includes("inventory"))return "inventory";
  if(kind==="maintenance"||normalized.includes("maintenance")||normalized.includes("repair"))return "maintenance";
  if(kind==="customer"||normalized.includes("customer")||normalized.includes("communication"))return "customer";
  if(kind==="schedule"||normalized.includes("schedule")||normalized.includes("route"))return "schedule";
  if(kind==="employee"||normalized.includes("employee")||normalized.includes("crew"))return "employee";
  return "maintenance";
}
function priorityItemsV320(){
  const items=[],billing=billingSummaryV38(),alerts=buildCurrentAlerts(),low=lowInventoryItems();
  billing.email.forEach(i=>items.push({severity:"red",title:`Invoice ${i.jobNumber||i.invoiceNumber} is ready to email`,detail:`${i.clientName||i.businessName||"Customer"} · ${formatMoney(i.total)}`,kind:"invoice",category:"invoice",id:i.id}));
  alerts.forEach(a=>{const kind=a.type==="Invoice"?"invoice":"maintenance";items.push({severity:a.dueState==="overdue"?"red":"yellow",title:a.title,detail:a.detail,kind,category:priorityCategoryV320(kind,a.type),id:a.sourceId});});
  billing.ready.forEach(g=>items.push({severity:"red",title:`Create ${g.method} invoice`,detail:`${customerLabelV36(g.customer)} · ${g.period.label} · ${formatMoney(g.total)}`,kind:"billing",category:"invoice",id:g.key}));
  Object.entries(getScheduleData()).forEach(([key,item])=>{if(scheduleIsPastV37(key)&&(item.workStatus||"Upcoming")!=="Completed")items.push({severity:"red",title:"Past-due scheduled job",detail:`${item.jobId||item.jobNumber||"Job"} · ${formatDateLong(scheduleDateFromKeyV37(key))}`,kind:"schedule",category:"schedule",id:key});});
  low.forEach(i=>items.push({severity:"yellow",title:`Inventory warning: ${i.name}`,detail:`${i.quantity} ${i.unit||"units"} remaining; reorder level ${i.reorderAt}.`,kind:"inventory",category:"inventory",id:i.id}));
  return items;
}
function renderPriorityTabsV320(priorities=priorityItemsV320()){
  const counts={all:priorities.length,invoice:0,inventory:0,maintenance:0,customer:0,schedule:0,employee:0};
  priorities.forEach(item=>{const category=item.category||priorityCategoryV320(item.kind);if(Object.hasOwn(counts,category))counts[category]+=1;});
  document.querySelectorAll("[data-priority-count]").forEach(node=>{node.textContent=String(counts[node.dataset.priorityCount]||0);});
  document.querySelectorAll(".priority-tab").forEach(button=>button.classList.toggle("active",button.dataset.priorityCategory===activePriorityCategoryV320));
}
function renderPrioritiesV320(priorities=priorityItemsV320()){
  const host=byId("homePriorities");if(!host)return;
  renderPriorityTabsV320(priorities);
  const filtered=activePriorityCategoryV320==="all"?priorities:priorities.filter(item=>(item.category||priorityCategoryV320(item.kind))===activePriorityCategoryV320);
  if(filtered.length){host.innerHTML=`<div class="priority-list">${filtered.slice(0,15).map(x=>`<button type="button" class="priority-item ${x.severity}" onclick="openPriorityV320('${x.kind}','${String(x.id||"").replace(/'/g,"\'")}')"><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.detail)}</span></button>`).join("")}</div>`;return;}
  const label=document.querySelector(`.priority-tab[data-priority-category="${activePriorityCategoryV320}"]`)?.childNodes[0]?.textContent?.trim()||"This category";
  host.innerHTML=`<div class="priority-list"><article class="priority-item green"><strong>No ${escapeHtml(label.toLowerCase())} tasks are waiting.</strong><span>${activePriorityCategoryV320==="all"?"Today's active work is clear.":"This category has no active tasks today."}</span></article></div>`;
}
function openPriorityV320(kind,id){
  if(kind==="invoice"){switchTab("invoiceTab");loadInvoice(id);return;}if(kind==="billing"){openBillingCenter();return;}if(kind==="schedule"){switchTab("scheduleTab");return;}if(kind==="inventory"){switchTab("maintenanceTab");setTimeout(()=>openMaintenanceSubtab("inventoryMaintPanel"),20);return;}if(kind==="maintenance"){switchTab("maintenanceTab");return;}switchTab("alertsTab");
}
function briefingItemsV320(period){
  const items=[],today=getLocalDateString(),tomorrow=dateOffsetV320(1),weekEnd=dateOffsetV320(7),month=today.slice(0,7),schedule=getScheduleData(),maint=getMaintenanceCalendar(),low=lowInventoryItems(),invoices=getSavedInvoices();
  const add=(severity,title,detail)=>items.push({severity,title,detail});
  if(period==="today"){
    const jobs=Object.entries(schedule).filter(([k])=>k.startsWith(today));add(jobs.length?"yellow":"green",`${jobs.length} job${jobs.length===1?"":"s"} scheduled today`,jobs.length?"Review crew assignments, route order, gates, and weather before departure.":"No jobs are currently scheduled for today.");
    const due=invoices.filter(i=>(i.status||"Unpaid")!=="Paid"&&i.dueDate===today);if(due.length)add("red",`${due.length} invoice${due.length===1?" is":"s are"} due today`,"Complete or send the required billing action today.");
    const m=maint.filter(x=>x.date===today&&x.status!=="Verified");if(m.length)add("red",`${m.length} maintenance item${m.length===1?" is":"s are"} due today`,m.map(x=>`${x.equipment}: ${x.task}`).join(" · "));
    if(low.length)add("yellow",`${low.length} inventory item${low.length===1?" needs":"s need"} attention`,"Review quantities before crews leave for the day.");
  } else if(period==="tomorrow"){
    const jobs=Object.entries(schedule).filter(([k])=>k.startsWith(tomorrow));add(jobs.length?"yellow":"green",`${jobs.length} job${jobs.length===1?"":"s"} scheduled tomorrow`,jobs.length?"Review route, crew, gates, equipment, and weather before the day begins.":"No jobs are currently scheduled for tomorrow.");
    const due=invoices.filter(i=>(i.status||"Unpaid")!=="Paid"&&i.dueDate===tomorrow);if(due.length)add("yellow",`${due.length} invoice${due.length===1?"":"s"} due tomorrow`,"Prepare customer follow-up before the due date.");
    const m=maint.filter(x=>x.date===tomorrow&&x.status!=="Verified");if(m.length)add("yellow",`${m.length} maintenance item${m.length===1?"":"s"} scheduled tomorrow`,m.map(x=>`${x.equipment}: ${x.task}`).join(" · "));
  } else if(period==="week"){
    const jobs=Object.keys(schedule).filter(k=>{const d=scheduleDateFromKeyV37(k);return d>today&&d<=weekEnd;});add("yellow",`${jobs.length} job${jobs.length===1?"":"s"} scheduled in the next seven days`,"Use Scheduling to review workload and route balance.");
    const due=invoices.filter(i=>(i.status||"Unpaid")!=="Paid"&&i.dueDate>today&&i.dueDate<=weekEnd);if(due.length)add("yellow",`${due.length} invoice${due.length===1?"":"s"} due this week`,"Plan reminders before each due date.");
    const m=maint.filter(x=>x.date>today&&x.date<=weekEnd&&x.status!=="Verified");if(m.length)add("yellow",`${m.length} maintenance appointment${m.length===1?"":"s"} this week`,"Confirm parts, equipment, and employee availability.");
    if(low.length)add("yellow",`${low.length} inventory item${low.length===1?"":"s"} should be replenished`,"Inventory warnings remain yellow until quantities are restored above reorder levels.");
  } else {
    const monthPaid=invoices.filter(i=>(i.status||"Unpaid")==="Paid"&&String(invoicePaidRevenueDate(i)).startsWith(month)).reduce((s,i)=>s+Number(i.total||0),0),exp=expenseTotalsFor("month"),maintCost=maintenanceFinancials("month").total,profit=monthPaid-exp.operating-exp.payroll-maintCost;
    add("green",`Recorded paid revenue: ${formatMoney(monthPaid)}`,`Estimated month profit: ${formatMoney(profit)} after recorded operating, payroll, and maintenance expenses.`);
    const monthJobs=Object.keys(schedule).filter(k=>scheduleDateFromKeyV37(k).startsWith(month)).length;add("green",`${monthJobs} scheduled job${monthJobs===1?"":"s"} recorded this month`,"Completed and upcoming scheduled work are included.");
    const monthMaint=maint.filter(x=>String(x.date||"").startsWith(month)&&x.status!=="Verified");if(monthMaint.length)add("yellow",`${monthMaint.length} maintenance item${monthMaint.length===1?"":"s"} remain on this month's calendar`,"Review open maintenance before month end.");
  }
  if(!items.length)add("green","No preparation warnings for this period","The program has not identified any upcoming action items.");return items;
}
function renderBriefingV320(){const host=byId("ownerBriefing");if(!host)return;host.innerHTML=`<div class="briefing-list">${briefingItemsV320(activeBriefingPeriodV320).map(x=>`<article class="briefing-item ${x.severity}"><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.detail)}</span></article>`).join("")}</div>`;}
function reconcileActivityTransitionsV320(){
  const current=priorityItemsV320(),map=Object.fromEntries(current.map(x=>[`${x.kind}:${x.id||x.title}`,x])),previous=JSON.parse(localStorage.getItem(ACTIVITY_ACTIVE_SNAPSHOT_KEY_V320)||"{}");
  Object.entries(previous).forEach(([key,item])=>{if(!map[key])logActivityV320({category:item.kind==="invoice"||item.kind==="billing"?"Invoice":item.kind==="inventory"?"Inventory":item.kind==="schedule"?"Schedule":"Maintenance",title:`Completed: ${item.title}`,detail:item.detail||"Resolved in the application.",severity:"green",recordType:item.kind==="billing"?"invoice":item.kind,recordId:item.id||"",sourceKey:`resolved:${key}:${getLocalDateString()}`});});
  localStorage.setItem(ACTIVITY_ACTIVE_SNAPSHOT_KEY_V320,JSON.stringify(map));
}
const refreshHomeDashboardV320Base=refreshHomeDashboard;
refreshHomeDashboard=function(){
  try{refreshHomeDashboardV320Base();}catch(error){console.error("Legacy dashboard refresh warning:",error);}
  const invoices=getSavedInvoices(),alerts=buildCurrentAlerts(),todayJobs=getTodayScheduleItems(),monthExp=expenseTotalsFor("month"),monthMaint=maintenanceFinancials("month"),monthPaid=invoices.filter(i=>(i.status||"Unpaid")==="Paid"&&intelligenceDateInPeriod(invoicePaidRevenueDate(i),"month")).reduce((s,i)=>s+Number(i.total||0),0),profit=monthPaid-monthExp.operating-monthExp.payroll-monthMaint.total,overdue=invoices.filter(i=>invoiceDueState(i)==="overdue"),priorities=priorityItemsV320(),low=lowInventoryItems(),scheduledMaint=getMaintenanceCalendar().filter(x=>x.status!=="Verified"&&x.date).sort((a,b)=>a.date.localeCompare(b.date));
  const metricData=[
    ["Jobs Today",todayJobs.length,"scheduleTab","green",""],
    ["Active Alerts",priorities.length,"home-priorities",priorities.length?"red":"green",""],
    ["Overdue Invoices",overdue.length,"invoiceTab",overdue.length?"red":"green",""],
    ["Month Revenue",formatMoney(monthPaid),"invoiceTab","green",""],
    ["Month Expenses",formatMoney(monthExp.operating+monthExp.payroll+monthMaint.total),"maintenanceTab","red",""],
    ["Est. Month Profit",formatMoney(profit),"invoiceTab",profit>=0?"green":"red","profit-metric"]
  ];
  if(byId("homeMetricCards"))byId("homeMetricCards").innerHTML=metricData.map(([l,v,target,tone,extra])=>`<button type="button" class="intelligence-card ${extra}" data-dashboard-target="${target}" data-metric-tone="${tone}"><span>${l}</span><strong>${v}</strong></button>`).join("");
  byId("homeMetricCards")?.querySelectorAll("[data-dashboard-target]").forEach(btn=>btn.addEventListener("click",()=>{const t=btn.dataset.dashboardTarget;if(t==="home-priorities")document.querySelector('[data-card-id="priorities"]')?.scrollIntoView({behavior:"smooth"});else switchTab(t);}));
  renderPrioritiesV320(priorities);
  if(byId("homeInventory"))byId("homeInventory").innerHTML=low.length?`<div class="simple-list">${low.map(i=>`<p><strong>${escapeHtml(i.name)}</strong>: ${i.quantity} ${escapeHtml(i.unit||"units")} remaining</p>`).join("")}</div>`:'<p class="empty-message">Inventory is above reorder levels.</p>';
  const inventoryBadge=byId("homeInventoryBadge");
  if(inventoryBadge){inventoryBadge.textContent=String(low.length);inventoryBadge.className=`dashboard-count-badge ${low.length?"is-critical":"is-warning"}`;}
  if(byId("homeInventoryPreview"))byId("homeInventoryPreview").textContent=low.length?low.slice(0,2).map(i=>`${i.name}: ${i.quantity} ${i.unit||"units"}`).join(" · "):"Inventory levels are healthy.";
  if(byId("homeUpcoming"))byId("homeUpcoming").innerHTML=scheduledMaint.length?`<div class="insight-list">${scheduledMaint.slice(0,10).map(x=>`<article><strong>${formatDateLong(x.date)} · ${escapeHtml(x.equipment||"Equipment")}</strong><span>${escapeHtml(x.task)} · ${escapeHtml(x.status)}</span></article>`).join("")}</div>`:'<p class="empty-message">No future maintenance is scheduled.</p>';
  const today=getLocalDateString(),maintenanceUrgent=scheduledMaint.filter(x=>x.date<=dateOffsetV320(7));
  const maintenanceBadge=byId("homeMaintenanceBadge");
  if(maintenanceBadge){maintenanceBadge.textContent=String(scheduledMaint.length);maintenanceBadge.className=`dashboard-count-badge ${maintenanceUrgent.length?"is-critical":"is-clear"}`;}
  if(byId("homeMaintenancePreview"))byId("homeMaintenancePreview").textContent=scheduledMaint.length?scheduledMaint.slice(0,2).map(x=>`${formatDateLong(x.date)}: ${x.equipment||"Equipment"} - ${x.task}`).join(" · "):"No maintenance due.";
  renderBriefingV320();reconcileActivityTransitionsV320();renderActivityHistoryV320();renderHomeHistoryPreviewV320();
};
function installActivityHooksV320(){
  const wrap=(name,category,titleFn,recordFn)=>{const original=window[name];if(typeof original!=="function"||original._activityWrapped)return;const wrapped=function(...args){const before=activityHistoryV320().length,result=original.apply(this,args);setTimeout(()=>{const data=titleFn?.(...args)||{};if(data.title&&activityHistoryV320().length===before)logActivityV320({category,title:data.title,detail:data.detail||"",severity:"green",recordType:recordFn?.(...args)?.type||"",recordId:recordFn?.(...args)?.id||""});refreshHomeDashboard();},0);return result;};wrapped._activityWrapped=true;window[name]=wrapped;};
  wrap("saveCustomer","Customer",()=>({title:`Customer record saved`,detail:byId("customerName")?.value||byId("customerBusiness")?.value||"Customer"}),()=>({type:"customer",id:activeCustomerId||""}));
  wrap("saveQuote","Financial",()=>({title:`Quote saved`,detail:byId("quoteNumber")?.value||"Quote"}),()=>({type:"quote",id:activeQuoteId||""}));
  wrap("saveInvoice","Invoice",()=>({title:`Invoice saved`,detail:byId("jobNumber")?.value||"Invoice"}),()=>({type:"invoice",id:activeInvoiceId||""}));
  wrap("emailInvoice","Communication",()=>({title:`Invoice email prepared`,detail:byId("jobNumber")?.value||"Invoice"}),()=>({type:"invoice",id:activeInvoiceId||""}));
  wrap("saveSchedule","Schedule",()=>({title:"Schedule updated",detail:`Schedule saved on ${getLocalDateString()}`}),()=>({type:"schedule",id:""}));
  wrap("saveMaintenanceRecords","Maintenance",()=>({title:"Maintenance records updated",detail:"Equipment maintenance data saved."}),()=>({type:"maintenance",id:""}));
  wrap("saveInventory","Inventory",()=>({title:"Inventory updated",detail:"Inventory quantities and reorder levels saved."}),()=>({type:"inventory",id:""}));
  wrap("saveEmployee","Employee",()=>({title:"Employee record saved",detail:byId("employeeName")?.value||"Employee"}),()=>({type:"employee",id:activeEmployeeId||""}));
}


/* v3.20 Phase Two Revision 2 - responsive dashboard masonry */
function initializeResponsiveHomeDashboardV320(){
  const grid=byId("homeDashboardGrid");
  if(!grid||grid.dataset.masonryReady==="true")return;
  grid.dataset.masonryReady="true";

  const layout=()=>{
    if(window.matchMedia("(max-width: 900px)").matches){
      [...grid.children].forEach(item=>item.style.removeProperty("grid-row-end"));
      return;
    }
    const styles=getComputedStyle(grid);
    const rowHeight=parseFloat(styles.getPropertyValue("--home-grid-row"))||8;
    const gap=parseFloat(styles.rowGap)||12;
    grid.classList.add("is-measuring");
    [...grid.children].forEach(item=>{
      item.style.removeProperty("grid-row-end");
      const height=item.getBoundingClientRect().height;
      const span=Math.max(1,Math.ceil((height+gap)/(rowHeight+gap)));
      item.style.gridRowEnd=`span ${span}`;
    });
    grid.classList.remove("is-measuring");
  };

  let frame=0;
  const scheduleLayout=()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>requestAnimationFrame(layout));
  };

  const observer=new ResizeObserver(scheduleLayout);
  [...grid.children].forEach(item=>observer.observe(item));
  grid.querySelectorAll("details").forEach(details=>details.addEventListener("toggle",scheduleLayout));
  window.addEventListener("resize",scheduleLayout,{passive:true});
  grid.addEventListener("drop",scheduleLayout);
  new MutationObserver(scheduleLayout).observe(grid,{childList:true,subtree:true,characterData:true});
  scheduleLayout();
}

function initializePhaseTwoV320(){
  document.querySelectorAll(".priority-tab").forEach(btn=>btn.addEventListener("click",()=>{activePriorityCategoryV320=btn.dataset.priorityCategory;renderPrioritiesV320();}));
  document.querySelectorAll(".briefing-tab").forEach(btn=>btn.addEventListener("click",()=>{activeBriefingPeriodV320=btn.dataset.briefingPeriod;document.querySelectorAll(".briefing-tab").forEach(x=>x.classList.toggle("active",x===btn));renderBriefingV320();}));
  ["historySearch","historyDate","historyCategory"].forEach(id=>byId(id)?.addEventListener("input",renderActivityHistoryV320));
  document.querySelectorAll("[data-history-range]").forEach(btn=>btn.addEventListener("click",()=>{activeHistoryRangeV320=btn.dataset.historyRange;document.querySelectorAll("[data-history-range]").forEach(x=>x.classList.toggle("active",x===btn));if(byId("historyDate"))byId("historyDate").value="";renderActivityHistoryV320();}));
  installActivityHooksV320();refreshHomeDashboard();renderActivityHistoryV320();initializeResponsiveHomeDashboardV320();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializePhaseTwoV320,120),{once:true});else setTimeout(initializePhaseTwoV320,120);


/* Revision 5 UI synchronization and programmable communication templates */
const COMMUNICATION_USER_TEMPLATES_KEY_V321="plc_user_communication_templates_v1";
function readCommunicationTemplatesV321(){return readArray(COMMUNICATION_USER_TEMPLATES_KEY_V321);}
function populateCommunicationTemplatesV321(){
  const select=byId("communicationTemplate");if(!select)return;
  const current=select.value;
  [...select.querySelectorAll('option[data-user-template="true"]')].forEach(x=>x.remove());
  readCommunicationTemplatesV321().forEach(item=>{const option=document.createElement("option");option.value=`user:${item.id}`;option.dataset.userTemplate="true";option.textContent=item.name;select.insertBefore(option,select.querySelector('option[value="custom"]'));});
  if([...select.options].some(x=>x.value===current))select.value=current;
}
function saveCommunicationTemplateV321(){
  const subject=byId("communicationSubject")?.value.trim()||"",body=byId("communicationBody")?.value.trim()||"";
  if(!subject&&!body){alert("Enter a subject or message before saving a template.");return;}
  const name=prompt("Template name:",subject||"Saved Message");if(!name)return;
  const list=readCommunicationTemplatesV321(),item={id:makeId("message-template"),name:name.trim(),subject,body,createdAt:new Date().toISOString()};list.push(item);writeArray(COMMUNICATION_USER_TEMPLATES_KEY_V321,list);populateCommunicationTemplatesV321();byId("communicationTemplate").value=`user:${item.id}`;setCommunicationStatus(`Saved template: ${item.name}`);
}
function deleteCommunicationTemplateV321(){
  const value=byId("communicationTemplate")?.value||"";if(!value.startsWith("user:")){alert("Select a saved custom template first.");return;}
  if(!confirm("Delete this saved template?"))return;writeArray(COMMUNICATION_USER_TEMPLATES_KEY_V321,readCommunicationTemplatesV321().filter(x=>`user:${x.id}`!==value));populateCommunicationTemplatesV321();byId("communicationTemplate").value="custom";setCommunicationStatus("Saved template deleted.");
}
const applyCommunicationTemplateV321Base=applyCommunicationTemplate;
applyCommunicationTemplate=function(){
  const value=byId("communicationTemplate")?.value||"";
  if(value.startsWith("user:")){const item=readCommunicationTemplatesV321().find(x=>`user:${x.id}`===value);if(item){byId("communicationSubject").value=item.subject||"";byId("communicationBody").value=item.body||"";}return;}
  applyCommunicationTemplateV321Base();
};
const loadInvoiceV321Base=loadInvoice;
loadInvoice=function(id){const result=loadInvoiceV321Base(id);loadInvoiceAddressFieldsV321();return result;};
const newInvoiceV321Base=newInvoice;
newInvoice=function(){const result=newInvoiceV321Base();loadInvoiceAddressFieldsV321();return result;};
const loadQuoteV321Base=loadQuote;
loadQuote=function(id){const result=loadQuoteV321Base(id);loadQuoteAddressFieldsV321(byId("quoteAddress")?.value||"");return result;};
const newQuoteV321Base=newQuote;
newQuote=function(){const result=newQuoteV321Base();loadQuoteAddressFieldsV321("");return result;};
const switchTabV321Base=switchTab;
switchTab=function(tabId){const result=switchTabV321Base(tabId);if(tabId==="weatherTab")window.setTimeout(()=>{if(typeof initializeWeatherRadarMap==="function")initializeWeatherRadarMap();if(weatherMap?.invalidateSize)weatherMap.invalidateSize();if(typeof refreshRadarFrames==="function")refreshRadarFrames();},120);return result;};
function resizeEmailShellV322(input){
  if(!input)return;const shell=input.closest(".email-input-shell");if(!shell)return;
  const length=Math.max(24,String(input.value||input.placeholder||"").length);
  const width=Math.max(38,Math.min(72,length+16));
  shell.style.width=`min(100%, ${width}ch)`;
}
function resizeAllEmailFieldsV322(root=document){root.querySelectorAll(".email-input-shell input").forEach(resizeEmailShellV322);}

document.addEventListener("input",event=>{if(event.target.matches?.(".email-input-shell input"))resizeEmailShellV322(event.target);});

document.addEventListener("DOMContentLoaded",()=>{
  ["invoiceBillingCity","invoiceBillingState","invoiceBillingZip"].forEach(id=>byId(id)?.addEventListener("input",syncInvoiceAddressFieldsV321));
  ["quoteStreet","quoteCity","quoteState","quoteZip"].forEach(id=>byId(id)?.addEventListener("input",syncQuoteAddressFieldsV321));
  populateCommunicationTemplatesV321();
  loadInvoiceAddressFieldsV321();
  loadQuoteAddressFieldsV321(byId("quoteAddress")?.value||"");
  setQuoteCustomerModeV322(byId("quoteCustomer")?.value?"existing":"new");
  resizeAllEmailFieldsV322();
});

/* Paradise Lawn Care v3.21A - Account & Data Engine */
const PLC_ACCOUNT_SEQUENCE_KEY = "plc_account_sequence_v321";
const PLC_ZIP_CACHE_KEY = "plc_zip_cache_v321";
const PLC_ACCOUNT_PREFIX = "PLC-";

function digitsOnlyV321(value){return String(value||"").replace(/\D/g,"");}
function normalizedTextV321(value){return String(value||"").trim().toLowerCase().replace(/\s+/g," ");}
function accountNumberFromLegacyV321(value){
  const raw=String(value||"").trim();
  if(/^PLC-/i.test(raw)) return raw.toUpperCase();
  if(/DEMO/i.test(raw)){const n=(raw.match(/(\d+)$/)||[])[1]||"001";return `PLC-DEMO-${String(n).padStart(3,"0")}`;}
  const n=(raw.match(/(\d+)$/)||[])[1];
  return n?`${PLC_ACCOUNT_PREFIX}${String(Number(n)).padStart(6,"0")}`:"";
}
function syncAccountSequenceV321(customers){
  const max=Math.max(0,...customers.map(c=>Number((String(c.accountNumber||c.customerNumber||"").match(/^PLC-(\d+)$/)||[])[1]||0)));
  const current=Number(localStorage.getItem(PLC_ACCOUNT_SEQUENCE_KEY))||0;
  if(max>current)localStorage.setItem(PLC_ACCOUNT_SEQUENCE_KEY,String(max));
}
function generateAccountNumberV321(){
  const next=(Number(localStorage.getItem(PLC_ACCOUNT_SEQUENCE_KEY))||0)+1;
  localStorage.setItem(PLC_ACCOUNT_SEQUENCE_KEY,String(next));
  return `${PLC_ACCOUNT_PREFIX}${String(next).padStart(6,"0")}`;
}
function ensureAccountNumberV321(customer){
  if(!customer)return "";
  customer.accountNumber=customer.accountNumber||accountNumberFromLegacyV321(customer.customerNumber)||generateAccountNumberV321();
  customer.customerNumber=customer.accountNumber; // compatibility alias
  return customer.accountNumber;
}
function accountNumberForRecordV321(record){
  if(!record)return "";
  const customer=customerByIdV36(record.customerId);
  return record.accountNumber||record.customerNumber||customer?.accountNumber||customer?.customerNumber||"";
}
function migrateAccountDataV321(){
  const customers=readArray(CUSTOMER_STORAGE_KEY);syncAccountSequenceV321(customers);let cc=false;
  customers.forEach(c=>{const before=`${c.accountNumber||""}|${c.customerNumber||""}`;ensureAccountNumberV321(c);if(before!==`${c.accountNumber}|${c.customerNumber}`)cc=true;});
  if(cc)writeArray(CUSTOMER_STORAGE_KEY,customers);
  const cmap=new Map(customers.map(c=>[c.id,c]));
  const quotes=readArray(QUOTE_STORAGE_KEY);let qc=false;
  quotes.forEach(q=>{const acct=ensureAccountNumberV321(cmap.get(q.customerId));if(acct&&(q.accountNumber!==acct||q.customerNumber!==acct)){q.accountNumber=acct;q.customerNumber=acct;qc=true;}if(!q.quoteNumber){q.quoteNumber=q.number||quoteSequence();q.number=q.quoteNumber;qc=true;}});
  if(qc)writeArray(QUOTE_STORAGE_KEY,quotes);
  const invoices=getSavedInvoices();let ic=false;
  invoices.forEach(i=>{const acct=ensureAccountNumberV321(cmap.get(i.customerId));if(acct&&(i.accountNumber!==acct||i.customerNumber!==acct)){i.accountNumber=acct;i.customerNumber=acct;ic=true;}if(!i.invoiceNumber){i.invoiceNumber=i.jobNumber||generateInvoiceNumberV36();ic=true;}if(i.jobNumber!==i.invoiceNumber){i.jobNumber=i.invoiceNumber;ic=true;}});
  if(ic)storeInvoices(invoices);
  migrateScheduleAccountNumbersV321(customers);
}
function migrateScheduleAccountNumbersV321(customers=readArray(CUSTOMER_STORAGE_KEY)){
  const data=getScheduleData();let changed=false;const cmap=new Map(customers.map(c=>[c.id,c]));
  Object.values(data).forEach(item=>{const acct=ensureAccountNumberV321(cmap.get(item.customerId));if(acct&&(item.accountNumber!==acct||item.customerNumber!==acct)){item.accountNumber=acct;item.customerNumber=acct;changed=true;}});
  if(changed)localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(data));
}

function customerMatchScoreV321(candidate,data){
  let score=0;
  const name=normalizedTextV321(data.name),business=normalizedTextV321(data.business),email=normalizedTextV321(data.email),phone=digitsOnlyV321(data.phone),address=normalizedTextV321(data.address);
  if(email&&normalizedTextV321(candidate.email)===email)score+=100;
  if(phone.length>=10&&digitsOnlyV321(candidate.phone).slice(-10)===phone.slice(-10))score+=90;
  if(name&&normalizedTextV321(candidate.name)===name)score+=35;
  if(business&&normalizedTextV321(candidate.business)===business)score+=35;
  const addresses=[candidate.billing,...(candidate.properties||[]).map(p=>p.address)].map(normalizedTextV321);
  if(address&&addresses.includes(address))score+=40;
  return score;
}
function possibleCustomerMatchesV321(data,excludeId=""){
  return readArray(CUSTOMER_STORAGE_KEY).map(c=>({customer:c,score:customerMatchScoreV321(c,data)})).filter(x=>x.customer.id!==excludeId&&x.score>=70).sort((a,b)=>b.score-a.score);
}
function currentCustomerFormDataV321(){return {name:byId("customerName")?.value,business:byId("customerBusiness")?.value,email:byId("customerEmail")?.value,phone:byId("customerPhone")?.value,address:composeAddressV321(byId("customerBilling")?.value,byId("customerCity")?.value,byId("customerState")?.value,byId("customerZip")?.value)};}
function currentQuoteCustomerDataV321(){return {name:byId("quoteClientName")?.value,business:byId("quoteBusinessName")?.value,email:byId("quoteEmail")?.value,phone:byId("quotePhone")?.value,address:composeAddressV321(byId("quoteStreet")?.value,byId("quoteCity")?.value,byId("quoteState")?.value,byId("quoteZip")?.value)};}
function ensureMatchBannerV321(container,id){
  let banner=byId(id);if(banner)return banner;
  banner=document.createElement("div");banner.id=id;banner.className="account-match-banner";banner.setAttribute("role","status");banner.setAttribute("aria-live","polite");container?.prepend(banner);return banner;
}
function renderPossibleMatchV321(kind,matches){
  const isQuote=kind==="quote";const container=isQuote?byId("quoteCustomerMode")?.closest(".section"):byId("customerName")?.closest(".section");
  const banner=ensureMatchBannerV321(container,`${kind}AccountMatchBanner`);
  if(!banner)return;
  if(!matches.length){banner.classList.remove("is-visible");banner.innerHTML="";return;}
  const c=matches[0].customer;const acct=ensureAccountNumberV321(c);
  banner.innerHTML=`<div><strong>Possible existing account found</strong><span>${escapeHtml(c.name||c.business||"Customer")} · ${escapeHtml(acct)} · ${escapeHtml(c.phone||c.email||"")}</span></div><div class="account-match-actions"><button type="button" data-open-match="${escapeHtml(c.id)}">Open Existing Account</button><button type="button" class="secondary-button" data-dismiss-match>Continue as New</button></div>`;
  banner.classList.add("is-visible");
  banner.querySelector("[data-open-match]")?.addEventListener("click",()=>{if(isQuote){setQuoteCustomerModeV322("existing");byId("quoteCustomer").value=c.id;fillQuoteCustomerDetailsV318(c,c.properties?.[0]);setQuoteCustomerDisplayV318(c);updateQuotePropertyCompactV322(c);}else loadCustomer(c.id);banner.classList.remove("is-visible");});
  banner.querySelector("[data-dismiss-match]")?.addEventListener("click",()=>{banner.dataset.dismissedFor=JSON.stringify(isQuote?currentQuoteCustomerDataV321():currentCustomerFormDataV321());banner.classList.remove("is-visible");});
}
let customerMatchTimerV321=0;
function checkCustomerMatchesV321(kind){clearTimeout(customerMatchTimerV321);customerMatchTimerV321=setTimeout(()=>{const data=kind==="quote"?currentQuoteCustomerDataV321():currentCustomerFormDataV321();const meaningful=data.email||digitsOnlyV321(data.phone).length>=10||normalizedTextV321(data.name).length>=4||normalizedTextV321(data.business).length>=4;if(!meaningful)return renderPossibleMatchV321(kind,[]);renderPossibleMatchV321(kind,possibleCustomerMatchesV321(data,kind==="customer"?activeCustomerId:""));},250);}

function customerSnapshotV321(customer){
  const billing=parseCustomerBillingAddress(customer);
  return {accountNumber:ensureAccountNumberV321(customer),customerNumber:customer.accountNumber,name:customer.name||"",business:customer.business||"",phone:customer.phone||"",email:customer.email||"",preferredContact:preferredContactForRecord(customer),billing:formatCustomerBillingAddress(billing),billingStreet:billing.street,billingCity:billing.city,billingState:billing.state,billingZip:billing.zip};
}
function syncCustomerAcrossRecordsV321(customerId){
  const customers=readArray(CUSTOMER_STORAGE_KEY),customer=customers.find(c=>c.id===customerId);if(!customer)return;
  const snap=customerSnapshotV321(customer);writeArray(CUSTOMER_STORAGE_KEY,customers);
  const quotes=readArray(QUOTE_STORAGE_KEY);let qc=false;
  quotes.forEach(q=>{if(q.customerId!==customerId)return;Object.assign(q,{accountNumber:snap.accountNumber,customerNumber:snap.accountNumber,customerName:snap.name||snap.business,businessName:snap.business,phone:snap.phone,email:snap.email,preferredContact:snap.preferredContact});qc=true;});if(qc)writeArray(QUOTE_STORAGE_KEY,quotes);
  const invoices=getSavedInvoices();let ic=false;
  invoices.forEach(i=>{if(i.customerId!==customerId)return;Object.assign(i,{accountNumber:snap.accountNumber,customerNumber:snap.accountNumber,clientName:snap.name,businessName:snap.business,phone:snap.phone,email:snap.email,preferredContact:snap.preferredContact,billingAddress:snap.billingStreet,cityStateZip:[snap.billingCity,snap.billingState,snap.billingZip].filter(Boolean).join(", ")});ic=true;});if(ic)storeInvoices(invoices);
  migrateScheduleAccountNumbersV321(customers);
  populateCustomerSelectors();populateInvoiceLinkSelectors();renderCustomerList();renderQuotes();renderInvoiceList();renderSchedule();renderCommunicationRecipients();
}

const saveCustomerV321AccountBase=saveCustomer;
saveCustomer=function(){
  if(!activeCustomerId){const matches=possibleCustomerMatchesV321(currentCustomerFormDataV321());if(matches.length&&!confirm(`A possible existing account was found: ${matches[0].customer.name||matches[0].customer.business} (${ensureAccountNumberV321(matches[0].customer)}). Create a separate new account anyway?`))return;}
  const result=saveCustomerV321AccountBase();
  const list=readArray(CUSTOMER_STORAGE_KEY),c=list.find(x=>x.id===activeCustomerId);if(c){ensureAccountNumberV321(c);writeArray(CUSTOMER_STORAGE_KEY,list);syncCustomerAcrossRecordsV321(c.id);if(byId("customerNumberDisplay"))byId("customerNumberDisplay").textContent=c.accountNumber;}
  return result;
};
const loadCustomerV321AccountBase=loadCustomer;
loadCustomer=function(id){const result=loadCustomerV321AccountBase(id);const c=customerByIdV36(id);if(c){ensureAccountNumberV321(c);if(byId("customerNumberDisplay"))byId("customerNumberDisplay").textContent=c.accountNumber;}return result;};

const collectInvoiceV321AccountBase=collectInvoice;
collectInvoice=function(){const invoice=collectInvoiceV321AccountBase();const c=customerByIdV36(invoice.customerId);const acct=c?ensureAccountNumberV321(c):invoice.accountNumber||invoice.customerNumber||"";invoice.accountNumber=acct;invoice.customerNumber=acct;invoice.invoiceNumber=invoice.invoiceNumber||invoice.jobNumber;invoice.jobNumber=invoice.invoiceNumber;return invoice;};
const loadInvoiceV321AccountBase2=loadInvoice;
loadInvoice=function(id){const result=loadInvoiceV321AccountBase2(id);const i=getSavedInvoices().find(x=>x.id===id),acct=accountNumberForRecordV321(i);if(byId("invoiceCustomerNumber"))byId("invoiceCustomerNumber").value=acct;return result;};
const populateInvoiceLinkSelectorsV321AccountBase=populateInvoiceLinkSelectors;
populateInvoiceLinkSelectors=function(invoice=null){const result=populateInvoiceLinkSelectorsV321AccountBase(invoice);const c=customerByIdV36(invoice?.customerId||byId("invoiceCustomerLink")?.value);if(c&&byId("invoiceCustomerNumber"))byId("invoiceCustomerNumber").value=ensureAccountNumberV321(c);return result;};

const saveQuoteV321AccountBase=saveQuote;
saveQuote=function(){
  if(byId("quoteCustomerMode")?.value==="new"){const matches=possibleCustomerMatchesV321(currentQuoteCustomerDataV321());if(matches.length&&!confirm(`A possible existing account was found: ${matches[0].customer.name||matches[0].customer.business} (${ensureAccountNumberV321(matches[0].customer)}). Create a new account anyway?`))return;}
  const result=saveQuoteV321AccountBase();const quotes=readArray(QUOTE_STORAGE_KEY),q=quotes.find(x=>x.id===activeQuoteId),c=customerByIdV36(q?.customerId);if(q&&c){const acct=ensureAccountNumberV321(c);q.accountNumber=acct;q.customerNumber=acct;q.quoteNumber=q.number;writeArray(QUOTE_STORAGE_KEY,quotes);syncCustomerAcrossRecordsV321(c.id);}return result;
};

const renderCustomerListV321AccountBase=renderCustomerList;
renderCustomerList=function(){
  const host=byId("customerList");
  if(!host)return renderCustomerListV321AccountBase();
  const q=(byId("customerSearch")?.value||"").toLowerCase();
  const list=readArray(CUSTOMER_STORAGE_KEY).filter(c=>JSON.stringify(c).toLowerCase().includes(q));
  host.innerHTML=list.length?list.map(c=>{
    const propertyCount=c.properties?.length||0;
    const contact=c.phone||c.email||"No contact entered";
    const location=c.properties?.[0]?.city||parseCustomerBillingAddress(c).city||"";
    return `<button type="button" class="record-card finder-record-card customer-finder-card" onclick="loadCustomer('${c.id}')">
      <span class="finder-record-primary"><strong>${escapeHtml(c.name||c.business||"Unnamed customer")}</strong><span class="account-number-chip">${escapeHtml(ensureAccountNumberV321(c))}</span></span>
      <span class="finder-record-secondary"><span>${escapeHtml(contact)}</span>${location?`<span>${escapeHtml(location)}</span>`:""}<span>${propertyCount} propert${propertyCount===1?"y":"ies"}</span></span>
    </button>`;
  }).join(""):'<p class="empty-message">No customers saved.</p>';
};
const renderQuotesV321AccountBase=renderQuotes;
renderQuotes=function(){
  const host=byId("quoteList");
  if(!host)return renderQuotesV321AccountBase();
  const list=readArray(QUOTE_STORAGE_KEY).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  host.innerHTML=list.length?list.map(q=>{
    const summary=q.scope||q.frequency||"No description entered";
    return `<button type="button" class="record-card finder-record-card quote-finder-card" onclick="loadQuote('${q.id}')">
      <span class="finder-record-primary"><strong>${escapeHtml(q.number||"Quote")}</strong><span>${escapeHtml(q.customerName||"Customer")}</span><span class="finder-record-amount">${formatMoney(q.amount)}</span></span>
      <span class="finder-record-secondary"><span class="account-number-chip">${escapeHtml(accountNumberForRecordV321(q)||"No account")}</span><span>${escapeHtml(q.status||"Draft")}</span><span class="finder-record-summary">${escapeHtml(summary)}</span></span>
    </button>`;
  }).join(""):'<p class="empty-message">No quotes saved.</p>';
};

const viewInvoicePdfV321AccountBase=typeof viewInvoicePdf==="function"?viewInvoicePdf:null;
if(viewInvoicePdfV321AccountBase){viewInvoicePdf=function(){const result=viewInvoicePdfV321AccountBase();const invoice=activeInvoiceId?getSavedInvoices().find(x=>x.id===activeInvoiceId):collectInvoice();const meta=byId("pdfPreview")?.querySelector(".pdf-meta > div:first-child");if(meta&&invoice){const account=accountNumberForRecordV321(invoice);if(account&&!meta.textContent.includes("Account Number"))meta.insertAdjacentHTML("beforeend",`<br><strong>Account Number:</strong> ${escapeHtml(account)}`);}return result;};}

function readZipCacheV321(){try{return JSON.parse(localStorage.getItem(PLC_ZIP_CACHE_KEY)||"{}")}catch(_){return {}}}
function writeZipCacheV321(cache){localStorage.setItem(PLC_ZIP_CACHE_KEY,JSON.stringify(cache));}
async function lookupZipV321(zip){const clean=digitsOnlyV321(zip).slice(0,5);if(clean.length!==5)return null;const cache=readZipCacheV321();if(cache[clean])return cache[clean];try{const response=await fetch(`https://api.zippopotam.us/us/${clean}`);if(!response.ok)throw new Error("ZIP not found");const data=await response.json(),place=data.places?.[0];if(!place)return null;const result={city:place["place name"]||"",state:place["state abbreviation"]||""};cache[clean]=result;writeZipCacheV321(cache);return result;}catch(error){return null;}}
function ensureZipStatusV321(input){
  // v3.21B: ZIP lookup remains silent because City and State already display the result.
  const existing=input?.parentElement?.querySelector(".zip-lookup-status");
  if(existing) existing.remove();
  return {className:"zip-lookup-status",textContent:""};
}
let zipTimerV321=0;
function wireZipAutofillV321(zipInput,cityInput,stateInput){
  if(!zipInput||zipInput.dataset.zipWired==="true")return;
  zipInput.dataset.zipWired="true";
  zipInput.addEventListener("input",()=>{
    clearTimeout(zipTimerV321);
    const zip=digitsOnlyV321(zipInput.value).slice(0,5);
    if(zip.length!==5)return;
    zipTimerV321=setTimeout(async()=>{
      const result=await lookupZipV321(zip);
      if(!result)return;
      if(cityInput)cityInput.value=result.city;
      if(stateInput)stateInput.value=result.state;
      cityInput?.dispatchEvent(new Event("input",{bubbles:true}));
      stateInput?.dispatchEvent(new Event("input",{bubbles:true}));
    },350);
  });
}
function refreshSavedAddressSuggestionsV321(){let list=byId("plcSavedAddresses");if(!list){list=document.createElement("datalist");list.id="plcSavedAddresses";document.body.appendChild(list);}const addresses=new Set();readArray(CUSTOMER_STORAGE_KEY).forEach(c=>{if(c.billing)addresses.add(c.billing);(c.properties||[]).forEach(p=>p.address&&addresses.add(p.address));});list.innerHTML=[...addresses].sort().map(a=>`<option value="${escapeHtml(a)}"></option>`).join("");document.querySelectorAll('input[autocomplete="street-address"], .service-address').forEach(input=>input.setAttribute("list","plcSavedAddresses"));}
function wireDynamicPropertyZipsV321(root=document){root.querySelectorAll(".property-row").forEach(row=>wireZipAutofillV321(row.querySelector(".prop-zip"),row.querySelector(".prop-city"),row.querySelector(".prop-state")));}
function initializeAccountDataEngineV321(){
  migrateAccountDataV321();
  const invoiceJob=byId("invoiceJobId")?.closest("div");if(invoiceJob)invoiceJob.hidden=true;
  document.querySelectorAll("label,span").forEach(el=>{if(el.textContent.trim()==="Customer ID")el.textContent="Account Number";if(el.textContent.trim()==="Job ID")el.textContent="Internal Record ID";});
  wireZipAutofillV321(byId("customerZip"),byId("customerCity"),byId("customerState"));
  wireZipAutofillV321(byId("quoteZip"),byId("quoteCity"),byId("quoteState"));
  wireZipAutofillV321(byId("invoiceBillingZip"),byId("invoiceBillingCity"),byId("invoiceBillingState"));
  wireDynamicPropertyZipsV321();refreshSavedAddressSuggestionsV321();
  ["customerName","customerBusiness","customerPhone","customerEmail","customerBilling"].forEach(id=>byId(id)?.addEventListener("input",()=>checkCustomerMatchesV321("customer")));
  ["quoteClientName","quoteBusinessName","quotePhone","quoteEmail","quoteStreet"].forEach(id=>byId(id)?.addEventListener("input",()=>{if(byId("quoteCustomerMode")?.value==="new")checkCustomerMatchesV321("quote");}));
  const observer=new MutationObserver(()=>{wireDynamicPropertyZipsV321();refreshSavedAddressSuggestionsV321();});if(byId("propertyRows"))observer.observe(byId("propertyRows"),{childList:true});
  renderCustomerList();renderQuotes();renderInvoiceList();renderSchedule();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializeAccountDataEngineV321,250),{once:true});else setTimeout(initializeAccountDataEngineV321,250);

const setQuoteCustomerDisplayV321AccountBase=setQuoteCustomerDisplayV318;
setQuoteCustomerDisplayV318=function(customer){
  setQuoteCustomerDisplayV321AccountBase(customer);
  if(customer&&byId("quoteCustomerDisplay"))byId("quoteCustomerDisplay").textContent=`${customer.name||customer.business||"Selected customer"} · ${ensureAccountNumberV321(customer)}`;
};


/* Paradise Lawn Care v3.21B Development Test Release */
const PLC_DEVELOPMENT_REMINDER_KEY_V321B="plc_development_backup_reminder_v321b";
function exportParadiseBackupV321B(closeReminder=false){
  const storage={};
  for(let index=0;index<localStorage.length;index+=1){
    const key=localStorage.key(index);
    if(key)storage[key]=localStorage.getItem(key);
  }
  const payload={
    application:"Paradise Lawn Care Operations Suite",
    version:"3.21B Development Test Release",
    exportedAt:new Date().toISOString(),
    localStorage:storage
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=`Paradise-Lawn-Care-Backup-${getLocalDateString()}.json`;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  localStorage.setItem(PLC_DEVELOPMENT_REMINDER_KEY_V321B,"exported");
  if(closeReminder)dismissDevelopmentReminderV321B();
  return payload;
}
function dismissDevelopmentReminderV321B(){
  localStorage.setItem(PLC_DEVELOPMENT_REMINDER_KEY_V321B,"acknowledged");
  const reminder=byId("developmentBackupReminder");if(reminder)reminder.hidden=true;
}
function showDevelopmentReminderV321B(){
  if(localStorage.getItem(PLC_DEVELOPMENT_REMINDER_KEY_V321B))return;
  const reminder=byId("developmentBackupReminder");if(reminder)reminder.hidden=false;
}
function verifyAccountLinkIntegrityV321B(){
  const customers=readArray(CUSTOMER_STORAGE_KEY);
  const customerMap=new Map(customers.map(c=>[c.id,c]));
  const issues=[];
  readArray(QUOTE_STORAGE_KEY).forEach(q=>{
    const customer=customerMap.get(q.customerId);
    if(q.customerId&&!customer)issues.push(`Quote ${q.number||q.id} has a missing customer link.`);
    if(customer&&accountNumberForRecordV321(q)!==ensureAccountNumberV321(customer))issues.push(`Quote ${q.number||q.id} has an account mismatch.`);
  });
  getSavedInvoices().forEach(i=>{
    const customer=customerMap.get(i.customerId);
    if(i.customerId&&!customer)issues.push(`Invoice ${i.invoiceNumber||i.jobNumber||i.id} has a missing customer link.`);
    if(customer&&accountNumberForRecordV321(i)!==ensureAccountNumberV321(customer))issues.push(`Invoice ${i.invoiceNumber||i.jobNumber||i.id} has an account mismatch.`);
  });
  return issues;
}
function initializeDevelopmentReleaseV321B(){
  migrateAccountDataV321();
  showDevelopmentReminderV321B();
  const issues=verifyAccountLinkIntegrityV321B();
  if(issues.length)console.warn("Paradise v3.21B link verification:",issues);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(initializeDevelopmentReleaseV321B,500),{once:true});else setTimeout(initializeDevelopmentReleaseV321B,500);

/* v3.21B Complete Development Demo Suite */
const DEMO_SUITE_VERSION_V321B = "3.21B-complete-demo-1";
const DEMO_SUITE_PREFIX_V321B = "plc-demo-suite-";

function demoIsoAtV321B(dayOffset = 0, hour = 9, minute = 0) {
  const d = addDays(new Date(), dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function demoDateV321B(dayOffset = 0) { return getLocalDateString(addDays(new Date(), dayOffset)); }
function demoAddressV321B(street, city, zip) { return `${street}, ${city}, FL ${zip}`; }
function demoPropertyV321B(name, type, street, city, zip, extras = {}) {
  return {
    id: `${DEMO_SUITE_PREFIX_V321B}property-${String(extras.index || 1).padStart(3, "0")}`,
    name,
    propertyName: name,
    propertyType: type,
    type,
    address: demoAddressV321B(street, city, zip),
    serviceAddress: street,
    city,
    state: "FL",
    zip,
    mowingHeight: extras.mowingHeight || "3.5",
    gateCode: extras.gateCode || "",
    hoa: extras.hoa || "",
    warning: extras.warning || "",
    irrigation: extras.irrigation || "Avoid marked sprinkler heads.",
    notes: extras.notes || "Development demo property.",
    isDemo: true,
    demoSuiteVersion: DEMO_SUITE_VERSION_V321B
  };
}
function demoPaymentV321B(index) {
  return [
    ["cash", "Cash", "0"],
    ["business-check", "Business Check", "0"],
    ["zelle", "Zelle", "0"],
    ["ach", "ACH", "0"],
    ["credit-card", "Credit Card +3.5%", "3.5"]
  ][index % 5];
}
function demoInvoiceV321B({index, customer, property, quote, offset, status, amount, service, paymentIndex = 0, dueOffset = 14, readyToEmail = false}) {
  const payment = demoPaymentV321B(paymentIndex);
  const invoiceNumber = `INV-DEMO-${String(index).padStart(4, "0")}`;
  const invoiceDate = demoDateV321B(offset);
  return {
    id: `${DEMO_SUITE_PREFIX_V321B}invoice-${String(index).padStart(4, "0")}`,
    invoiceNumber,
    jobNumber: invoiceNumber,
    jobId: `${DEMO_SUITE_PREFIX_V321B}job-${String(index).padStart(4, "0")}`,
    accountNumber: customer.accountNumber,
    customerNumber: customer.accountNumber,
    customerId: customer.id,
    quoteId: quote?.id || "",
    invoiceDate,
    dueDate: demoDateV321B(offset + dueOffset),
    status,
    clientName: customer.name,
    businessName: customer.business || "",
    billingAddress: customer.billing,
    billingStreet: customer.billingStreet,
    billingCity: customer.billingCity,
    billingState: "FL",
    billingZip: customer.billingZip,
    cityStateZip: `${customer.billingCity}, FL ${customer.billingZip}`,
    phone: customer.phone,
    email: customer.email,
    preferredContact: customer.preferredContact,
    services: [{date: invoiceDate, address: property.address, service, amount}],
    taxRate: "0",
    taxLabel: "No Tax",
    paymentCode: payment[0],
    paymentMethod: payment[1],
    paymentRate: payment[2],
    subtotal: amount,
    total: payment[2] === "3.5" ? Number((amount * 1.035).toFixed(2)) : amount,
    frequency: quote?.frequency || "One Time",
    notes: `Complete demo invoice for ${property.name}.`,
    readyToEmail,
    isDemo: true,
    demoSuiteVersion: DEMO_SUITE_VERSION_V321B,
    createdAt: demoIsoAtV321B(offset, 10),
    updatedAt: demoIsoAtV321B(offset, 10)
  };
}

function installCompleteDemoSuiteV321B() {
  const existingDemo = readArray(CUSTOMER_STORAGE_KEY).some(x => x.demoSuiteVersion === DEMO_SUITE_VERSION_V321B) ||
    getSavedInvoices().some(x => x.demoSuiteVersion === DEMO_SUITE_VERSION_V321B);
  if (existingDemo) {
    alert("The Complete Development Demo Suite is already installed.");
    return;
  }

  const customerSpecs = [
    {name:"Elena Ramirez",business:"",phone:"(772) 555-0201",email:"elena.ramirez@example.com",preferredContact:"Text",street:"1425 SW Palm City Rd",city:"Stuart",zip:"34994",billingMethod:"Per Service",properties:[
      ["Ramirez Residence","Residential","1425 SW Palm City Rd","Stuart","34994",{warning:"Friendly dog in fenced rear yard."}]
    ]},
    {name:"David Coleman",business:"Coleman Rental Homes",phone:"(772) 555-0202",email:"david@colemanrentals.example.com",preferredContact:"Email",street:"418 SE Martin Ave",city:"Stuart",zip:"34994",billingMethod:"Monthly",properties:[
      ["Coleman Home","Residential","418 SE Martin Ave","Stuart","34994",{}],
      ["Palm Lake Rental","Residential","903 NW Palm Lake Dr","Stuart","34994",{mowingHeight:"4.0"}],
      ["Jensen Rental","Residential","1760 NE Jensen Beach Blvd","Jensen Beach","34957",{gateCode:"7712"}]
    ]},
    {name:"Monica Hayes",business:"Harbor Pines HOA",phone:"(772) 555-0203",email:"manager@harborpineshoa.example.com",preferredContact:"Email",street:"2100 SE Ocean Blvd",city:"Stuart",zip:"34996",billingMethod:"Monthly",properties:[
      ["Harbor Pines Common Areas","HOA","2100 SE Ocean Blvd","Stuart","34996",{gateCode:"2468",hoa:"Service weekdays 9:00 AM-3:00 PM. No blowers before 9:00 AM.",mowingHeight:"3.5"}]
    ]},
    {name:"Terrence Brooks",business:"Treasure Coast Medical Plaza",phone:"(772) 555-0204",email:"facilities@tcmedicalplaza.example.com",preferredContact:"Phone",street:"3201 SE Federal Hwy",city:"Stuart",zip:"34997",billingMethod:"Bi-Weekly",properties:[
      ["Medical Plaza","Commercial","3201 SE Federal Hwy","Stuart","34997",{notes:"Keep emergency drive clear at all times."}]
    ]},
    {name:"Alicia Morgan",business:"",phone:"(772) 555-0205",email:"alicia.morgan@example.com",preferredContact:"Text",street:"785 NW Sunset Dr",city:"Stuart",zip:"34994",billingMethod:"Per Service",properties:[
      ["Morgan Residence","Residential","785 NW Sunset Dr","Stuart","34994",{}]
    ]},
    {name:"Brandon Ellis",business:"Ellis Coastal Properties",phone:"(772) 555-0206",email:"brandon@elliscoastal.example.com",preferredContact:"Email",street:"601 NE Ocean Blvd",city:"Stuart",zip:"34996",billingMethod:"Monthly",properties:[
      ["Ocean Office","Commercial","601 NE Ocean Blvd","Stuart","34996",{}],
      ["Beach Rental","Residential","1125 NE Ocean Blvd","Stuart","34996",{gateCode:"8844"}]
    ]},
    {name:"Sophia Nguyen",business:"",phone:"(772) 555-0207",email:"sophia.nguyen@example.com",preferredContact:"Email",street:"1555 SW Saint Lucie Cres",city:"Stuart",zip:"34994",billingMethod:"Per Service",properties:[
      ["Nguyen Residence","Residential","1555 SW Saint Lucie Cres","Stuart","34994",{mowingHeight:"4.5"}]
    ]},
    {name:"Marcus Reed",business:"Riverwalk Coffee Company",phone:"(772) 555-0208",email:"operations@riverwalkcoffee.example.com",preferredContact:"Phone",street:"38 SW Osceola St",city:"Stuart",zip:"34994",billingMethod:"Monthly",properties:[
      ["Downtown Cafe","Commercial","38 SW Osceola St","Stuart","34994",{}],
      ["Roasting Warehouse","Commercial","4600 SE Commerce Ave","Stuart","34997",{}]
    ]},
    {name:"Janet Price",business:"Sunset Bay HOA",phone:"(772) 555-0209",email:"janet.price@sunsetbayhoa.example.com",preferredContact:"Email",street:"1800 NW Federal Hwy",city:"Stuart",zip:"34994",billingMethod:"Monthly",properties:[
      ["Sunset Bay Entrance","HOA","1800 NW Federal Hwy","Stuart","34994",{hoa:"Mow Tuesday or Wednesday only.",gateCode:"1357"}],
      ["Sunset Bay Clubhouse","HOA","1820 NW Federal Hwy","Stuart","34994",{hoa:"No power equipment during community events."}]
    ]},
    {name:"Oscar Bennett",business:"",phone:"(772) 555-0210",email:"oscar.bennett@example.com",preferredContact:"Phone",street:"2700 SW Monarch Trl",city:"Palm City",zip:"34990",billingMethod:"Bi-Weekly",properties:[
      ["Bennett Residence","Residential","2700 SW Monarch Trl","Palm City","34990",{warning:"Pool gate must remain closed."}]
    ]},
    {name:"Priya Shah",business:"Shah Family Rentals",phone:"(772) 555-0211",email:"priya@shahfamilyrentals.example.com",preferredContact:"Text",street:"1201 SE Indian St",city:"Stuart",zip:"34997",billingMethod:"Monthly",properties:[
      ["Indian Street Duplex","Residential","1201 SE Indian St","Stuart","34997",{}],
      ["Kanner Highway Rental","Residential","4400 SW Kanner Hwy","Stuart","34997",{}]
    ]},
    {name:"Caleb Foster",business:"Foster Marine Services",phone:"(772) 555-0212",email:"caleb@fostermarine.example.com",preferredContact:"Email",street:"1001 SE Monterey Rd",city:"Stuart",zip:"34994",billingMethod:"Monthly",properties:[
      ["Marine Service Yard","Commercial","1001 SE Monterey Rd","Stuart","34994",{notes:"Avoid customer boats and trailers."}]
    ]},
    {name:"John Smith",business:"",phone:"(772) 555-0213",email:"john.smith.one@example.com",preferredContact:"Phone",street:"620 SW Camden Ave",city:"Stuart",zip:"34994",billingMethod:"Per Service",properties:[
      ["Smith Residence","Residential","620 SW Camden Ave","Stuart","34994",{}]
    ]},
    {name:"John Smith",business:"Smith Investment Homes",phone:"(772) 555-0214",email:"john.smith.rentals@example.com",preferredContact:"Email",street:"811 SE Dixie Hwy",city:"Stuart",zip:"34994",billingMethod:"Monthly",properties:[
      ["Dixie Highway Rental","Residential","811 SE Dixie Hwy","Stuart","34994",{}]
    ]},
    {name:"Grace Turner",business:"",phone:"(772) 555-0215",email:"grace.turner.long.email.address@examplemailcompany.com",preferredContact:"Email",street:"2010 NW Pine Lake Dr",city:"Stuart",zip:"34994",billingMethod:"Per Service",properties:[
      ["Turner Residence","Residential","2010 NW Pine Lake Dr","Stuart","34994",{}]
    ]}
  ];

  const customers = readArray(CUSTOMER_STORAGE_KEY);
  const quotes = readArray(QUOTE_STORAGE_KEY);
  const invoices = getSavedInvoices();
  const schedule = getScheduleData();
  const demoCustomers = [];
  let propertyCounter = 0;

  customerSpecs.forEach((spec, i) => {
    const accountNumber = `PLC-DEMO-${String(i + 1).padStart(4, "0")}`;
    const customer = {
      id: `${DEMO_SUITE_PREFIX_V321B}customer-${String(i + 1).padStart(3, "0")}`,
      accountNumber,
      customerNumber: accountNumber,
      name: spec.name,
      business: spec.business,
      phone: spec.phone,
      email: spec.email,
      preferredContact: spec.preferredContact,
      billing: demoAddressV321B(spec.street, spec.city, spec.zip),
      billingStreet: spec.street,
      billingCity: spec.city,
      billingState: "FL",
      billingZip: spec.zip,
      billingMethod: spec.billingMethod,
      billingAnchor: demoDateV321B(-60),
      notes: `Complete Development Demo Suite account. Tests ${spec.properties.length > 1 ? "multiple properties" : "single property"}.`,
      properties: spec.properties.map(p => demoPropertyV321B(p[0], p[1], p[2], p[3], p[4], {...p[5], index: ++propertyCounter})),
      isDemo: true,
      demoSuiteVersion: DEMO_SUITE_VERSION_V321B,
      createdAt: demoIsoAtV321B(-90 + i),
      updatedAt: demoIsoAtV321B(-1)
    };
    customers.push(customer);
    demoCustomers.push(customer);
  });

  let quoteIndex = 1;
  let invoiceIndex = 1;
  const quoteStatuses = ["Accepted", "Pending", "Declined", "Converted", "Draft"];
  const frequencies = ["Weekly", "Bi-Weekly", "Monthly", "One Time", "Seasonal"];
  const services = ["Full Service", "Hedge Trim", "Debris Removal", "Weed Control", "Mulch Installation", "Leaf Cleanup"];
  const invoiceStatuses = ["Paid", "Unpaid", "Overdue", "Ready to Email", "Draft"];
  const demoQuotes = [];
  const demoInvoices = [];

  demoCustomers.forEach((customer, customerIndex) => {
    customer.properties.forEach((property, propertyIndex) => {
      const quoteNumber = `Q-DEMO-${String(quoteIndex).padStart(4, "0")}`;
      const quote = {
        id: `${DEMO_SUITE_PREFIX_V321B}quote-${String(quoteIndex).padStart(4, "0")}`,
        number: quoteNumber,
        quoteNumber,
        jobId: `${DEMO_SUITE_PREFIX_V321B}quote-job-${String(quoteIndex).padStart(4, "0")}`,
        customerId: customer.id,
        accountNumber: customer.accountNumber,
        customerNumber: customer.accountNumber,
        customerName: customer.name,
        businessName: customer.business,
        property,
        phone: customer.phone,
        email: customer.email,
        preferredContact: customer.preferredContact,
        date: demoDateV321B(-35 + quoteIndex),
        validThrough: demoDateV321B(-5 + quoteIndex),
        status: quoteStatuses[(quoteIndex - 1) % quoteStatuses.length],
        scope: `${services[(quoteIndex - 1) % services.length]} at ${property.name}. Includes mowing, edging, trimming, and cleanup as applicable.`,
        amount: 65 + (quoteIndex * 12),
        frequency: frequencies[(quoteIndex - 1) % frequencies.length],
        notes: "Complete demo quote for conversion, status, and account-link testing.",
        isDemo: true,
        demoSuiteVersion: DEMO_SUITE_VERSION_V321B
      };
      quotes.push(quote);
      demoQuotes.push(quote);
      quoteIndex += 1;

      const invoiceCount = customerIndex < 5 ? 2 : 1;
      for (let n = 0; n < invoiceCount; n += 1) {
        const status = invoiceStatuses[(invoiceIndex - 1) % invoiceStatuses.length];
        const offset = status === "Overdue" ? -45 : status === "Paid" ? -20 - n * 14 : -5 + n * 7;
        const invoice = demoInvoiceV321B({
          index: invoiceIndex,
          customer,
          property,
          quote,
          offset,
          status,
          amount: Number(quote.amount) + n * 15,
          service: services[(invoiceIndex - 1) % services.length],
          paymentIndex: invoiceIndex - 1,
          dueOffset: status === "Overdue" ? 14 : 15,
          readyToEmail: status === "Ready to Email"
        });
        invoices.push(invoice);
        demoInvoices.push(invoice);
        invoiceIndex += 1;
      }
    });
  });

  const schedulePatterns = [
    {offset:0,hour:8,status:"Scheduled"}, {offset:0,hour:9,status:"Assigned"}, {offset:0,hour:10,status:"In Progress"},
    {offset:0,hour:11,status:"Completed"}, {offset:1,hour:8,status:"Scheduled"}, {offset:1,hour:9,status:"Scheduled"},
    {offset:2,hour:8,status:"Assigned"}, {offset:3,hour:10,status:"Scheduled"}, {offset:4,hour:9,status:"Scheduled"},
    {offset:5,hour:8,status:"Cancelled"}, {offset:6,hour:11,status:"Scheduled"}, {offset:7,hour:8,status:"Scheduled"},
    {offset:14,hour:9,status:"Scheduled"}, {offset:30,hour:8,status:"Scheduled"}, {offset:-1,hour:8,status:"Scheduled"}
  ];
  schedulePatterns.forEach((pattern, i) => {
    const invoice = demoInvoices[i % demoInvoices.length];
    const customer = demoCustomers.find(c => c.id === invoice.customerId);
    const key = scheduleRecordKey(addDays(new Date(), pattern.offset), pattern.hour, i % 2 ? 30 : 0);
    schedule[key] = {
      recordType: "Invoice",
      workStatus: pattern.status,
      jobNumber: invoice.invoiceNumber,
      customer: customer.name,
      service: invoice.services[0].service,
      recordId: invoice.id,
      jobId: invoice.jobId,
      customerId: customer.id,
      customerNumber: customer.accountNumber,
      accountNumber: customer.accountNumber,
      isDemo: true,
      demoSuiteVersion: DEMO_SUITE_VERSION_V321B,
      completedAt: pattern.status === "Completed" ? demoIsoAtV321B(pattern.offset, pattern.hour + 1) : "",
      billingInvoiceId: pattern.status === "Completed" ? invoice.id : ""
    };
  });

  const employees = readArray(EMPLOYEE_STORAGE_KEY);
  [
    ["Mateo Rivera","Active","(772) 555-0301",24,"Mowing, edging, hedge trimming","Zero-Turn #1"],
    ["Kayla Bennett","Active","(772) 555-0302",22,"Detail work, customer service","Truck #2"],
    ["Andre Lewis","Vacation","(772) 555-0303",23,"Commercial properties, maintenance","Trailer #1"],
    ["Noah Grant","Unavailable","(772) 555-0304",20,"Cleanup, inventory","String Trimmers"]
  ].forEach((e, i) => employees.push({id:`${DEMO_SUITE_PREFIX_V321B}employee-${i+1}`,name:e[0],status:e[1],phone:e[2],payRate:e[3],emergency:"Demo Emergency Contact",skills:e[4],equipment:e[5],notes:"Demo employee record.",isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const payroll = readArray(PAYROLL_STORAGE_KEY);
  employees.filter(e => e.demoSuiteVersion === DEMO_SUITE_VERSION_V321B).slice(0,3).forEach((e, i) => payroll.push({id:`${DEMO_SUITE_PREFIX_V321B}payroll-${i+1}`,date:demoDateV321B(-7+i),employeeId:e.id,employeeName:e.name,hours:32+i*4,amount:(32+i*4)*e.payRate,isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const expenses = readArray(EXPENSE_STORAGE_KEY);
  [
    ["Fuel","Truck fuel","Shell",186.42], ["Supplies","Trimmer line and blades","Landscape Supply",143.80],
    ["Repairs","Zero-turn tire repair","Mower Shop",96.00], ["Insurance","Monthly liability premium","Insurance Carrier",325.00]
  ].forEach((x,i)=>expenses.push({id:`${DEMO_SUITE_PREFIX_V321B}expense-${i+1}`,date:demoDateV321B(-12+i*3),category:x[0],description:x[1],equipment:"",vendor:x[2],quantity:1,unitPrice:x[3],total:x[3],payment:i%2?"Credit Card":"Business Check",reference:`DEMO-${i+1}`,notes:"Demo operating expense.",isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const inventory = readArray(INVENTORY_STORAGE_KEY);
  [
    ["Commercial Trimmer Line","Supplies",1,3,"spools",29.99],
    ["Selective Herbicide","Chemicals",0,2,"gallons",54.50],
    ["Mower Blades - 54 inch","Parts",6,2,"each",24.00],
    ["2-Cycle Oil","Supplies",8,3,"bottles",6.75],
    ["Safety Glasses","Safety",2,4,"each",8.25]
  ].forEach((x,i)=>inventory.push({id:`${DEMO_SUITE_PREFIX_V321B}inventory-${i+1}`,name:x[0],category:x[1],quantity:x[2],reorderAt:x[3],unit:x[4],cost:x[5],isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const maintenance = getMaintenanceData();
  maintenance[`${DEMO_SUITE_PREFIX_V321B}equipment-zero-turn`] = {name:"ZT-DEMO-1",model:"Demo 54-inch Zero Turn",serial:"DEMO-ZT-001",currentReading:"248 hours",oilInterval:"50",bladeInterval:"20",isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B,records:[
    {date:demoDateV321B(-30),task:"Oil Change",subtype:"Engine Oil & Filter",reading:"220 hours",description:"Completed oil and filter service.",cost:"48.00",status:"Completed",isDemo:true},
    {date:demoDateV321B(-2),task:"Broken Item Repair",subtype:"Belt / Pulley",reading:"248 hours",description:"Deck belt slipping; repair open.",cost:"",status:"Repair Open",isDemo:true}
  ]};
  maintenance[`${DEMO_SUITE_PREFIX_V321B}equipment-trailer`] = {name:"TR-DEMO-1",model:"Demo 16-foot Trailer",serial:"DEMO-TR-001",currentReading:"",oilInterval:"",bladeInterval:"",isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B,records:[
    {date:demoDateV321B(-15),task:"Inspection",subtype:"Tires / Lights",reading:"",description:"Lights verified; left tire due for replacement.",cost:"25.00",status:"Completed",isDemo:true}
  ]};

  const calendar = readArray(MAINT_CALENDAR_KEY);
  [
    {id:`${DEMO_SUITE_PREFIX_V321B}maintcal-1`,date:demoDateV321B(-1),equipment:"ZT-DEMO-1",task:"Broken Item Repair",status:"Waiting for Parts",notes:"Overdue deck belt replacement."},
    {id:`${DEMO_SUITE_PREFIX_V321B}maintcal-2`,date:demoDateV321B(2),equipment:"TR-DEMO-1",task:"Inspection",status:"Scheduled",notes:"Replace left trailer tire."},
    {id:`${DEMO_SUITE_PREFIX_V321B}maintcal-3`,date:demoDateV321B(14),equipment:"Truck-DEMO-1",task:"Oil Change",status:"Scheduled",notes:"Regular service appointment."},
    {id:`${DEMO_SUITE_PREFIX_V321B}maintcal-4`,date:demoDateV321B(-5),equipment:"String Trimmer-DEMO",task:"Cleaning",status:"Verified",notes:"Completed and verified."}
  ].forEach(x=>calendar.push({...x,isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const templates = readArray(COMMUNICATION_USER_TEMPLATES_KEY_V321);
  [
    ["Rain Delay","Weather Delay","Due to weather, your lawn service has been rescheduled. We will confirm the new service date shortly."],
    ["Invoice Reminder","Invoice Reminder","This is a friendly reminder that your Paradise Lawn Care invoice is due. Please contact us with any questions."],
    ["Service Complete","Service Completed","Your scheduled lawn service has been completed. Thank you for choosing Paradise Lawn Care."],
    ["HOA Access","HOA Access Reminder","Please confirm gate access and any updated HOA service restrictions before our scheduled visit."]
  ].forEach((x,i)=>templates.push({id:`${DEMO_SUITE_PREFIX_V321B}template-${i+1}`,name:x[0],subject:x[1],body:x[2],createdAt:demoIsoAtV321B(-10+i),isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  const history = activityHistoryV320();
  [
    ["Invoice","Payment received","Elena Ramirez paid INV-DEMO-0001 by Cash.","green","invoice",`${DEMO_SUITE_PREFIX_V321B}invoice-0001`],
    ["Communication","Service completed message sent","Text sent to Alicia Morgan.","green","customer",`${DEMO_SUITE_PREFIX_V321B}customer-005`],
    ["Schedule","Route completed","Four demo properties completed.","green","schedule",""],
    ["Maintenance","Maintenance completed","ZT-DEMO-1 oil service recorded.","green","maintenance",`${DEMO_SUITE_PREFIX_V321B}equipment-zero-turn`],
    ["Inventory","Inventory replenished","2-cycle oil restocked.","green","inventory",`${DEMO_SUITE_PREFIX_V321B}inventory-4`],
    ["Invoice","Overdue reminder created","Demo overdue invoice requires follow-up.","red","invoice",`${DEMO_SUITE_PREFIX_V321B}invoice-0003`],
    ["Quote","Quote accepted","Harbor Pines HOA accepted recurring service quote.","green","quote",`${DEMO_SUITE_PREFIX_V321B}quote-0005`]
  ].forEach((x,i)=>history.push({id:`${DEMO_SUITE_PREFIX_V321B}history-${i+1}`,timestamp:demoIsoAtV321B(-i,9+i),category:x[0],title:x[1],detail:x[2],severity:x[3],recordType:x[4],recordId:x[5],sourceKey:`${DEMO_SUITE_PREFIX_V321B}history-source-${i+1}`,isDemo:true,demoSuiteVersion:DEMO_SUITE_VERSION_V321B}));

  writeArray(CUSTOMER_STORAGE_KEY, customers);
  writeArray(QUOTE_STORAGE_KEY, quotes);
  storeInvoices(invoices);
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  writeArray(EMPLOYEE_STORAGE_KEY, employees);
  writeArray(PAYROLL_STORAGE_KEY, payroll);
  writeArray(EXPENSE_STORAGE_KEY, expenses);
  writeArray(INVENTORY_STORAGE_KEY, inventory);
  localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(maintenance));
  writeArray(MAINT_CALENDAR_KEY, calendar);
  writeArray(COMMUNICATION_USER_TEMPLATES_KEY_V321, templates);
  saveActivityHistoryV320(history);
  localStorage.setItem("paradise_complete_demo_suite_version", DEMO_SUITE_VERSION_V321B);

  renderCustomerList();
  populateCustomerSelectors();
  renderQuotes();
  renderInvoiceList();
  renderSchedule();
  renderCommunicationRecipients();
  populateCommunicationTemplatesV321();
  renderEmployees();
  populateEmployeeSelectors();
  renderOperatingExpenses();
  renderInventory();
  renderMaintenanceRecords();
  renderMaintenanceCalendar();
  renderActivityHistoryV320();
  refreshHomeDashboard();
  alert(`Complete Development Demo Suite installed:\n${demoCustomers.length} accounts, ${propertyCounter} properties, ${demoQuotes.length} quotes, ${demoInvoices.length} invoices, schedules, employees, expenses, inventory, maintenance, communications, alerts, and history.`);
}

function deleteCompleteDemoSuiteV321B() {
  const hasDemo = readArray(CUSTOMER_STORAGE_KEY).some(x => x.demoSuiteVersion === DEMO_SUITE_VERSION_V321B) ||
    getSavedInvoices().some(x => x.demoSuiteVersion === DEMO_SUITE_VERSION_V321B);
  if (!hasDemo) {
    alert("The Complete Development Demo Suite is not installed.");
    return;
  }
  if (!confirm("Delete the Complete Development Demo Suite? Only demo-marked records will be removed. Real records will remain unchanged.")) return;

  const keepNonDemo = list => list.filter(x => x?.demoSuiteVersion !== DEMO_SUITE_VERSION_V321B && !String(x?.id || "").startsWith(DEMO_SUITE_PREFIX_V321B));
  writeArray(CUSTOMER_STORAGE_KEY, keepNonDemo(readArray(CUSTOMER_STORAGE_KEY)));
  writeArray(QUOTE_STORAGE_KEY, keepNonDemo(readArray(QUOTE_STORAGE_KEY)));
  storeInvoices(keepNonDemo(getSavedInvoices()));
  writeArray(EMPLOYEE_STORAGE_KEY, keepNonDemo(readArray(EMPLOYEE_STORAGE_KEY)));
  writeArray(PAYROLL_STORAGE_KEY, keepNonDemo(readArray(PAYROLL_STORAGE_KEY)));
  writeArray(EXPENSE_STORAGE_KEY, keepNonDemo(readArray(EXPENSE_STORAGE_KEY)));
  writeArray(INVENTORY_STORAGE_KEY, keepNonDemo(readArray(INVENTORY_STORAGE_KEY)));
  writeArray(MAINT_CALENDAR_KEY, keepNonDemo(readArray(MAINT_CALENDAR_KEY)));
  writeArray(COMMUNICATION_USER_TEMPLATES_KEY_V321, keepNonDemo(readArray(COMMUNICATION_USER_TEMPLATES_KEY_V321)));
  saveActivityHistoryV320(keepNonDemo(activityHistoryV320()));

  const schedule = getScheduleData();
  Object.keys(schedule).forEach(key => {
    const item = schedule[key];
    if (item?.demoSuiteVersion === DEMO_SUITE_VERSION_V321B || String(item?.recordId || "").startsWith(DEMO_SUITE_PREFIX_V321B) || String(item?.customerId || "").startsWith(DEMO_SUITE_PREFIX_V321B)) delete schedule[key];
  });
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));

  const maintenance = getMaintenanceData();
  Object.keys(maintenance).forEach(key => {
    const item = maintenance[key];
    if (item?.demoSuiteVersion === DEMO_SUITE_VERSION_V321B || String(key).startsWith(DEMO_SUITE_PREFIX_V321B)) delete maintenance[key];
  });
  localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(maintenance));
  localStorage.removeItem("paradise_complete_demo_suite_version");

  renderCustomerList();
  populateCustomerSelectors();
  renderQuotes();
  renderInvoiceList();
  renderSchedule();
  renderCommunicationRecipients();
  populateCommunicationTemplatesV321();
  renderEmployees();
  populateEmployeeSelectors();
  renderOperatingExpenses();
  renderInventory();
  renderMaintenanceRecords();
  renderMaintenanceCalendar();
  renderActivityHistoryV320();
  refreshHomeDashboard();
  alert("Complete Development Demo Suite deleted. Real records were not changed.");
}

installDemoInvoices = installCompleteDemoSuiteV321B;
deleteDemoInvoices = deleteCompleteDemoSuiteV321B;


/* v3.21B Development Candidate 3 - invoice, contact, and scheduling refinements */
function formatTelephoneV321C(value){
  let digits=String(value||"").replace(/\D/g,"").slice(0,11);
  if(digits.length===11&&digits.startsWith("1")){
    const p=digits.slice(1);
    return p.length<10?`1 ${p}`:`1 (${p.slice(0,3)}) ${p.slice(3,6)}-${p.slice(6)}`;
  }
  if(digits.length<=3)return digits;
  if(digits.length<=6)return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}
function bindTelephoneFormattingV321C(root=document){
  root.querySelectorAll('input[type="tel"],input[inputmode="tel"]').forEach(input=>{
    if(input.dataset.phoneFormatBound==="true")return;
    input.dataset.phoneFormatBound="true";
    input.addEventListener("input",()=>{const start=input.selectionStart||input.value.length;const old=input.value;input.value=formatTelephoneV321C(input.value);const delta=input.value.length-old.length;try{input.setSelectionRange(Math.max(0,start+delta),Math.max(0,start+delta));}catch(_){}});
    input.addEventListener("blur",()=>{input.value=formatTelephoneV321C(input.value);});
    if(input.value)input.value=formatTelephoneV321C(input.value);
  });
}
function numericAccountNumberV321C(value){
  const groups=String(value||"").match(/\d+/g)||[];
  const last=groups.at(-1)||"";
  return last?last.padStart(6,"0"):"—";
}
const collectInvoiceV321CBase=collectInvoice;
collectInvoice=function(){
  const invoice=collectInvoiceV321CBase();
  invoice.paymentLink=byId("invoicePaymentLink")?.value.trim()||"";
  return invoice;
};
const clearInvoiceFieldsV321CBase=clearInvoiceFields;
clearInvoiceFields=function(){clearInvoiceFieldsV321CBase();if(byId("invoicePaymentLink"))byId("invoicePaymentLink").value="";};
const loadInvoiceV321CBase=loadInvoice;
loadInvoice=function(invoiceId){
  const result=loadInvoiceV321CBase(invoiceId);
  const invoice=getSavedInvoices().find(item=>item.id===invoiceId);
  if(byId("invoicePaymentLink"))byId("invoicePaymentLink").value=invoice?.paymentLink||"";
  bindTelephoneFormattingV321C();
  return result;
};
function blobToDataUrlV321C(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
async function appendInvoicePhotosToPdfV321C(invoice){
  const preview=byId("pdfPreview");if(!preview||!invoice?.id)return;
  preview.querySelector(".pdf-photo-section-v321c")?.remove();
  let files=[];try{files=await dbGetAttachments(`invoice:${invoice.id}`);}catch(error){console.warn("Unable to read invoice photos for PDF",error);return;}
  const images=files.filter(file=>file.type?.startsWith("image/")&&["invoice-before-photo","invoice-after-photo","invoice-photo","damage-photo"].includes(file.kind));
  if(!images.length)return;
  const groups=[
    ["Before Photos",images.filter(x=>x.kind==="invoice-before-photo")],
    ["After Photos",images.filter(x=>x.kind==="invoice-after-photo")],
    ["Additional Property Photos",images.filter(x=>x.kind==="invoice-photo"||x.kind==="damage-photo")]
  ].filter(([,items])=>items.length);
  const section=document.createElement("section");section.className="pdf-photo-section-v321c";
  section.innerHTML='<h2>Property Photos</h2>';
  for(const [title,items] of groups){
    const group=document.createElement("div");group.className="pdf-photo-group-v321c";group.innerHTML=`<h3>${escapeHtml(title)}</h3>`;
    const grid=document.createElement("div");grid.className="pdf-photo-grid-v321c";
    for(const file of items){const figure=document.createElement("figure");const img=document.createElement("img");img.alt=file.name||title;try{img.src=await blobToDataUrlV321C(file.blob);}catch(_){continue;}const caption=document.createElement("figcaption");caption.textContent=file.name||title;figure.append(img,caption);grid.appendChild(figure);}
    group.appendChild(grid);section.appendChild(group);
  }
  preview.appendChild(section);
}
const viewInvoicePdfV321CBase=viewInvoicePdf;
viewInvoicePdf=async function(){
  const result=await viewInvoicePdfV321CBase();
  const invoice=activeInvoiceId?getSavedInvoices().find(x=>x.id===activeInvoiceId):collectInvoice();
  const total=byId("pdfPreview")?.querySelector(".pdf-total");
  if(total&&invoice?.paymentLink&&!total.querySelector(".pdf-payment-link-v321c"))total.insertAdjacentHTML("beforeend",`<p class="pdf-payment-link-v321c"><strong>Payment Link:</strong> ${escapeHtml(invoice.paymentLink)}</p>`);
  await appendInvoicePhotosToPdfV321C(invoice);
  return result;
};
function normalizeScheduleEmployeeOptionsV321C(){
  document.querySelectorAll(".sched-type").forEach(select=>{
    const current=select.value==="RS"?"E1":select.value||"BP";
    select.innerHTML=['BP','E1','E2','E3'].map(v=>`<option value="${v}" ${v===current?'selected':''}>${v}</option>`).join('');
  });
}
function openActiveScheduleRecordV321C(){
  const record=activeScheduleDetailsV319?.record;if(!record)return;
  if(record.recordType==="Invoice"){switchTab("invoiceTab");loadInvoice(record.recordId);}
  else if(record.recordType==="Quote"){switchTab("quotesTab");loadQuote(record.recordId);}
}
const renderScheduleV321CBase=renderSchedule;
renderSchedule=function(){const result=renderScheduleV321CBase();normalizeScheduleEmployeeOptionsV321C();document.querySelectorAll(".sched-job").forEach(input=>{input.classList.toggle("has-job",Boolean(input.value));input.title=input.value?"Open this scheduled record":"No job selected";input.addEventListener("click",()=>{if(!input.value)return;const slot=input.closest(".schedule-slot");const type=slot?.querySelector(".sched-record-type")?.value;const id=slot?.dataset.recordId;if(type==="Invoice"&&id){switchTab("invoiceTab");loadInvoice(id);}else if(type==="Quote"&&id){switchTab("quotesTab");loadQuote(id);}});});return result;};
const showScheduleCustomerCardV321CBase=showScheduleCustomerCardV36;
showScheduleCustomerCardV36=function(r,slotKey){const result=showScheduleCustomerCardV321CBase(r,slotKey);if(byId("scheduleSelectedCustomerId"))byId("scheduleSelectedCustomerId").textContent=numericAccountNumberV321C(r.customerNumber||activeScheduleDetailsV319?.customer?.customerNumber);const customerField=byId("scheduleSelectedCustomer");if(customerField){customerField.classList.toggle("schedule-record-link",Boolean(r.recordId));customerField.title=r.recordType?`Open ${r.recordType.toLowerCase()}`:"";customerField.onclick=openActiveScheduleRecordV321C;}return result;};
function initializeCandidate3V321C(){
  bindTelephoneFormattingV321C();
  byId("invoiceBeforePhotoInput")?.addEventListener("change",event=>handleAttachmentFiles(event.target.files,"invoice-before-photo"));
  byId("invoiceAfterPhotoInput")?.addEventListener("change",event=>handleAttachmentFiles(event.target.files,"invoice-after-photo"));
  const observer=new MutationObserver(()=>bindTelephoneFormattingV321C());observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeCandidate3V321C);else initializeCandidate3V321C();
