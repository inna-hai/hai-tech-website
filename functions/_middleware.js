/**
 * Global middleware: injects marketing tags + WhatsApp lead-source tracking
 * into every public HTML page.
 *
 * - Google Ads base tag (AW-581343244) — only when the page doesn't already load/config it.
 * - Meta Pixel (3538415382997972) + PageView — only when not already present.
 * - /js/lead-tracking.js (WhatsApp click attribution + conversions).
 * - /js/analytics.js (GA4 G-E0E5PN9645) — only when the page doesn't already load it.
 *
 * Non-HTML responses, non-200s, and internal/private pages pass through untouched.
 * Any failure falls back to the original response.
 */

const AW_ID = 'AW-581343244';
const PIXEL_ID = '3538415382997972';

// Internal / private pages: client proposals, pitch decks, reports, staff guides, LMS app.
const SKIP_PATH_RE = new RegExp(
  [
    '^/lms(/|$)',
    '^/reports/',
    '^/documents/',
    '^/careeros',
    '-private(\\.html|/|$)',
    'proposal',
    'pitch',
    'report',
    'meeting',
    'position-paper',
    'one-pager',
    'qr-card',
    'curriculum-book',
    '^/update-\\d',
    '^/sensebuilder-guide',
    '^/drone-view-guide',
  ].join('|'),
  'i'
);

const GTAG_SNIPPET =
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${AW_ID}"></script>` +
  `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
  `gtag('js',new Date());gtag('config','${AW_ID}');</script>`;

const PIXEL_SNIPPET =
  `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
  `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;` +
  `n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;` +
  `s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',` +
  `'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');</script>`;

const TRACKING_SNIPPET = `<script src="/js/lead-tracking.js" defer></script>`;
const GA4_SNIPPET = `<script src="/js/analytics.js?v=20261031" defer></script>`;

function shouldSkip(pathname) {
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch (e) {}
  return SKIP_PATH_RE.test(path);
}

function hasAwBase(html) {
  return (
    html.includes(`gtag/js?id=${AW_ID}`) ||
    /gtag\(\s*['"]config['"]\s*,\s*['"]AW-581343244['"]/.test(html)
  );
}

export async function onRequest(context) {
  const response = await context.next();

  try {
    const { request } = context;
    if (request.method !== 'GET') return response;
    if (response.status !== 200) return response;
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('text/html')) return response;
    const url = new URL(request.url);
    if (shouldSkip(url.pathname)) return response;

    const html = await response.clone().text();
    let inject = '';
    if (!hasAwBase(html)) inject += GTAG_SNIPPET;
    if (!html.includes(`fbq('init','${PIXEL_ID}')`) && !html.includes(`fbq('init', '${PIXEL_ID}')`)) inject += PIXEL_SNIPPET;
    if (!html.includes('/js/lead-tracking.js')) inject += TRACKING_SNIPPET;
    if (!/js\/analytics\.js/.test(html)) inject += GA4_SNIPPET;
    if (!inject) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    const base = new Response(html, { status: response.status, statusText: response.statusText, headers });

    let done = false;
    return new HTMLRewriter()
      .on('head', {
        element(el) {
          if (done) return;
          done = true;
          el.append(inject, { html: true });
        },
      })
      .on('body', {
        element(el) {
          if (done) return;
          done = true;
          el.prepend(inject, { html: true });
        },
      })
      .transform(base);
  } catch (e) {
    return response;
  }
}
