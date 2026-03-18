/**
 * Cookie Consent Banner for דרך ההייטק
 * Blocks GA4 and other tracking until user consents
 */

const CookieConsent = {
    COOKIE_NAME: 'hai_cookie_consent',
    COOKIE_DAYS: 365,

    init() {
        if (this.hasConsent()) {
            this.loadAnalytics();
        } else if (!this.hasDenied()) {
            this.showBanner();
        }
    },

    hasConsent() {
        return document.cookie.includes(`${this.COOKIE_NAME}=accepted`);
    },

    hasDenied() {
        return document.cookie.includes(`${this.COOKIE_NAME}=denied`);
    },

    setCookie(value) {
        const d = new Date();
        d.setTime(d.getTime() + this.COOKIE_DAYS * 86400000);
        document.cookie = `${this.COOKIE_NAME}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
    },

    accept() {
        this.setCookie('accepted');
        this.hideBanner();
        this.loadAnalytics();
    },

    deny() {
        this.setCookie('denied');
        this.hideBanner();
    },

    loadAnalytics() {
        // Load GA4 only after consent
        if (typeof Analytics !== 'undefined' && Analytics.init) {
            Analytics._consentGranted = true;
            Analytics.init();
        }
    },

    showBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookieConsentBanner';
        banner.innerHTML = `
            <div class="cookie-banner-inner">
                <div class="cookie-banner-text">
                    <span class="cookie-icon">🍪</span>
                    <p>האתר משתמש בעוגיות לשיפור חוויית הגלישה ולניתוח תנועה.
                    <a href="/privacy.html" target="_blank">מדיניות פרטיות</a></p>
                </div>
                <div class="cookie-banner-buttons">
                    <button class="cookie-btn cookie-btn-accept" onclick="CookieConsent.accept()">מאשר/ת ✓</button>
                    <button class="cookie-btn cookie-btn-deny" onclick="CookieConsent.deny()">לא, תודה</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);
    },

    hideBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.classList.add('cookie-banner-hide');
            setTimeout(() => banner.remove(), 400);
        }
    }
};

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CookieConsent.init());
} else {
    CookieConsent.init();
}
