import { test, expect, Page } from '@playwright/test';

// Unique suffixes for isolation across test runs
const RUN_ID = Math.random().toString(36).substring(2, 8);
const OWNER_A_EMAIL = `owner_a_${RUN_ID}@example.com`;
const OWNER_B_EMAIL = `owner_b_${RUN_ID}@example.com`;
const REST_A_NAME = `Spice Garden ${RUN_ID}`;
const REST_A_SLUG = `spice-garden-${RUN_ID}`;
const REST_B_NAME = `Ocean Breeze ${RUN_ID}`;
const REST_B_SLUG = `ocean-breeze-${RUN_ID}`;

test.describe.serial('MenuGo V1 End-to-End Validation', () => {
  let page: Page;
  let customerTableUrl: string;
  let orderTrackingUrl: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page?.close();
  });

  // -------------------------------------------------------------------------
  // Journey 1: Owner Authentication & Restaurant Setup
  // -------------------------------------------------------------------------
  test('Step 1: Owner signs up and completes restaurant onboarding', async () => {
    await page.goto('/admin/login?mode=signup');

    const registerBtn = page.locator('button:has-text("Register Restaurant")');
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
    }

    // Fill Sign Up form
    await page.fill('input[type="text"]', 'Executive Chef Sharma');
    await page.fill('input[type="email"]', OWNER_A_EMAIL);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    // Onboarding form appears for fresh account
    await expect(page.locator('h3:has-text("Welcome to MenuGo!")')).toBeVisible({ timeout: 10000 });

    // Fill Restaurant Onboarding Form
    await page.fill('#restaurant-name', REST_A_NAME);
    await page.fill('#restaurant-slug', REST_A_SLUG);
    await page.click('button[type="submit"]:has-text("Complete Onboarding")');

    // Success banner & restaurant dashboard
    await expect(page.locator('text=Restaurant Created Successfully!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`h1:has-text("${REST_A_NAME}")`)).toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // Journey 2: Menu Setup (Categories & Products)
  // -------------------------------------------------------------------------
  test('Step 2: Owner creates menu categories and dish products', async () => {
    // 1. Create Category
    await page.goto('/admin/categories');
    await expect(page.locator('h1:has-text("Category Management")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Add Category")');
    await page.fill('input[placeholder*="Starters"]', 'Signature Starters');
    await page.fill('textarea[placeholder*="delicacies"]', 'Fresh clay oven delicacies');
    await page.click('button[type="submit"]:has-text("Create Category")');

    await expect(page.locator('text=Signature Starters').first()).toBeVisible({ timeout: 10000 });

    // 2. Create Product (Available: Tandoori Paneer @ ₹280 = 28000 paise)
    await page.goto('/admin/products');
    await expect(page.locator('h1:has-text("Menu Products")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Add Product")');
    await page.fill('input[placeholder*="Masala Dosa"]', 'Tandoori Paneer Tikka');
    await page.fill('input[placeholder="180.00"]', '280.00');
    await page.fill('textarea[placeholder*="Ingredients"]', 'Char-grilled cottage cheese with bell peppers');
    await page.click('button[type="submit"]:has-text("Create Product")');

    await expect(page.locator('text=Tandoori Paneer Tikka').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=₹280').first()).toBeVisible();
    await expect(page.locator('span:has-text("In Stock")').first()).toBeVisible();

    // 3. Create a Second Product (Sold Out product to test availability rules)
    await page.click('button:has-text("Add Product")');
    await page.fill('input[placeholder*="Masala Dosa"]', 'Mango Kulfi (Seasonal)');
    await page.fill('input[placeholder="180.00"]', '120.00');

    // Uncheck "In Stock"
    const availableCheckbox = page.locator('label:has-text("In Stock") input[type="checkbox"]');
    if (await availableCheckbox.isChecked()) {
      await availableCheckbox.uncheck();
    }
    await page.click('button[type="submit"]:has-text("Create Product")');

    await expect(page.locator('text=Mango Kulfi (Seasonal)').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('span:has-text("Sold Out")').first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Journey 3: Table Setup & QR Generation
  // -------------------------------------------------------------------------
  test('Step 3: Owner creates dining table and generates cryptographic QR', async () => {
    await page.goto('/admin/tables');
    await expect(page.locator('h1:has-text("Tables & QR Codes")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Add Table")');
    await page.fill('input[placeholder*="Table 1"]', 'Table 4');
    await page.fill('input[type="number"]', '4');
    await page.click('button[type="submit"]:has-text("Generate QR Table")');

    await expect(page.locator('h3:has-text("Table 4")')).toBeVisible({ timeout: 10000 });

    // Open QR Code Preview Modal to copy target customer URL
    await page.click('button:has-text("Print Stand")');
    await expect(page.locator('h2:has-text("Table 4 QR Code")')).toBeVisible();

    // Read the cryptographic customer URL
    const urlInput = page.locator('input[readonly]');
    await expect(urlInput).toBeVisible();
    customerTableUrl = await urlInput.inputValue();
    expect(customerTableUrl).toContain(`/menu/${REST_A_SLUG}`);
    expect(customerTableUrl).toContain('table=');
  });

  // -------------------------------------------------------------------------
  // Journey 4: Customer Dine-in Ordering via QR
  // -------------------------------------------------------------------------
  test('Step 4: Customer opens table URL, composes cart, and submits dine-in order', async ({ browser }) => {
    // Open isolated customer context (no admin cookies)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    expect(customerTableUrl).toBeDefined();
    await customerPage.goto(customerTableUrl);

    // Verify verified table badge and restaurant header
    await expect(customerPage.locator(`h1:has-text("${REST_A_NAME}")`)).toBeVisible({ timeout: 15000 });
    await expect(customerPage.locator('text=Table 4').first()).toBeVisible();

    // Verify Available Product is visible and Sold Out product is hidden from customer menu
    await expect(customerPage.locator('text=Tandoori Paneer Tikka').first()).toBeVisible();
    await expect(customerPage.locator('text=Mango Kulfi (Seasonal)')).not.toBeVisible();

    // Add Tandoori Paneer Tikka to Cart
    const addBtn = customerPage.locator('button[aria-label*="Tandoori Paneer Tikka"]').first();
    await addBtn.click();

    // Verify floating bottom cart pill appears
    const viewOrderBtn = customerPage.locator('button:has-text("View Order")');
    await expect(viewOrderBtn).toBeVisible({ timeout: 5000 });
    await viewOrderBtn.click();

    // Cart Drawer opens
    await expect(customerPage.locator('h2:has-text("Your Order Composition")')).toBeVisible();
    await expect(customerPage.locator('span:has-text("₹280")').first()).toBeVisible();

    // Click Proceed to Order
    await customerPage.click('button:has-text("Proceed to Order")');

    // Confirmation modal opens
    await expect(customerPage.locator('h3:has-text("Confirm Dine-in Order")')).toBeVisible();
    await customerPage.fill('input[placeholder="Your Name"]', 'Aarav Patel');

    // Submit order to kitchen
    await customerPage.click('button:has-text("Send Order to Kitchen")');

    // "Order #... Placed!" confirmation dialog
    await expect(customerPage.locator('h3:has-text("Sent to Kitchen")')).toBeVisible({ timeout: 15000 });
    await expect(customerPage.locator('text=Table 4').first()).toBeVisible();

    // Click Track Live Preparation
    const trackLink = customerPage.locator('a:has-text("Track Live Preparation")');
    await expect(trackLink).toBeVisible();
    const trackHref = await trackLink.getAttribute('href');
    expect(trackHref).toMatch(/\/track\/[a-f0-9-]+/);
    orderTrackingUrl = trackHref!;

    await customerPage.click('a:has-text("Track Live Preparation")');
    await expect(customerPage.locator('h3:has-text("Preparation Progress")')).toBeVisible({ timeout: 10000 });
    await expect(customerPage.locator('text=Order Received').first()).toBeVisible();
    await expect(customerPage.locator('text=Table 4').first()).toBeVisible();

    await customerContext.close();
  });

  // -------------------------------------------------------------------------
  // Journey 5: Kitchen KDS Operations & Floor Service
  // -------------------------------------------------------------------------
  test('Step 5: Kitchen processes order (NEW -> ACCEPTED -> PREPARING -> READY) and Staff marks SERVED', async ({ browser }) => {
    // 1. Kitchen Staff View on the authenticated owner page
    await page.goto('/kitchen');
    await expect(page.locator('h1:has-text("MenuGo KDS")')).toBeVisible({ timeout: 15000 });

    // Order Card for Table 4 should be visible
    const orderCard = page.locator('div:has-text("Table 4")').first();
    await expect(orderCard).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Tandoori Paneer Tikka').first()).toBeVisible();

    // 2. Kitchen accepts order (NEW -> ACCEPTED)
    const acceptBtn = page.locator('button:has-text("Accept")').first();
    await acceptBtn.click();
    // After acceptance, "Start Cooking" action becomes available
    const cookBtn = page.locator('button:has-text("Start Cooking")').first();
    await expect(cookBtn).toBeVisible({ timeout: 10000 });

    // 3. Kitchen starts cooking (ACCEPTED -> PREPARING)
    await cookBtn.click();
    // After starting cook, "Mark Ready to Serve" action becomes available
    const readyBtn = page.locator('button:has-text("Mark Ready to Serve")').first();
    await expect(readyBtn).toBeVisible({ timeout: 10000 });

    // 4. Kitchen marks ready (PREPARING -> READY)
    await readyBtn.click();
    // After marking ready, KDS displays ready state or "Mark Served (Complete)"
    await expect(page.locator('button:has-text("Mark Served (Complete)")').first()).toBeVisible({ timeout: 10000 });

    // 5. Floor Staff Service Pass (`/service`)
    await page.goto('/service');
    await expect(page.locator('h1:has-text("Floor Service Pass")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Table 4').first()).toBeVisible();

    // Staff marks order SERVED (READY -> SERVED)
    const markServedBtn = page.locator('button:has-text("Mark as Served")').first();
    await markServedBtn.click();

    // Card should disappear from Ready pass - verify Service Pass is clear
    await expect(page.locator('text=The Service Pass is Clear!')).toBeVisible({ timeout: 10000 });

    // 6. Customer tracking page reflects SERVED status
    const customerContext = await browser.newContext();
    const trackingPage = await customerContext.newPage();
    await trackingPage.goto(orderTrackingUrl);

    await expect(trackingPage.locator('text=Table 4').first()).toBeVisible({ timeout: 10000 });
    await expect(trackingPage.locator('text=Order Completed & Delivered')).toBeVisible({ timeout: 10000 });

    await customerContext.close();
  });

  // -------------------------------------------------------------------------
  // Journey 6: Multi-Tenant Isolation Verification
  // -------------------------------------------------------------------------
  test('Step 6: Tenant B cannot access Tenant A data or orders', async ({ browser }) => {
    const tenantBContext = await browser.newContext();
    const pageB = await tenantBContext.newPage();

    await pageB.goto('/admin/login?mode=signup');
    const registerBtn = pageB.locator('button:has-text("Register Restaurant")');
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
    }

    await pageB.fill('input[type="text"]', 'Manager Rodriguez');
    await pageB.fill('input[type="email"]', OWNER_B_EMAIL);
    await pageB.fill('input[type="password"]', 'Password123!');
    await pageB.click('button[type="submit"]:has-text("Create Account")');

    await expect(pageB).toHaveURL(/.*admin\/dashboard/, { timeout: 15000 });

    // Complete Onboarding for Restaurant B
    await expect(pageB.locator('h3:has-text("Welcome to MenuGo!")')).toBeVisible({ timeout: 10000 });
    await pageB.fill('#restaurant-name', REST_B_NAME);
    await pageB.fill('#restaurant-slug', REST_B_SLUG);
    await pageB.click('button[type="submit"]:has-text("Complete Onboarding")');

    await expect(pageB.locator(`h1:has-text("${REST_B_NAME}")`)).toBeVisible({ timeout: 15000 });

    // Check Dashboard Isolation: Restaurant B profile is active, Restaurant A is not visible
    await expect(pageB.locator(`h1:has-text("${REST_B_NAME}")`)).toBeVisible({ timeout: 15000 });
    await expect(pageB.locator(`text=${REST_A_NAME}`)).not.toBeVisible();

    // Check Categories: Restaurant B has 0 categories, none of Restaurant A's
    await pageB.locator('a[href="/admin/categories"]').first().click();
    await expect(pageB.locator('h1:has-text("Category Management")')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('text=Signature Starters')).not.toBeVisible();

    // Return to dashboard and check Products: Restaurant B has 0 products
    await pageB.locator('a[href="/admin/dashboard"]').first().click();
    await pageB.locator('a[href="/admin/products"]').first().click();
    await expect(pageB.locator('h1:has-text("Menu Products")')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('text=Tandoori Paneer Tikka')).not.toBeVisible();

    // Return to dashboard and check Tables: Restaurant B has 0 tables
    await pageB.locator('a[href="/admin/dashboard"]').first().click();
    await pageB.locator('a[href="/admin/tables"]').first().click();
    await expect(pageB.locator('h1:has-text("Tables & QR Codes")')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('text=Table 4')).not.toBeVisible();

    // Return to dashboard and check Orders / Kitchen: Restaurant B sees 0 orders
    await pageB.locator('a[href="/admin/dashboard"]').first().click();
    await pageB.locator('a[href="/kitchen"]').first().click();
    await expect(pageB.locator('h1:has-text("MenuGo KDS")')).toBeVisible({ timeout: 15000 });
    await expect(pageB.locator('text=Tandoori Paneer Tikka')).not.toBeVisible();
    await expect(pageB.locator('text=Kitchen Queue is Clear')).toBeVisible({ timeout: 10000 });

    await tenantBContext.close();
  });

  // -------------------------------------------------------------------------
  // Journey 7: Mobile Viewport Cart Experience
  // -------------------------------------------------------------------------
  test('Step 7: Customer menu and cart drawer behave smoothly on mobile viewport', async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(customerTableUrl);
    await expect(mobilePage.locator(`h1:has-text("${REST_A_NAME}")`)).toBeVisible({ timeout: 15000 });

    // Add item to cart
    const addBtn = mobilePage.locator('button[aria-label*="Tandoori Paneer Tikka"]').first();
    await addBtn.click();

    // Floating cart bar displays at bottom of mobile screen
    const floatingBar = mobilePage.locator('button:has-text("View Order")');
    await expect(floatingBar).toBeVisible();

    // Open Drawer
    await floatingBar.click();
    await expect(mobilePage.locator('h2:has-text("Your Order Composition")')).toBeVisible();

    await mobileContext.close();
  });
});
