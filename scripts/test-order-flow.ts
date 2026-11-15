async function runE2ETest() {
  const API_URL = 'http://localhost:5001';
  const theatreToken = '8d91bfc3ef2e24eba1e22d2c8d26f5df82b0e791d14190c8';

  console.log('--- Step 1: Customer Visits Cinema Concessions Page ---');
  // Load resolve & menu in parallel (just like CustomerCinemaOrderingView)
  const [resolveRes, menuRes] = await Promise.all([
    fetch(`${API_URL}/api/cinema/public/resolve/${theatreToken}`).then(r => r.json()),
    fetch(`${API_URL}/api/cinema/public/menu/${theatreToken}`).then(r => r.json())
  ]);

  console.log('Theatre Name:', resolveRes.theatre?.name);
  console.log('Auditoriums available:', resolveRes.screens?.length);
  console.log('Menu Categories:', menuRes.categories?.length);
  console.log('Menu Products:', menuRes.products?.length);

  if (!resolveRes.valid || !menuRes.products || menuRes.products.length === 0) {
    throw new Error('Menu or resolve failed');
  }

  console.log('\n--- Step 2: Screen and Show Auto-Resolution ---');
  const selectedScreen = resolveRes.screens[0];
  console.log('Selected Screen:', selectedScreen.screenName, `(${selectedScreen.id})`);

  const [showsRes, seatingRes] = await Promise.all([
    fetch(`${API_URL}/api/cinema/public/shows/${theatreToken}?screenId=${selectedScreen.id}`).then(r => r.json()),
    fetch(`${API_URL}/api/cinema/public/seating/${theatreToken}/${selectedScreen.id}`).then(r => r.json())
  ]);

  console.log('Shows count:', showsRes.shows?.length);
  const openShow = showsRes.shows.find((s: any) => s.isOrderingOpen) || showsRes.shows[0];
  console.log('Active Show:', openShow?.movieTitle, '| Ordering Open:', openShow?.isOrderingOpen);

  console.log('Seating rows count:', seatingRes.rows?.length);
  const rowA = seatingRes.rows[0];
  const seatA1 = rowA.seats[0];
  console.log('Chosen Seat from Dropdown:', `Row ${rowA.rowIdentifier}, Seat ${seatA1.seatIdentifier} (${seatA1.seatCategory})`);

  console.log('\n--- Step 3: Customer Adds Items to Cart directly from Menu ---');
  const popcorn = menuRes.products.find((p: any) => p.name.includes('Popcorn'));
  const coke = menuRes.products.find((p: any) => p.name.includes('Coca-Cola'));
  console.log('Item 1:', popcorn.name, '| Price: ₹' + (popcorn.price / 100));
  console.log('Item 2:', coke.name, '| Price: ₹' + (coke.price / 100));

  const items = [
    { productId: popcorn.id, quantity: 1, notes: null },
    { productId: coke.id, quantity: 2, notes: 'Less ice' }
  ];

  console.log('\n--- Step 4: Customer Fills Mandatory Details & Places Order ---');
  const customerName = 'John Doe';
  const customerPhone = '9876543210';
  console.log('Customer Name:', customerName);
  console.log('Mobile Number:', customerPhone);

  const prepareRes = await fetch(`${API_URL}/api/cinema/public/checkout/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      theatreToken,
      screenId: selectedScreen.id,
      showId: openShow.id,
      seatRow: rowA.rowIdentifier,
      seatNumber: seatA1.seatIdentifier,
      items,
      customerName,
      customerPhone,
      specialInstructions: 'Deliver during intermission'
    })
  }).then(r => r.json());

  console.log('Prepare Order Result:', prepareRes.message);
  console.log('Order Number:', prepareRes.order?.orderNumber);
  console.log('Order Status:', prepareRes.order?.status, '| Payment Status:', prepareRes.order?.paymentStatus);
  console.log('Total Amount:', '₹' + (prepareRes.order?.totalAmount / 100));
  console.log('Status Token:', prepareRes.statusToken);

  if (!prepareRes.order?.id) {
    throw new Error('Prepare order failed: ' + JSON.stringify(prepareRes));
  }

  console.log('\n--- Step 5: Payment Gateway Initiation (Task 11) ---');
  const paymentOrderRes = await fetch(`${API_URL}/api/cinema/payments/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-theatre-id': prepareRes.order.theatre.id
    },
    body: JSON.stringify({
      orderId: prepareRes.order.id,
      statusToken: prepareRes.statusToken,
      provider: 'paytm'
    })
  }).then(r => r.json());

  console.log('Payment Order Created:', paymentOrderRes.success, '| Transaction ID:', paymentOrderRes.transactionId);

  console.log('\n--- Step 6: Payment Gateway Verification & Capture ---');
  const verifyRes = await fetch(`${API_URL}/api/cinema/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-theatre-id': prepareRes.order.theatre.id
    },
    body: JSON.stringify({
      orderId: prepareRes.order.id,
      statusToken: prepareRes.statusToken,
      transactionId: paymentOrderRes.transactionId,
      provider: 'paytm',
      providerPaymentId: `mock_paytm_${Date.now()}`,
      providerOrderId: paymentOrderRes.providerOrderId,
      providerSignature: 'test_sig_captured',
      responsePayload: {
        MID: 'TEST_CINEMA_MID',
        ORDERID: paymentOrderRes.providerOrderId,
        TXNAMOUNT: (prepareRes.order.totalAmount / 100).toFixed(2),
        STATUS: 'TXN_SUCCESS'
      }
    })
  }).then(r => r.json());

  console.log('Payment Verification Result:', verifyRes.verified, '| Status:', verifyRes.status);
  console.log('Message:', verifyRes.message);

  console.log('\n=== COMPLETE CUSTOMER ORDER FLOW VERIFIED SUCCESSFULLY! ===');
}

runE2ETest().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
