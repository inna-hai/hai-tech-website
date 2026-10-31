/**
 * Lead-source tracking for WhatsApp clicks.
 *
 * - Persists first/last touch (UTM, click ids, external referrer, landing path).
 * - On every WhatsApp click (links + window.open), appends a short attribution
 *   code to the prefilled message, beacons the click to the CRM and fires
 *   Google Ads / Meta conversions.
 *
 * Defensive by design: every step is wrapped so it can never break the page
 * or block navigation to WhatsApp.
 */
(function () {
  'use strict';
  if (window.haiLeadTracking) return;

  var ENDPOINT = 'https://crm.orma-ai.com/api/public/wa-click';
  var AW_SEND_TO = 'AW-581343244/pY0XCIGMrq8dEIywmpUC';
  var FIRST_KEY = 'hai_firstTouch';
  var LAST_KEY = 'hai_lastTouch';
  var FIRST_TTL = 90 * 864e5;
  var LAST_TTL = 30 * 864e5;
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var DEFAULT_TEXT = 'היי, אשמח לשמוע פרטים';
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  var FIELDS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  var WA_RE = /^(https?:\/\/(www\.)?(wa\.me\/|api\.whatsapp\.com\/send)|whatsapp:\/\/send)/i;

  function store(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function load(key, ttl) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      if (v && v.at && (Date.now() - Date.parse(v.at)) < ttl) return v;
    } catch (e) {}
    return null;
  }
  function host(h) { return String(h || '').toLowerCase().replace(/^www\./, ''); }

  function currentTouch() {
    var t = { at: new Date().toISOString() }, hasSignal = false, sp;
    try { sp = new URLSearchParams(location.search); } catch (e) { sp = null; }
    for (var i = 0; i < PARAMS.length; i++) {
      var v = sp ? sp.get(PARAMS[i]) : null;
      t[FIELDS[i]] = v ? String(v).slice(0, 300) : null;
      if (v) hasSignal = true;
    }
    var ref = null;
    try {
      if (document.referrer) {
        var r = new URL(document.referrer);
        if (host(r.hostname) !== host(location.hostname)) { ref = document.referrer.slice(0, 500); hasSignal = true; }
      }
    } catch (e) {}
    t.referrer = ref;
    t.landingPath = location.pathname;
    return { touch: t, hasSignal: hasSignal };
  }

  var cur = currentTouch();
  var firstTouch = load(FIRST_KEY, FIRST_TTL);
  if (!firstTouch) { firstTouch = cur.touch; store(FIRST_KEY, firstTouch); }
  var lastTouch = load(LAST_KEY, LAST_TTL);
  if (cur.hasSignal || !lastTouch) {
    lastTouch = cur.touch;
    // Only persist lastTouch when the visit actually carries a source signal.
    if (cur.hasSignal) store(LAST_KEY, lastTouch);
  }

  function makeCode() {
    var out = '', bytes = new Uint8Array(6);
    try { crypto.getRandomValues(bytes); } catch (e) {
      for (var j = 0; j < 6; j++) bytes[j] = Math.floor(Math.random() * 256);
    }
    for (var i = 0; i < 6; i++) out += ALPHABET.charAt(bytes[i] % ALPHABET.length);
    return out;
  }

  function isWa(url) { return typeof url === 'string' && WA_RE.test(url.trim()); }

  // Returns { url, code, waNumber, prefill } or null.
  function decorate(rawUrl) {
    var url = String(rawUrl).trim();
    var qIdx = url.indexOf('?');
    var base = qIdx === -1 ? url : url.slice(0, qIdx);
    var query = qIdx === -1 ? '' : url.slice(qIdx + 1);
    var hashIdx = query.indexOf('#');
    var hash = '';
    if (hashIdx !== -1) { hash = query.slice(hashIdx); query = query.slice(0, hashIdx); }
    var sp = new URLSearchParams(query);
    var prefill = sp.get('text') || '';
    var code = makeCode();
    sp.set('text', (prefill || DEFAULT_TEXT) + '\n🔹' + code);
    var waNumber = sp.get('phone') || '';
    var m = base.match(/wa\.me\/\+?(\d+)/i);
    if (m) waNumber = m[1];
    // URLSearchParams encodes spaces as '+'; WhatsApp handles %20 more reliably.
    var qs = sp.toString().replace(/\+/g, '%20');
    return { url: base + '?' + qs + hash, code: code, waNumber: waNumber, prefill: prefill };
  }

  function send(info) {
    var p = {
      code: info.code,
      pageUrl: location.href,
      pagePath: location.pathname,
      pageTitle: document.title,
      waNumber: info.waNumber,
      prefill: info.prefill
    };
    for (var i = 0; i < FIELDS.length; i++) p[FIELDS[i]] = lastTouch[FIELDS[i]] || null;
    p.referrer = lastTouch.referrer || null;
    p.landingPath = lastTouch.landingPath || location.pathname;
    var ft = {};
    for (var k = 0; k < FIELDS.length; k++) ft[FIELDS[k]] = firstTouch[FIELDS[k]] || null;
    ft.referrer = firstTouch.referrer || null;
    ft.landingPath = firstTouch.landingPath || null;
    ft.at = firstTouch.at || null;
    p.firstTouch = ft;
    p.clickedAt = new Date().toISOString();

    var body = JSON.stringify(p), sent = false;
    try {
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      }
    } catch (e) {}
    if (!sent) {
      try {
        fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(function () {});
      } catch (e) {}
    }
    try { if (typeof window.gtag === 'function') window.gtag('event', 'conversion', { send_to: AW_SEND_TO }); } catch (e) {}
    try { if (typeof window.fbq === 'function') window.fbq('track', 'Contact'); } catch (e) {}
    return p;
  }

  function handle(url) {
    var info = decorate(url);
    try { send(info); } catch (e) {}
    return info;
  }

  // Links (including ones added later): capture phase, rewrite href before navigation.
  function onClick(ev) {
    try {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      var orig = a.getAttribute('data-hai-wa-orig') || a.getAttribute('href');
      if (!isWa(orig)) return;
      if (ev.type === 'auxclick' && ev.button !== 1) return;
      a.setAttribute('data-hai-wa-orig', orig);
      a.setAttribute('href', handle(orig).url);
    } catch (e) {}
  }
  try {
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
  } catch (e) {}

  // JS-opened WhatsApp (e.g. form handlers using window.open('https://wa.me/...')).
  try {
    var nativeOpen = window.open;
    if (typeof nativeOpen === 'function') {
      window.open = function (url) {
        try {
          if (isWa(typeof url === 'string' ? url : String(url || ''))) {
            var args = Array.prototype.slice.call(arguments);
            args[0] = handle(String(url)).url;
            return nativeOpen.apply(window, args);
          }
        } catch (e) {}
        return nativeOpen.apply(window, arguments);
      };
    }
  } catch (e) {}

  window.haiLeadTracking = {
    getFirstTouch: function () { return firstTouch; },
    getLastTouch: function () { return lastTouch; },
    decorate: function (url) { return decorate(url).url; },
    isWhatsApp: isWa
  };
})();
