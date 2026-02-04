/**
 * Analytics System for דרך ההייטק
 * Google Analytics 4 integration with custom event tracking
 */

const Analytics = {
    // Configuration - Replace with actual GA4 measurement ID
    config: {
        measurementId: 'G-XXXXXXXXXX', // TODO: Replace with actual GA4 ID
        debug: false
    },

    // Initialize Google Analytics 4
    init() {
        if (this.config.measurementId === 'G-XXXXXXXXXX') {
            console.warn('Analytics: GA4 Measurement ID not configured');
            return;
        }

        // Load GA4 script
        this.loadGA4Script();
        
        // Setup automatic tracking
        this.setupPageViews();
        this.setupLinkTracking();
        this.setupScrollTracking();
        
        console.log('Analytics System initialized');
    },

    // Load GA4 script dynamically
    loadGA4Script() {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.measurementId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;
        
        gtag('js', new Date());
        gtag('config', this.config.measurementId, {
            'send_page_view': true,
            'language': 'he',
            'currency': 'ILS'
        });
    },

    // Track page views
    setupPageViews() {
        // Track initial page view
        this.trackPageView(window.location.pathname, document.title);

        // Track SPA-style navigation if applicable
        window.addEventListener('popstate', () => {
            this.trackPageView(window.location.pathname, document.title);
        });
    },

    // Track page view
    trackPageView(path, title) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_path: path,
                page_title: title
            });
        }
        
        if (this.config.debug) {
            console.log('Analytics: Page view tracked', { path, title });
        }
    },

    // Track custom events
    trackEvent(category, action, label = null, value = null) {
        const eventParams = {
            event_category: category,
            event_label: label,
            value: value
        };

        if (typeof gtag !== 'undefined') {
            gtag('event', action, eventParams);
        }

        if (this.config.debug) {
            console.log('Analytics: Event tracked', { category, action, label, value });
        }
    },

    // Track form submissions
    trackFormSubmission(formName, success = true) {
        this.trackEvent('form', success ? 'submit_success' : 'submit_error', formName);
    },

    // Track outbound links
    setupLinkTracking() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href) return;

            // Track WhatsApp clicks
            if (href.includes('wa.me')) {
                this.trackEvent('engagement', 'whatsapp_click', href);
            }

            // Track external links
            if (href.startsWith('http') && !href.includes(window.location.hostname)) {
                this.trackEvent('engagement', 'outbound_click', href);
            }

            // Track email clicks
            if (href.startsWith('mailto:')) {
                this.trackEvent('engagement', 'email_click', href);
            }

            // Track phone clicks
            if (href.startsWith('tel:')) {
                this.trackEvent('engagement', 'phone_click', href);
            }
        });
    },

    // Track scroll depth
    setupScrollTracking() {
        const thresholds = [25, 50, 75, 100];
        const tracked = new Set();

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            );

            thresholds.forEach(threshold => {
                if (scrollPercent >= threshold && !tracked.has(threshold)) {
                    tracked.add(threshold);
                    this.trackEvent('engagement', 'scroll_depth', `${threshold}%`, threshold);
                }
            });
        }, { passive: true });
    },

    // Track course clicks
    trackCourseClick(courseName) {
        this.trackEvent('courses', 'click', courseName);
    },

    // Track section views (for conversion funnels)
    trackSectionView(sectionName) {
        this.trackEvent('engagement', 'section_view', sectionName);
    },

    // E-commerce: Track item view (for future use)
    trackItemView(item) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'view_item', {
                currency: 'ILS',
                items: [item]
            });
        }
    },

    // Track user timing (page load, etc.)
    trackTiming(category, name, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'timing_complete', {
                name: name,
                value: value,
                event_category: category
            });
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    Analytics.init();
});

// Track page load time
window.addEventListener('load', () => {
    if (window.performance) {
        const loadTime = Math.round(performance.now());
        Analytics.trackTiming('performance', 'page_load', loadTime);
    }
});

// Export for external use
window.Analytics = Analytics;
