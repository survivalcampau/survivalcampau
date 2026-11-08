// Waitlist page: fills in the app name, runs the sign-up form and the share button.
// Settings come from config.js.
(function () {
  "use strict";

  const NAME = typeof SITE_NAME === "string" ? SITE_NAME : "";
  const EMAIL = typeof CONTACT_EMAIL === "string" ? CONTACT_EMAIL : "";
  const HOME = typeof SITE_URL === "string" ? SITE_URL : "";
  const ENDPOINT = typeof APPS_SCRIPT_URL === "string" ? APPS_SCRIPT_URL.trim() : "";
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/; // keep in step with apps-script/Code.gs
  const POSTCODE_RE = /^\d{4}$/;
  const TIMEOUT_MS = 15000;
  const loadedAt = Date.now();

  // ---------- Name, contact email, year ----------

  if (NAME) {
    document.querySelectorAll("[data-site-name]").forEach((el) => { el.textContent = NAME; });
  }
  if (EMAIL) {
    document.querySelectorAll("[data-contact-email]").forEach((link) => {
      link.href = "mailto:" + EMAIL;
      link.textContent = EMAIL;
    });
  }
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // ---------- Skill tree: keyboard-scrollable only when it overflows ----------

  const tree = document.querySelector(".tree-scroll");
  if (tree) {
    const updateTree = () => {
      if (tree.scrollWidth > tree.clientWidth + 1) tree.setAttribute("tabindex", "0");
      else tree.removeAttribute("tabindex");
    };
    updateTree();
    window.addEventListener("resize", updateTree);
    if (document.fonts) document.fonts.ready.then(updateTree);
  }

  // ---------- Sign-up form ----------

  const form = document.getElementById("waitlist-form");
  if (!form) return;

  const els = form.elements;
  const emailInput = els.email;
  const postcodeInput = els.postcode;
  const alertBox = document.getElementById("form-alert");
  const submitBtn = document.getElementById("submit-btn");
  const submitLabel = submitBtn.querySelector(".btn-label");
  const success = document.getElementById("signup-success");
  const params = new URLSearchParams(location.search);
  const demo = params.has("demo-signup"); // ?demo-signup previews the flow without sending anything
  let sending = false;

  // Hidden fields
  els.form_loaded_at.value = new Date(loadedAt).toISOString();
  ["utm_source", "utm_medium", "utm_campaign"].forEach((key) => {
    els[key].value = (params.get(key) || "").slice(0, 100);
  });
  els.referrer.value = document.referrer.slice(0, 300);

  function emailProblem() {
    const value = emailInput.value.trim();
    if (!value) return "Enter your email so we can let you know.";
    if (value.length > 254 || !EMAIL_RE.test(value)) return "That email doesn't look right. Check for typos.";
    return "";
  }

  function postcodeProblem() {
    const value = postcodeInput.value.trim();
    if (value && !POSTCODE_RE.test(value)) return "Australian postcodes are 4 digits.";
    return "";
  }

  function setError(input, message) {
    document.getElementById(input.id + "-error").textContent = message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  // Check a field when the person leaves it, then re-check as they fix it
  [[emailInput, emailProblem], [postcodeInput, postcodeProblem]].forEach(([input, check]) => {
    input.addEventListener("blur", () => { if (input.value.trim()) setError(input, check()); });
    input.addEventListener("input", () => { if (input.hasAttribute("aria-invalid")) setError(input, check()); });
  });

  function showAlert(message, offerEmail) {
    const parts = message ? [message] : [];
    if (message && offerEmail && EMAIL) {
      const link = document.createElement("a");
      link.href = "mailto:" + EMAIL;
      link.textContent = EMAIL;
      parts.push(" You can also email ", link, " to join.");
    }
    alertBox.replaceChildren(...parts);
  }

  function setLoading(on) {
    sending = on;
    form.setAttribute("aria-busy", String(on));
    submitBtn.classList.toggle("is-loading", on);
    if (on) submitBtn.setAttribute("aria-disabled", "true");
    else submitBtn.removeAttribute("aria-disabled");
    submitLabel.textContent = on ? "Joining…" : "Join the waitlist";
  }

  function buildPayload() {
    const data = new FormData(form);
    const body = new URLSearchParams();
    body.set("first_name", String(data.get("first_name") || "").trim());
    body.set("email", String(data.get("email") || "").trim());
    body.set("skills", data.getAll("skills").join(", "));
    body.set("field_days", String(data.get("field_days") || ""));
    body.set("postcode", String(data.get("postcode") || "").trim());
    ["website", "form_loaded_at", "utm_source", "utm_medium", "utm_campaign", "referrer"].forEach((key) => {
      body.set(key, String(data.get(key) || ""));
    });
    body.set("seconds_on_page", String(Math.round((Date.now() - loadedAt) / 1000)));
    return body;
  }

  async function send(body) {
    // A form-encoded POST counts as a "simple" cross-origin request, so the browser skips the
    // CORS preflight that Apps Script can't answer. Google's JSON reply is still readable.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", body, signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function fakeSend(body) {
    console.info("Waitlist demo mode: nothing was sent.", Object.fromEntries(body));
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 900));
  }

  function showSuccess() {
    const name = els.first_name.value.trim();
    if (name) document.getElementById("success-greeting").textContent = "Nice one, " + name + ".";
    form.hidden = true;
    success.hidden = false;
    document.getElementById("success-title").focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    showAlert("");

    const checks = [[emailInput, emailProblem()], [postcodeInput, postcodeProblem()]];
    checks.forEach(([input, message]) => setError(input, message));
    const firstBad = checks.find(([, message]) => message);
    if (firstBad) {
      firstBad[0].focus();
      return;
    }

    // People never see the spam-trap field, so anything in it came from a bot: pretend it worked
    if (els.website.value) {
      showSuccess();
      return;
    }

    if (!demo && !/^https?:\/\//.test(ENDPOINT)) {
      console.warn("Waitlist: paste your Apps Script web app URL into APPS_SCRIPT_URL in config.js (see README).");
      showAlert("Sign-ups aren't switched on yet, sorry.", true);
      return;
    }

    setLoading(true);
    try {
      const body = buildPayload();
      const result = demo ? await fakeSend(body) : await send(body);
      if (result && result.ok) {
        showSuccess();
      } else if (result && result.error === "invalid_email") {
        setError(emailInput, "That email doesn't look right. Check for typos.");
        emailInput.focus();
      } else if (result && result.error === "too_fast") {
        showAlert("That was quick! Wait a couple of seconds, then press Join again.");
      } else {
        throw new Error((result && result.error) || "Unexpected reply");
      }
    } catch (err) {
      console.error("Waitlist sign-up failed:", err);
      showAlert("Sorry, we couldn't add you just then. Check your connection and try again.", true);
    } finally {
      setLoading(false);
    }
  });

  // ---------- Share with a mate ----------

  const shareBtn = document.getElementById("share-btn");
  const shareStatus = document.getElementById("share-status");
  const shareFallback = document.getElementById("share-fallback");
  const shareInput = document.getElementById("share-url");

  shareBtn.addEventListener("click", async () => {
    const base = /^https?:\/\//.test(HOME) ? HOME : location.origin + location.pathname;
    const url = base + "?utm_source=share&utm_medium=referral";
    const data = { title: NAME, text: "Found this survival skills app with field days near Sydney. Keen?", url };

    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // they closed the share sheet
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = "Link copied. Send it to a mate.";
    } catch (err) {
      shareInput.value = url;
      shareFallback.hidden = false;
      shareInput.focus();
      shareInput.select();
      shareStatus.textContent = "Copy the link above and send it to a mate.";
    }
  });
})();
