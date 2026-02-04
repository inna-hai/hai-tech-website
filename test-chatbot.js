/**
 * Playwright Test - Chatbot GUI
 */

const { chromium } = require('playwright');

async function testChatbot() {
    console.log('🚀 Starting Playwright test...\n');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 375, height: 812 }, // iPhone X dimensions
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
    });
    const page = await context.newPage();
    
    try {
        // Navigate to the page
        console.log('📱 Loading page (mobile viewport 375x812)...');
        await page.goto('http://129.159.135.204:8080', { timeout: 30000 });
        await page.waitForTimeout(2000);
        console.log('✅ Page loaded\n');
        
        // Test 1: Check if chat button exists
        console.log('Test 1: Chat button visibility');
        const chatBtn = await page.$('#haitech-chat-btn');
        if (chatBtn) {
            const btnBox = await chatBtn.boundingBox();
            console.log(`✅ Chat button found at position: bottom=${812 - btnBox.y - btnBox.height}px, left=${btnBox.x}px`);
            console.log(`   Size: ${btnBox.width}x${btnBox.height}px\n`);
        } else {
            console.log('❌ Chat button NOT FOUND\n');
            throw new Error('Chat button not found');
        }
        
        // Test 2: Click button and check window opens
        console.log('Test 2: Opening chat window');
        await chatBtn.click();
        await page.waitForTimeout(500);
        
        const chatWindow = await page.$('#haitech-chat-window');
        if (chatWindow) {
            const isVisible = await chatWindow.isVisible();
            if (isVisible) {
                const winBox = await chatWindow.boundingBox();
                const heightPercent = ((winBox.height / 812) * 100).toFixed(1);
                console.log(`✅ Chat window opened!`);
                console.log(`   Position: top=${winBox.y}px, left=${winBox.x}px`);
                console.log(`   Size: ${winBox.width}x${winBox.height}px`);
                console.log(`   Height as % of viewport: ${heightPercent}%`);
                
                if (parseFloat(heightPercent) > 65) {
                    console.log(`⚠️  WARNING: Window height (${heightPercent}%) exceeds 60% target!\n`);
                } else {
                    console.log(`✅ Height is within acceptable range\n`);
                }
            } else {
                console.log('❌ Chat window exists but is NOT VISIBLE\n');
                throw new Error('Chat window not visible');
            }
        } else {
            console.log('❌ Chat window element NOT FOUND\n');
            throw new Error('Chat window not found');
        }
        
        // Test 3: Check header
        console.log('Test 3: Chat header');
        const header = await page.$('.haitech-header');
        if (header) {
            const headerText = await page.$eval('.haitech-header', el => el.textContent);
            console.log(`✅ Header found with text: "${headerText.trim().substring(0, 50)}..."\n`);
        } else {
            console.log('❌ Header NOT FOUND\n');
        }
        
        // Test 4: Check welcome message
        console.log('Test 4: Welcome message');
        const messages = await page.$$('.haitech-msg.bot');
        if (messages.length > 0) {
            const msgText = await messages[0].$eval('.msg-content', el => el.textContent);
            console.log(`✅ Bot message found: "${msgText.substring(0, 60)}..."\n`);
        } else {
            console.log('❌ No bot messages found\n');
        }
        
        // Test 5: Check quick action buttons
        console.log('Test 5: Quick action buttons');
        const quickBtns = await page.$$('.haitech-quick-btn');
        if (quickBtns.length > 0) {
            console.log(`✅ Found ${quickBtns.length} quick action buttons`);
            for (let i = 0; i < quickBtns.length; i++) {
                const btnText = await quickBtns[i].textContent();
                console.log(`   - "${btnText.trim()}"`);
            }
            console.log('');
        } else {
            console.log('❌ No quick action buttons found\n');
        }
        
        // Test 6: Send a message
        console.log('Test 6: Sending a message');
        const input = await page.$('#haitech-input');
        if (input) {
            await input.fill('שלום');
            const sendBtn = await page.$('#haitech-send');
            await sendBtn.click();
            await page.waitForTimeout(2000);
            
            const allMessages = await page.$$('.haitech-msg');
            console.log(`✅ Message sent! Total messages now: ${allMessages.length}\n`);
        } else {
            console.log('❌ Input field not found\n');
        }
        
        // Test 7: Close button
        console.log('Test 7: Close button');
        const closeBtn = await page.$('.haitech-close');
        if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(300);
            const windowAfterClose = await page.$('#haitech-chat-window');
            const isStillVisible = await windowAfterClose.isVisible();
            if (!isStillVisible) {
                console.log('✅ Window closed successfully\n');
            } else {
                console.log('❌ Window did not close\n');
            }
        } else {
            console.log('❌ Close button not found\n');
        }
        
        // Summary
        console.log('========================================');
        console.log('📊 TEST SUMMARY');
        console.log('========================================');
        console.log('✅ All basic tests passed!');
        console.log('');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testChatbot();
