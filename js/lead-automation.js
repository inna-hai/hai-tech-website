/**
 * Lead Automation System for דרך ההייטק
 * Handles form submissions, lead storage, and WhatsApp notifications
 */

const LeadAutomation = {
    // Configuration
    config: {
        whatsappNumber: '972533009742',
        storageKey: 'haitech_leads',
        formId: 'contactForm',
        popupDelay: 5000, // 5 seconds
        exitIntentEnabled: true,
        // CRM API Configuration - HaiTech CRM Webhook
        apiEndpoint: 'https://dev-crm.orma-ai.com/api/webhook/leads',
        apiKey: 'haitech-crm-api-key-2026'
    },

    // Initialize the system
    init() {
        this.setupFormHandlers();
        this.setupExitIntent();
        this.setupPopupTriggers();
        console.log('Lead Automation System initialized');
    },

    // Email validation
    validateEmail(email) {
        if (!email) return true; // Email is optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Phone validation (Israeli format)
    validatePhone(phone) {
        const phoneRegex = /^0[2-9]\d{7,8}$/;
        const cleanPhone = phone.replace(/[-\s]/g, '');
        return phoneRegex.test(cleanPhone);
    },

    // Generate WhatsApp link with pre-filled message
    generateWhatsAppLink(lead) {
        const message = encodeURIComponent(
            `*ליד חדש מהאתר* 🎉\n\n` +
            `📝 *שם:* ${lead.name}\n` +
            `📱 *טלפון:* ${lead.phone}\n` +
            `📧 *אימייל:* ${lead.email || 'לא צוין'}\n` +
            `📚 *מתעניין/ת ב:* ${lead.subject || 'לא צוין'}\n` +
            `💬 *הודעה:* ${lead.message || 'לא צוינה'}\n` +
            `🕐 *נשלח ב:* ${new Date().toLocaleString('he-IL')}`
        );
        return `https://wa.me/${this.config.whatsappNumber}?text=${message}`;
    },

    // Send lead to CRM API (HaiTech CRM Webhook)
    async sendToCRM(lead) {
        console.log('[CRM] Sending lead to CRM...', lead);
        try {
            // Build the webhook payload
            const crmData = {
                name: lead.name,
                phone: lead.phone || '',
                email: lead.email || '',
                city: lead.city || '',
                childName: lead.childName || '',
                childAge: lead.childAge || '',
                interest: lead.subject || lead.interest || '',
                message: lead.message || '',
                source: 'website'
            };

            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey
                },
                body: JSON.stringify(crmData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Lead sent to CRM:', result);
                return true;
            } else {
                console.error('CRM API error:', response.status);
                return false;
            }
        } catch (error) {
            console.error('[CRM] Error sending to CRM:', error);
            return false;
        }
    },

    // Calculate approximate birth year from age
    calculateBirthYear(age) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - parseInt(age);
        return `${birthYear}-01-01`;
    },

    // Save lead to localStorage and CRM
    saveLead(lead) {
        console.log('[LEAD] Saving lead...', lead);
        try {
            const leads = this.getStoredLeads();
            lead.id = Date.now();
            lead.timestamp = new Date().toISOString();
            lead.source = window.location.pathname;
            leads.push(lead);
            localStorage.setItem(this.config.storageKey, JSON.stringify(leads));
            console.log('Lead saved locally:', lead);
            
            // Also send to CRM API
            this.sendToCRM(lead);
            
            return true;
        } catch (error) {
            console.error('Error saving lead:', error);
            return false;
        }
    },

    // Get stored leads
    getStoredLeads() {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading leads:', error);
            return [];
        }
    },

    // Show success message
    showSuccess(form) {
        const successMsg = document.createElement('div');
        successMsg.className = 'form-success-message';
        successMsg.innerHTML = `
            <div class="success-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>תודה רבה! 🎉</h3>
                <p>פנייתכם התקבלה בהצלחה.<br>ניצור קשר בהקדם האפשרי!</p>
            </div>
        `;
        form.style.display = 'none';
        form.parentNode.insertBefore(successMsg, form.nextSibling);

        // Track success event
        if (typeof Analytics !== 'undefined') {
            Analytics.trackEvent('form_submission', 'success', 'contact_form');
        }
    },

    // Show error message
    showError(message, field = null) {
        // Remove existing error messages
        document.querySelectorAll('.form-error').forEach(el => el.remove());

        const errorMsg = document.createElement('div');
        errorMsg.className = 'form-error';
        errorMsg.textContent = message;

        if (field) {
            field.classList.add('field-error');
            field.parentNode.appendChild(errorMsg);
            field.focus();

            // Remove error on input
            field.addEventListener('input', () => {
                field.classList.remove('field-error');
                errorMsg.remove();
            }, { once: true });
        }
    },

    // Setup form handlers
    setupFormHandlers() {
        const form = document.getElementById(this.config.formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const lead = {
                name: formData.get('name')?.trim(),
                phone: formData.get('phone')?.trim(),
                email: formData.get('email')?.trim(),
                childName: formData.get('childName')?.trim(),
                childAge: formData.get('childAge'),
                subject: formData.get('subject'),
                message: formData.get('message')?.trim()
            };

            // Validation
            if (!lead.name) {
                this.showError('נא להזין שם ההורה', form.querySelector('#name'));
                return;
            }

            if (!lead.phone) {
                this.showError('נא להזין מספר טלפון', form.querySelector('#phone'));
                return;
            }

            if (!this.validatePhone(lead.phone)) {
                this.showError('מספר הטלפון אינו תקין', form.querySelector('#phone'));
                return;
            }

            if (!lead.email) {
                this.showError('נא להזין אימייל', form.querySelector('#email'));
                return;
            }

            if (!this.validateEmail(lead.email)) {
                this.showError('כתובת האימייל אינה תקינה', form.querySelector('#email'));
                return;
            }

            // Save lead
            this.saveLead(lead);

            // Show success
            this.showSuccess(form);

            // Open WhatsApp (optional - for instant notification)
            // Uncomment if you want automatic WhatsApp redirect
            // window.open(this.generateWhatsAppLink(lead), '_blank');
        });
    },

    // Setup exit intent detection
    setupExitIntent() {
        if (!this.config.exitIntentEnabled) return;

        let triggered = false;
        const popupShown = sessionStorage.getItem('haitech_popup_shown');

        if (popupShown) return;

        document.addEventListener('mouseout', (e) => {
            if (triggered) return;
            
            // Check if mouse is leaving the viewport from top
            if (e.clientY <= 0 && !e.relatedTarget && e.target === document.documentElement) {
                triggered = true;
                this.showExitPopup();
            }
        });

        // Mobile: Show popup after scroll up
        let lastScrollTop = 0;
        window.addEventListener('scroll', () => {
            if (triggered || window.innerWidth > 768) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop < lastScrollTop && lastScrollTop > 300) {
                triggered = true;
                this.showExitPopup();
            }
            lastScrollTop = scrollTop;
        }, { passive: true });
    },

    // Show exit intent popup
    showExitPopup() {
        const popup = document.getElementById('exitPopup');
        if (!popup) return;

        popup.classList.add('show');
        sessionStorage.setItem('haitech_popup_shown', 'true');

        // Track popup view
        if (typeof Analytics !== 'undefined') {
            Analytics.trackEvent('popup', 'view', 'exit_intent');
        }
    },

    // Close popup
    closePopup() {
        const popup = document.getElementById('exitPopup');
        if (popup) {
            popup.classList.remove('show');
        }
    },

    // Setup popup triggers
    setupPopupTriggers() {
        // Close button handler
        document.addEventListener('click', (e) => {
            if (e.target.matches('.popup-close') || e.target.matches('.popup-overlay')) {
                this.closePopup();
            }
        });

        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePopup();
            }
        });

        // Popup form handler
        const popupForm = document.getElementById('popupForm');
        if (popupForm) {
            popupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = new FormData(popupForm);
                const lead = {
                    name: formData.get('popup-name')?.trim(),
                    phone: formData.get('popup-phone')?.trim(),
                    source: 'exit_popup'
                };

                if (!lead.name || !lead.phone) {
                    this.showError('נא למלא את כל השדות');
                    return;
                }

                if (!this.validatePhone(lead.phone)) {
                    this.showError('מספר הטלפון אינו תקין');
                    return;
                }

                this.saveLead(lead);
                
                // Show thank you message in popup
                popupForm.innerHTML = `
                    <div class="popup-success">
                        <h3>תודה רבה! 🎉</h3>
                        <p>ניצור איתכם קשר בהקדם</p>
                    </div>
                `;

                // Track conversion
                if (typeof Analytics !== 'undefined') {
                    Analytics.trackEvent('popup', 'conversion', 'exit_intent');
                }

                // Close popup after delay
                setTimeout(() => this.closePopup(), 2000);
            });
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    LeadAutomation.init();
});

// Export for potential external use
window.LeadAutomation = LeadAutomation;
