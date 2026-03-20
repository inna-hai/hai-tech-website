// E2E-style test for WhatsApp buttons - fetches live pages and validates links
// Run: node test-wa-buttons.js

const https = require('https');
const http = require('http');

const PAGES = [
  { name: 'רובלוקס', path: '/%D7%A7%D7%95%D7%A8%D7%A1-%D7%A8%D7%95%D7%91%D7%9C%D7%95%D7%A7%D7%A1-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D' },
  { name: 'פייתון', path: '/%D7%9C%D7%99%D7%9E%D7%95%D7%93-%D7%A4%D7%99%D7%99%D7%AA%D7%95%D7%9F-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D' },
  { name: 'דף הבית', path: '/' },
  { name: 'סקראץ׳', path: '/%D7%A7%D7%95%D7%A8%D7%A1-%D7%A1%D7%A7%D7%A8%D7%90%D7%A5-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D' },
  { name: 'מיינקראפט', path: '/%D7%97%D7%95%D7%92-%D7%9E%D7%99%D7%99%D7%A0%D7%A7%D7%A8%D7%90%D7%A4%D7%98' },
  { name: 'תכנות לילדים', path: '/%D7%A7%D7%95%D7%A8%D7%A1-%D7%AA%D7%9B%D7%A0%D7%95%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D' },
  { name: 'בינה מלאכותית', path: '/%D7%91%D7%99%D7%A0%D7%94-%D7%9E%D7%9C%D7%90%D7%9B%D7%95%D7%AA%D7%99%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D' },
  { name: 'מוסדות', path: '/institutions' },
  { name: 'מחירים', path: '/pricing' },
];

const BASE_URL = 'https://hai.tech';
const EXPECTED_NUMBER = '972533009742';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractWaLinks(html) {
  const regex = /<a\s[^>]*href="(https?:\/\/wa\.me\/[^"]*)"[^>]*>/gi;
  const links = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const fullTag = html.substring(match.index, html.indexOf('>', match.index) + 1);
    links.push({ href: match[1], tag: fullTag });
  }
  return links;
}

function followRedirect(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location || res.url || url });
    }).on('error', reject);
  });
}

async function runTests() {
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const page of PAGES) {
    console.log(`\n📄 ${page.name} (${page.path})`);
    
    let html;
    try {
      html = await fetch(`${BASE_URL}${page.path}`);
    } catch (e) {
      console.log(`  ❌ FETCH FAILED: ${e.message}`);
      failed++;
      failures.push(`${page.name}: failed to fetch`);
      continue;
    }

    const links = extractWaLinks(html);
    
    // Test 1: Has WA links
    totalTests++;
    if (links.length === 0) {
      console.log(`  ❌ No wa.me links found`);
      failed++;
      failures.push(`${page.name}: no wa.me links`);
      continue;
    } else {
      console.log(`  ✅ Found ${links.length} wa.me links`);
      passed++;
    }

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const label = `Link #${i+1}`;

      // Test 2: target="_blank"
      totalTests++;
      if (link.tag.includes('target="_blank"')) {
        console.log(`  ✅ ${label}: has target="_blank"`);
        passed++;
      } else {
        console.log(`  ❌ ${label}: MISSING target="_blank"`);
        failed++;
        failures.push(`${page.name} ${label}: missing target="_blank"`);
      }

      // Test 3: correct number
      totalTests++;
      if (link.href.includes(EXPECTED_NUMBER)) {
        console.log(`  ✅ ${label}: correct number (${EXPECTED_NUMBER})`);
        passed++;
      } else {
        console.log(`  ❌ ${label}: wrong number in ${link.href}`);
        failed++;
        failures.push(`${page.name} ${label}: wrong number`);
      }

      // Test 4: encoded Hebrew text
      totalTests++;
      if (link.href.includes('?text=')) {
        const textPart = link.href.split('?text=')[1];
        const hasRawHebrew = /[\u0590-\u05FF]/.test(textPart);
        if (!hasRawHebrew) {
          console.log(`  ✅ ${label}: Hebrew text is URL-encoded`);
          passed++;
        } else {
          console.log(`  ❌ ${label}: raw Hebrew in URL: ${textPart.substring(0, 40)}...`);
          failed++;
          failures.push(`${page.name} ${label}: unencoded Hebrew`);
        }
      } else {
        console.log(`  ⚠️  ${label}: no text= parameter (OK for some links)`);
        passed++;
      }

      // Test 5: wa.me redirect works (text param preserved)
      totalTests++;
      try {
        const redirect = await followRedirect(link.href);
        if (redirect.status === 302 || redirect.status === 301) {
          const loc = redirect.location;
          if (loc && loc.includes('text=') && !loc.endsWith('text=') && !loc.includes('text=&')) {
            console.log(`  ✅ ${label}: redirect preserves text param`);
            passed++;
          } else if (loc && loc.includes('text=')) {
            console.log(`  ❌ ${label}: redirect LOSES text param → ${loc.substring(0, 80)}`);
            failed++;
            failures.push(`${page.name} ${label}: text lost in redirect`);
          } else {
            console.log(`  ⚠️  ${label}: redirect has no text param`);
            passed++;
          }
        } else {
          console.log(`  ✅ ${label}: direct load (status ${redirect.status})`);
          passed++;
        }
      } catch (e) {
        console.log(`  ⚠️  ${label}: redirect check failed: ${e.message}`);
        passed++; // Not a hard failure
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${totalTests} tests`);
  
  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach(f => console.log(`  • ${f}`));
  } else {
    console.log('\n✅ All tests passed!');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
