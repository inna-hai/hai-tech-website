/**
 * HaiTech Payment Button
 * Add a "שלם עכשיו" button to any course page.
 * 
 * Usage:
 *   <script src="/payment-button.js"></script>
 *   <div class="ht-pay-btn"
 *        data-product-id="30680"
 *        data-course-name="קורס פייתון"
 *        data-price="497">
 *   </div>
 */
(function () {
  'use strict';

  const API_BASE = '/lms/api/payments';

  // ── Inject CSS ──────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .ht-pay-btn { display: inline-block; }
    .ht-pay-btn button {
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: #fff; border: none; border-radius: 12px;
      padding: 14px 32px; font-size: 1.1rem; font-weight: 700;
      cursor: pointer; transition: transform .15s, box-shadow .15s;
      box-shadow: 0 4px 16px rgba(109,40,217,.3);
    }
    .ht-pay-btn button:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(109,40,217,.4); }
    .ht-pay-btn button:disabled { opacity: .6; cursor: not-allowed; transform: none; }

    /* Modal backdrop */
    #ht-pay-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6);
      z-index: 9999; align-items: center; justify-content: center;
    }
    #ht-pay-overlay.open { display: flex; }

    /* Modal box */
    #ht-pay-modal {
      background: #fff; border-radius: 20px; padding: 36px 32px;
      max-width: 420px; width: 92%; direction: rtl; text-align: right;
      box-shadow: 0 20px 60px rgba(0,0,0,.25); position: relative;
    }
    #ht-pay-modal h2 { margin: 0 0 6px; font-size: 1.4rem; color: #1e1b4b; }
    #ht-pay-modal .ht-course-name { color: #7c3aed; font-weight: 600; margin-bottom: 4px; }
    #ht-pay-modal .ht-price-display {
      font-size: 2rem; font-weight: 800; color: #1e1b4b; margin-bottom: 20px;
    }
    #ht-pay-modal .ht-price-original {
      font-size: 1rem; color: #9ca3af; text-decoration: line-through; margin-right: 8px;
    }
    #ht-pay-modal label { display: block; font-size: .875rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
    #ht-pay-modal input {
      width: 100%; padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 10px;
      font-size: 1rem; box-sizing: border-box; margin-bottom: 14px; direction: ltr;
    }
    #ht-pay-modal input:focus { border-color: #7c3aed; outline: none; }
    #ht-pay-modal .ht-coupon-row { display: flex; gap: 8px; margin-bottom: 14px; }
    #ht-pay-modal .ht-coupon-row input { margin-bottom: 0; }
    #ht-pay-modal .ht-coupon-btn {
      padding: 10px 16px; background: #f3f4f6; border: 2px solid #e5e7eb;
      border-radius: 10px; cursor: pointer; font-size: .875rem; white-space: nowrap;
    }
    #ht-pay-modal .ht-coupon-msg { font-size: .8rem; margin-bottom: 10px; }
    #ht-pay-modal .ht-coupon-ok { color: #16a34a; }
    #ht-pay-modal .ht-coupon-err { color: #dc2626; }
    #ht-pay-modal .ht-pay-submit {
      width: 100%; padding: 14px; background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: #fff; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700;
      cursor: pointer; margin-top: 8px; transition: opacity .15s;
    }
    #ht-pay-modal .ht-pay-submit:disabled { opacity: .6; cursor: not-allowed; }
    #ht-pay-modal .ht-close {
      position: absolute; top: 16px; left: 16px; background: none; border: none;
      font-size: 1.4rem; cursor: pointer; color: #9ca3af; line-height: 1;
    }
    #ht-pay-modal .ht-secure { text-align: center; font-size: .75rem; color: #9ca3af; margin-top: 12px; }
    #ht-pay-modal .ht-error { color: #dc2626; font-size: .85rem; margin-bottom: 8px; }
  `;
  document.head.appendChild(style);

  // ── Modal HTML ──────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'ht-pay-overlay';
  overlay.innerHTML = `
    <div id="ht-pay-modal">
      <button class="ht-close" id="ht-pay-close">✕</button>
      <h2>💳 רכישת קורס</h2>
      <div class="ht-course-name" id="ht-modal-course"></div>
      <div class="ht-price-display" id="ht-modal-price"></div>

      <label>שם מלא *</label>
      <input id="ht-fname" placeholder="ישראל ישראלי" type="text" />

      <label>אימייל *</label>
      <input id="ht-email" placeholder="mail@example.com" type="email" />

      <label>טלפון (אופציונלי)</label>
      <input id="ht-phone" placeholder="050-0000000" type="tel" />

      <label>קוד קופון (אופציונלי)</label>
      <div class="ht-coupon-row">
        <input id="ht-coupon" placeholder="DISCOUNT20" type="text" style="text-transform:uppercase" />
        <button class="ht-coupon-btn" id="ht-coupon-apply">החל</button>
      </div>
      <div class="ht-coupon-msg" id="ht-coupon-msg"></div>

      <div class="ht-error" id="ht-pay-error"></div>
      <button class="ht-pay-submit" id="ht-pay-submit">עבור לתשלום →</button>
      <div class="ht-secure">🔒 תשלום מאובטח דרך Morning | כרטיס אשראי / ביט / Google Pay</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── State ───────────────────────────────────────────────────────────────────
  let currentProductId = null;
  let currentCourseName = '';
  let currentPrice = 0;
  let discountedPrice = null;
  let appliedCoupon = null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function updatePriceDisplay() {
    const el = document.getElementById('ht-modal-price');
    if (discountedPrice !== null && discountedPrice < currentPrice) {
      el.innerHTML = `₪${discountedPrice} <span class="ht-price-original">₪${currentPrice}</span>`;
    } else {
      el.textContent = `₪${currentPrice}`;
    }
  }

  function openModal(productId, courseName, price) {
    currentProductId = productId;
    currentCourseName = courseName;
    currentPrice = Number(price);
    discountedPrice = null;
    appliedCoupon = null;

    document.getElementById('ht-modal-course').textContent = courseName;
    updatePriceDisplay();
    document.getElementById('ht-coupon').value = '';
    document.getElementById('ht-coupon-msg').textContent = '';
    document.getElementById('ht-pay-error').textContent = '';
    document.getElementById('ht-fname').value = '';
    document.getElementById('ht-email').value = '';
    document.getElementById('ht-phone').value = '';

    overlay.classList.add('open');
    document.getElementById('ht-fname').focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  document.getElementById('ht-pay-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Apply coupon
  document.getElementById('ht-coupon-apply').addEventListener('click', async () => {
    const code = document.getElementById('ht-coupon').value.trim().toUpperCase();
    const msgEl = document.getElementById('ht-coupon-msg');
    if (!code) return;

    msgEl.textContent = 'בודק קופון...';
    msgEl.className = 'ht-coupon-msg';

    try {
      const res = await fetch(`${API_BASE}/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, productId: currentProductId }),
      });
      const data = await res.json();
      if (data.valid) {
        appliedCoupon = code;
        const coupon = data.coupon;
        if (coupon.discountType === 'percent') {
          discountedPrice = Math.round(currentPrice * (1 - coupon.discountValue / 100));
        } else {
          discountedPrice = Math.max(0, currentPrice - coupon.discountValue);
        }
        updatePriceDisplay();
        msgEl.textContent = `✅ קופון "${code}" הוחל! חיסכון של ₪${currentPrice - discountedPrice}`;
        msgEl.className = 'ht-coupon-msg ht-coupon-ok';
      } else {
        appliedCoupon = null;
        discountedPrice = null;
        updatePriceDisplay();
        msgEl.textContent = `❌ ${data.error || 'קופון לא תקין'}`;
        msgEl.className = 'ht-coupon-msg ht-coupon-err';
      }
    } catch {
      msgEl.textContent = 'שגיאה בבדיקת קופון';
      msgEl.className = 'ht-coupon-msg ht-coupon-err';
    }
  });

  // Submit payment
  document.getElementById('ht-pay-submit').addEventListener('click', async () => {
    const firstName = document.getElementById('ht-fname').value.trim();
    const email = document.getElementById('ht-email').value.trim();
    const phone = document.getElementById('ht-phone').value.trim();
    const errEl = document.getElementById('ht-pay-error');
    const btn = document.getElementById('ht-pay-submit');

    if (!firstName) { errEl.textContent = 'נא להזין שם מלא'; return; }
    if (!email || !email.includes('@')) { errEl.textContent = 'נא להזין כתובת אימייל תקינה'; return; }

    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '⏳ מעבד...';

    try {
      const nameParts = firstName.split(' ');
      const res = await fetch(`${API_BASE}/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: currentProductId,
          courseName: currentCourseName,
          price: discountedPrice !== null ? discountedPrice : currentPrice,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || '',
          email,
          phone: phone || undefined,
          couponCode: appliedCoupon || undefined,
        }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        errEl.textContent = data.error || 'שגיאה — נסה שוב';
        btn.disabled = false;
        btn.textContent = 'עבור לתשלום →';
      }
    } catch {
      errEl.textContent = 'שגיאת רשת — נסה שוב';
      btn.disabled = false;
      btn.textContent = 'עבור לתשלום →';
    }
  });

  // ── Initialize buttons from data attributes ─────────────────────────────────
  function initButtons() {
    document.querySelectorAll('.ht-pay-btn').forEach((container) => {
      const productId = container.dataset.productId || null;
      const courseName = container.dataset.courseName || 'קורס דרך ההייטק';
      const price = container.dataset.price || '0';
      const label = container.dataset.label || `🎓 קנה עכשיו — ₪${price}`;

      const btn = document.createElement('button');
      btn.textContent = label;
      btn.addEventListener('click', () => openModal(productId, courseName, price));
      container.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtons);
  } else {
    initButtons();
  }

  // Expose global API
  window.HaiTechPay = { open: openModal };
})();
