import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  restaurants,
  cinemaProfiles,
  cinemaScreens,
  cinemaMovies,
  cinemaShows,
  cinemaPaymentTransactions,
  cinemaRefunds,
  categories,
  products,
  orders,
  orderItems
} from '@menugo/database';
import { eq, and, inArray, gte, lte, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireCinemaTenant } from '../middleware/tenant-auth';

const router = Router();

// =========================================================================
// Timezone and Date Range Helpers (Task 18 - Requirement 9)
// =========================================================================

/**
 * Formats a given Date instance into 'YYYY-MM-DD' according to the operating timezone of the cinema theatre.
 */
function getOperatingDate(date: Date, timeZone: string = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0]!;
  }
}

/**
 * Calculates start and end timestamps in UTC corresponding to the operating date preset and theatre timezone.
 */
function parseDateRangeBounds(
  dateRange: string = 'all',
  startDateParam?: string,
  endDateParam?: string,
  timeZone: string = 'Asia/Kolkata'
): { start?: Date; end?: Date } {
  const now = new Date();
  const todayStr = getOperatingDate(now, timeZone);

  if (dateRange === 'today') {
    const start = new Date(`${todayStr}T00:00:00`);
    const end = new Date(`${todayStr}T23:59:59.999`);
    const offsetMs = getTimezoneOffsetMs(todayStr, timeZone);
    return {
      start: new Date(start.getTime() - offsetMs),
      end: new Date(end.getTime() - offsetMs)
    };
  }

  if (dateRange === 'yesterday') {
    const yesterdayDate = new Date(now.getTime() - 86400000);
    const yStr = getOperatingDate(yesterdayDate, timeZone);
    const start = new Date(`${yStr}T00:00:00`);
    const end = new Date(`${yStr}T23:59:59.999`);
    const offsetMs = getTimezoneOffsetMs(yStr, timeZone);
    return {
      start: new Date(start.getTime() - offsetMs),
      end: new Date(end.getTime() - offsetMs)
    };
  }

  if (dateRange === '7d') {
    return {
      start: new Date(now.getTime() - 7 * 86400000),
      end: now
    };
  }

  if (dateRange === '30d') {
    return {
      start: new Date(now.getTime() - 30 * 86400000),
      end: now
    };
  }

  if (startDateParam || endDateParam) {
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDateParam) {
      const sIso = startDateParam.includes('T') ? startDateParam : `${startDateParam}T00:00:00`;
      const sDate = new Date(sIso);
      if (!isNaN(sDate.getTime())) start = sDate;
    }

    if (endDateParam) {
      const eIso = endDateParam.includes('T') ? endDateParam : `${endDateParam}T23:59:59.999`;
      const eDate = new Date(eIso);
      if (!isNaN(eDate.getTime())) end = eDate;
    }

    return { start, end };
  }

  return {};
}

function getTimezoneOffsetMs(dateStr: string, timeZone: string): number {
  try {
    const utcDate = new Date(`${dateStr}T12:00:00Z`);
    const tzStr = utcDate.toLocaleString('en-US', { timeZone, hour12: false });
    const tzDate = new Date(tzStr);
    return tzDate.getTime() - utcDate.getTime();
  } catch {
    return 5.5 * 3600000; // Default +05:30 (India Standard Time)
  }
}

// =========================================================================
// Central Report Aggregation Engine (Task 18 - Requirement 9 & 10)
// =========================================================================

interface ReportFilterParams {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  screenId?: string;
  movieId?: string;
  showId?: string;
  provider?: string;
  status?: string;
}

async function computeCinemaReportData(theatreId: string, filters: ReportFilterParams) {
  // 1. Fetch Theatre Profile (Timezone & Currency)
  const profileRows = await db
    .select({
      timezone: cinemaProfiles.timezone,
      currency: cinemaProfiles.currency,
      theatreName: cinemaProfiles.theatreName
    })
    .from(cinemaProfiles)
    .where(eq(cinemaProfiles.theatreId, theatreId))
    .limit(1);

  const theatreTimeZone = profileRows[0]?.timezone || 'Asia/Kolkata';
  const currency = profileRows[0]?.currency || 'INR';
  const theatreName = profileRows[0]?.theatreName || 'Cinema Theatre';

  // 2. Parse Date Bounds
  const { start: startDateBound, end: endDateBound } = parseDateRangeBounds(
    filters.dateRange,
    filters.startDate,
    filters.endDate,
    theatreTimeZone
  );

  // 3. Build Query Conditions for Orders (strictly isolated to theatre and orderType='cinema')
  const orderConditions = [
    eq(orders.restaurantId, theatreId),
    eq(orders.orderType, 'cinema')
  ];

  if (startDateBound) {
    orderConditions.push(gte(orders.createdAt, startDateBound));
  }
  if (endDateBound) {
    orderConditions.push(lte(orders.createdAt, endDateBound));
  }

  if (filters.screenId && filters.screenId !== 'all') {
    orderConditions.push(eq(orders.screenId, filters.screenId));
  }
  if (filters.movieId && filters.movieId !== 'all') {
    orderConditions.push(eq(orders.movieId, filters.movieId));
  }
  if (filters.showId && filters.showId !== 'all') {
    orderConditions.push(eq(orders.showId, filters.showId));
  }
  if (filters.provider && filters.provider !== 'all') {
    orderConditions.push(eq(orders.paymentMethod, filters.provider));
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'delivered') {
      orderConditions.push(inArray(orders.status, ['delivered', 'served']));
    } else if (filters.status === 'cancelled') {
      orderConditions.push(inArray(orders.status, ['cancelled', 'rejected']));
    } else if (filters.status === 'open') {
      orderConditions.push(
        inArray(orders.status, [
          'new',
          'confirmed',
          'accepted',
          'preparing',
          'ready',
          'assigned_for_delivery'
        ])
      );
    } else {
      orderConditions.push(eq(orders.status, filters.status));
    }
  }

  // 4. Fetch Matching Orders, Screens, Movies, Shows, Transactions & Refunds in parallel
  const [matchingOrders, allScreens, allMovies, allShows, allRefunds, allTransactions] =
    await Promise.all([
      db
        .select()
        .from(orders)
        .where(and(...orderConditions))
        .orderBy(desc(orders.createdAt)),
      db.select().from(cinemaScreens).where(eq(cinemaScreens.theatreId, theatreId)),
      db.select().from(cinemaMovies).where(eq(cinemaMovies.theatreId, theatreId)),
      db.select().from(cinemaShows).where(eq(cinemaShows.theatreId, theatreId)),
      db.select().from(cinemaRefunds).where(eq(cinemaRefunds.theatreId, theatreId)),
      db
        .select()
        .from(cinemaPaymentTransactions)
        .where(eq(cinemaPaymentTransactions.theatreId, theatreId))
    ]);

  const matchingOrderIds = matchingOrders.map((o) => o.id);

  // 5. Fetch Order Items for product-wise reports (only for orders that match)
  const matchingItems =
    matchingOrderIds.length > 0
      ? await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            subtotal: orderItems.subtotal
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, matchingOrderIds))
      : [];

  // Map products and categories for category enrichment
  const productCategoryRows =
    matchingItems.length > 0
      ? await db
          .select({
            productId: products.id,
            productName: products.name,
            categoryName: categories.name
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(eq(products.restaurantId, theatreId))
      : [];

  const categoryByProductId = new Map(
    productCategoryRows.map((r) => [r.productId, r.categoryName || 'Cinema Snacks'])
  );

  // Lookup maps for fast joining
  const screenMap = new Map(allScreens.map((s) => [s.id, s]));
  const movieMap = new Map(allMovies.map((m) => [m.id, m]));
  const showMap = new Map(allShows.map((s) => [s.id, s]));

  // Associate refunds to orders
  const refundsByOrderId = new Map<string, typeof allRefunds>();
  let totalProcessedRefundsPaise = 0;

  for (const ref of allRefunds) {
    const isProcessed =
      ref.status === 'processed' ||
      ref.status === 'REFUND_PROCESSED' ||
      ref.status === 'success';

    if (ref.orderId) {
      const list = refundsByOrderId.get(ref.orderId) || [];
      list.push(ref);
      refundsByOrderId.set(ref.orderId, list);
    }

    // Only count processed refunds within the filtered order set (or theatre scope if all)
    if (isProcessed) {
      if (matchingOrderIds.length === 0 && matchingOrders.length > 0) {
        // No match
      } else if (matchingOrderIds.length > 0) {
        if (ref.orderId && matchingOrderIds.includes(ref.orderId)) {
          totalProcessedRefundsPaise += ref.amount;
        }
      } else {
        totalProcessedRefundsPaise += ref.amount;
      }
    }
  }

  // =========================================================================
  // Calculation 1: Summary Metrics (Requirement 1 & 9)
  // =========================================================================
  const totalOrdersCount = matchingOrders.length;
  let grossSalesPaise = 0;
  let paidOrdersCount = 0;
  let deliveredOrdersCount = 0;
  let cancelledOrdersCount = 0;

  let capturedPaise = 0;
  let capturedCount = 0;
  let pendingPaise = 0;
  let pendingCount = 0;
  let failedPaise = 0;
  let failedCount = 0;

  let fulfilmentNew = 0;
  let fulfilmentAccepted = 0;
  let fulfilmentPreparing = 0;
  let fulfilmentReady = 0;
  let fulfilmentAssigned = 0;
  let fulfilmentDelivered = 0;
  let fulfilmentCancelled = 0;

  for (const order of matchingOrders) {
    const isPaid = order.paymentStatus === 'paid';
    if (isPaid) {
      grossSalesPaise += order.totalAmount;
      paidOrdersCount++;
    }

    // Payment Status Aggregation
    if (order.paymentStatus === 'paid') {
      capturedPaise += order.totalAmount;
      capturedCount++;
    } else if (order.paymentStatus === 'pending') {
      pendingPaise += order.totalAmount;
      pendingCount++;
    } else if (order.paymentStatus === 'failed') {
      failedPaise += order.totalAmount;
      failedCount++;
    }

    // Fulfilment Status Aggregation
    if (order.status === 'new' || order.status === 'confirmed') {
      fulfilmentNew++;
    } else if (order.status === 'accepted') {
      fulfilmentAccepted++;
    } else if (order.status === 'preparing') {
      fulfilmentPreparing++;
    } else if (order.status === 'ready') {
      fulfilmentReady++;
    } else if (
      order.status === 'assigned_for_delivery' ||
      order.deliveryStatus === 'assigned'
    ) {
      fulfilmentAssigned++;
    }

    if (
      order.status === 'delivered' ||
      order.status === 'served' ||
      order.deliveryStatus === 'delivered'
    ) {
      deliveredOrdersCount++;
      fulfilmentDelivered++;
    } else if (order.status === 'cancelled' || order.status === 'rejected') {
      cancelledOrdersCount++;
      fulfilmentCancelled++;
    }
  }

  const netSalesPaise = Math.max(0, grossSalesPaise - totalProcessedRefundsPaise);
  const avgOrderValuePaise =
    paidOrdersCount > 0 ? Math.round(grossSalesPaise / paidOrdersCount) : 0;
  const deliveryRate =
    totalOrdersCount > 0 ? Number(((deliveredOrdersCount / totalOrdersCount) * 100).toFixed(1)) : 0;
  const cancellationRate =
    totalOrdersCount > 0 ? Number(((cancelledOrdersCount / totalOrdersCount) * 100).toFixed(1)) : 0;

  const summary = {
    totalOrders: totalOrdersCount,
    paidOrders: paidOrdersCount,
    grossSales: grossSalesPaise,
    totalRefunds: totalProcessedRefundsPaise,
    netSales: netSalesPaise,
    avgOrderValue: avgOrderValuePaise,
    averageOrderValue: avgOrderValuePaise,
    deliveredOrders: deliveredOrdersCount,
    cancelledOrders: cancelledOrdersCount,
    deliveryRate,
    cancellationRate,
    paymentSummary: {
      paid: capturedCount,
      captured: { count: capturedCount, amount: capturedPaise },
      pending: { count: pendingCount, amount: pendingPaise },
      failed: { count: failedCount, amount: failedPaise },
      refunded: {
        count: allRefunds.filter(
          (r) =>
            r.status === 'processed' ||
            r.status === 'REFUND_PROCESSED' ||
            r.status === 'success'
        ).length,
        amount: totalProcessedRefundsPaise
      }
    },
    fulfilmentSummary: {
      new: fulfilmentNew,
      accepted: fulfilmentAccepted,
      preparing: fulfilmentPreparing,
      ready: fulfilmentReady,
      assigned: fulfilmentAssigned,
      delivered: fulfilmentDelivered,
      cancelled: fulfilmentCancelled
    }
  };

  // =========================================================================
  // Calculation 2: Daily Sales Reports (Requirement 2 & 9)
  // =========================================================================
  const dailyAggregationMap = new Map<
    string,
    {
      date: string;
      totalOrders: number;
      paidOrders: number;
      grossSales: number;
      refunds: number;
      netSales: number;
      deliveredOrders: number;
      cancelledOrders: number;
    }
  >();

  for (const order of matchingOrders) {
    const opDate = getOperatingDate(new Date(order.createdAt), theatreTimeZone);
    let entry = dailyAggregationMap.get(opDate);
    if (!entry) {
      entry = {
        date: opDate,
        totalOrders: 0,
        paidOrders: 0,
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
      };
      dailyAggregationMap.set(opDate, entry);
    }

    entry.totalOrders++;
    if (order.paymentStatus === 'paid') {
      entry.paidOrders++;
      entry.grossSales += order.totalAmount;
    }

    if (
      order.status === 'delivered' ||
      order.status === 'served' ||
      order.deliveryStatus === 'delivered'
    ) {
      entry.deliveredOrders++;
    } else if (order.status === 'cancelled' || order.status === 'rejected') {
      entry.cancelledOrders++;
    }

    const orderRefunds = refundsByOrderId.get(order.id) || [];
    for (const ref of orderRefunds) {
      if (
        ref.status === 'processed' ||
        ref.status === 'REFUND_PROCESSED' ||
        ref.status === 'success'
      ) {
        entry.refunds += ref.amount;
      }
    }
  }

  // Calculate netSales and average for each date entry
  const dailySales = Array.from(dailyAggregationMap.values())
    .map((d) => ({
      ...d,
      operatingDate: d.date,
      orderCount: d.totalOrders,
      netSales: Math.max(0, d.grossSales - d.refunds),
      avgOrderValue: d.paidOrders > 0 ? Math.round(d.grossSales / d.paidOrders) : 0
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // =========================================================================
  // Calculation 3: Screen-Wise Reports (Requirement 3)
  // =========================================================================
  const screenAggregationMap = new Map<
    string,
    {
      screenId: string;
      screenName: string;
      screenType: string;
      totalOrders: number;
      paidOrders: number;
      grossSales: number;
      refunds: number;
      netSales: number;
      deliveredOrders: number;
      cancelledOrders: number;
    }
  >();

  // Initialize with all screens of theatre
  for (const sc of allScreens) {
    screenAggregationMap.set(sc.id, {
      screenId: sc.id,
      screenName: sc.screenName,
      screenType: sc.screenType,
      totalOrders: 0,
      paidOrders: 0,
      grossSales: 0,
      refunds: 0,
      netSales: 0,
      deliveredOrders: 0,
      cancelledOrders: 0
    });
  }

  for (const order of matchingOrders) {
    if (!order.screenId) continue;
    let entry = screenAggregationMap.get(order.screenId);
    if (!entry) {
      const sc = screenMap.get(order.screenId);
      entry = {
        screenId: order.screenId,
        screenName: sc?.screenName || 'Unknown Screen',
        screenType: sc?.screenType || 'standard',
        totalOrders: 0,
        paidOrders: 0,
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
      };
      screenAggregationMap.set(order.screenId, entry);
    }

    entry.totalOrders++;
    if (order.paymentStatus === 'paid') {
      entry.paidOrders++;
      entry.grossSales += order.totalAmount;
    }

    if (
      order.status === 'delivered' ||
      order.status === 'served' ||
      order.deliveryStatus === 'delivered'
    ) {
      entry.deliveredOrders++;
    } else if (order.status === 'cancelled' || order.status === 'rejected') {
      entry.cancelledOrders++;
    }

    const orderRefunds = refundsByOrderId.get(order.id) || [];
    for (const ref of orderRefunds) {
      if (
        ref.status === 'processed' ||
        ref.status === 'REFUND_PROCESSED' ||
        ref.status === 'success'
      ) {
        entry.refunds += ref.amount;
      }
    }
  }

  const screenReports = Array.from(screenAggregationMap.values())
    .map((sc) => {
      const net = Math.max(0, sc.grossSales - sc.refunds);
      const contribution =
        grossSalesPaise > 0
          ? Number(((sc.grossSales / grossSalesPaise) * 100).toFixed(1))
          : 0;
      return {
        ...sc,
        netSales: net,
        salesContribution: contribution,
        contributionPercent: contribution
      };
    })
    .sort((a, b) => b.grossSales - a.grossSales);

  // =========================================================================
  // Calculation 4: Show-Wise Reports (Requirement 4)
  // =========================================================================
  const showAggregationMap = new Map<
    string,
    {
      showId: string;
      movieId: string | null;
      movieTitle: string;
      screenId: string | null;
      screenName: string;
      showDate: string;
      showtime: string;
      totalOrders: number;
      paidOrders: number;
      grossSales: number;
      refunds: number;
      netSales: number;
      deliveredOrders: number;
      cancelledOrders: number;
    }
  >();

  for (const order of matchingOrders) {
    if (!order.showId) continue;
    let entry = showAggregationMap.get(order.showId);
    if (!entry) {
      const show = showMap.get(order.showId);
      const movie = order.movieId ? movieMap.get(order.movieId) : null;
      const screen = order.screenId ? screenMap.get(order.screenId) : null;

      let formattedShowtime = order.showtime || '';
      if (!formattedShowtime && show?.startTime) {
        formattedShowtime = show.startTime.toISOString().substring(11, 19);
      }

      entry = {
        showId: order.showId,
        movieId: order.movieId || show?.movieId || null,
        movieTitle: movie?.title || 'Screening',
        screenId: order.screenId || show?.screenId || null,
        screenName: screen?.screenName || 'Screen',
        showDate: order.showDate || show?.showDate || '',
        showtime: formattedShowtime,
        totalOrders: 0,
        paidOrders: 0,
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
      };
      showAggregationMap.set(order.showId, entry);
    }

    entry.totalOrders++;
    if (order.paymentStatus === 'paid') {
      entry.paidOrders++;
      entry.grossSales += order.totalAmount;
    }

    if (
      order.status === 'delivered' ||
      order.status === 'served' ||
      order.deliveryStatus === 'delivered'
    ) {
      entry.deliveredOrders++;
    } else if (order.status === 'cancelled' || order.status === 'rejected') {
      entry.cancelledOrders++;
    }

    const orderRefunds = refundsByOrderId.get(order.id) || [];
    for (const ref of orderRefunds) {
      if (
        ref.status === 'processed' ||
        ref.status === 'REFUND_PROCESSED' ||
        ref.status === 'success'
      ) {
        entry.refunds += ref.amount;
      }
    }
  }

  const showReports = Array.from(showAggregationMap.values())
    .map((sh) => ({
      ...sh,
      netSales: Math.max(0, sh.grossSales - sh.refunds)
    }))
    .sort((a, b) => b.grossSales - a.grossSales);

  // =========================================================================
  // Calculation 5: Product-Wise Reports (Requirement 5)
  // =========================================================================
  const productAggregationMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      categoryName: string;
      quantitySold: number;
      totalRevenue: number;
      orderCount: number;
    }
  >();

  // Only aggregate items from paid/confirmed orders
  const paidOrderIdsSet = new Set(
    matchingOrders.filter((o) => o.paymentStatus === 'paid').map((o) => o.id)
  );

  let totalFoodRevenuePaise = 0;

  for (const item of matchingItems) {
    if (!paidOrderIdsSet.has(item.orderId)) continue;

    const prodId = item.productId || item.productName;
    let entry = productAggregationMap.get(prodId);
    if (!entry) {
      entry = {
        productId: item.productId || '',
        productName: item.productName,
        categoryName: item.productId
          ? categoryByProductId.get(item.productId) || 'Cinema Snacks'
          : 'Cinema Snacks',
        quantitySold: 0,
        totalRevenue: 0,
        orderCount: 0
      };
      productAggregationMap.set(prodId, entry);
    }

    entry.quantitySold += item.quantity;
    entry.totalRevenue += item.subtotal;
    entry.orderCount++;
    totalFoodRevenuePaise += item.subtotal;
  }

  const productReports = Array.from(productAggregationMap.values())
    .map((p) => {
      const contribution =
        totalFoodRevenuePaise > 0
          ? Number(((p.totalRevenue / totalFoodRevenuePaise) * 100).toFixed(1))
          : 0;
      const avgPrice =
        p.quantitySold > 0 ? Math.round(p.totalRevenue / p.quantitySold) : 0;
      return {
        ...p,
        salesContribution: contribution,
        avgPrice
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // =========================================================================
  // Calculation 6: Payment Reports (Requirement 6)
  // =========================================================================
  const paymentProviderStats = {
    razorpay: {
      provider: 'razorpay',
      totalCount: 0,
      capturedCount: 0,
      capturedAmount: 0,
      failedCount: 0,
      failedAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      refundCount: 0,
      refundAmount: 0,
      netSettlement: 0
    },
    paytm: {
      provider: 'paytm',
      totalCount: 0,
      capturedCount: 0,
      capturedAmount: 0,
      failedCount: 0,
      failedAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      refundCount: 0,
      refundAmount: 0,
      netSettlement: 0
    }
  };

  for (const tx of allTransactions) {
    const p = (tx.provider || '').toLowerCase() as 'razorpay' | 'paytm';
    const target = paymentProviderStats[p];
    if (!target) continue;

    target.totalCount++;
    if (tx.status === 'captured') {
      target.capturedCount++;
      target.capturedAmount += tx.amount;
    } else if (tx.status === 'failed') {
      target.failedCount++;
      target.failedAmount += tx.amount;
    } else if (
      tx.status === 'pending' ||
      tx.status === 'authorized' ||
      tx.status === 'initiated' ||
      tx.status === 'created'
    ) {
      target.pendingCount++;
      target.pendingAmount += tx.amount;
    }
  }

  for (const ref of allRefunds) {
    const p = (ref.provider || '').toLowerCase() as 'razorpay' | 'paytm';
    const target = paymentProviderStats[p];
    if (!target) continue;

    const isProcessed =
      ref.status === 'processed' ||
      ref.status === 'REFUND_PROCESSED' ||
      ref.status === 'success';

    if (isProcessed) {
      target.refundCount++;
      target.refundAmount += ref.amount;
    }
  }

  paymentProviderStats.razorpay.netSettlement = Math.max(
    0,
    paymentProviderStats.razorpay.capturedAmount - paymentProviderStats.razorpay.refundAmount
  );
  paymentProviderStats.paytm.netSettlement = Math.max(
    0,
    paymentProviderStats.paytm.capturedAmount - paymentProviderStats.paytm.refundAmount
  );

  const formattedProviders = [
    {
      ...paymentProviderStats.razorpay,
      grossCapturedAmount: paymentProviderStats.razorpay.capturedAmount,
      refundedAmount: paymentProviderStats.razorpay.refundAmount
    },
    {
      ...paymentProviderStats.paytm,
      grossCapturedAmount: paymentProviderStats.paytm.capturedAmount,
      refundedAmount: paymentProviderStats.paytm.refundAmount
    }
  ];

  return {
    theatreId,
    theatreName,
    timezone: theatreTimeZone,
    currency,
    filters: {
      dateRange: filters.dateRange || 'all',
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      screenId: filters.screenId || 'all',
      movieId: filters.movieId || 'all',
      showId: filters.showId || 'all',
      provider: filters.provider || 'all',
      status: filters.status || 'all'
    },
    summary,
    dailySales,
    screenReports,
    showReports,
    productReports,
    paymentReports: {
      providers: formattedProviders,
      summary: summary.paymentSummary,
      totalNetSettlement:
        paymentProviderStats.razorpay.netSettlement + paymentProviderStats.paytm.netSettlement
    },
    fulfilmentReports: {
      ...summary.fulfilmentSummary,
      stages: [
        { status: 'new', count: summary.fulfilmentSummary.new },
        { status: 'accepted', count: summary.fulfilmentSummary.accepted },
        { status: 'preparing', count: summary.fulfilmentSummary.preparing },
        { status: 'ready', count: summary.fulfilmentSummary.ready },
        { status: 'assigned', count: summary.fulfilmentSummary.assigned },
        { status: 'delivered', count: summary.fulfilmentSummary.delivered },
        { status: 'cancelled', count: summary.fulfilmentSummary.cancelled }
      ]
    }
  };
}

// =========================================================================
// API Endpoints
// =========================================================================

/**
 * GET /api/cinema/reports
 * Complete consolidated cinema reports payload supporting all multi-dimension filters.
 */
router.get(
  '/',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const filters: ReportFilterParams = {
        dateRange: req.query.dateRange as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        screenId: req.query.screenId as string,
        movieId: req.query.movieId as string,
        showId: req.query.showId as string,
        provider: req.query.provider as string,
        status: req.query.status as string
      };

      const reportData = await computeCinemaReportData(theatreId, filters);

      res.json({
        success: true,
        ...reportData
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/summary
 * Returns overview summary KPIs and status breakdown.
 */
router.get(
  '/summary',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        timezone: reportData.timezone,
        summary: reportData.summary
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/daily
 * Sales grouped by operating date according to theatre timezone.
 */
router.get(
  '/daily',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        timezone: reportData.timezone,
        dailySales: reportData.dailySales
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/screens
 * Food sales comparison across cinema screens.
 */
router.get(
  '/screens',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        screenReports: reportData.screenReports
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/shows
 * Order counts and sales for individual movie shows.
 */
router.get(
  '/shows',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        showReports: reportData.showReports
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/products
 * Product sales, quantity sold, total revenue, and contribution percentage.
 */
router.get(
  '/products',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        productReports: reportData.productReports
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/payments
 * Razorpay vs Paytm transaction status breakdown and refund reconciliation.
 */
router.get(
  '/payments',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        currency: reportData.currency,
        paymentReports: reportData.paymentReports
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cinema/reports/fulfilment
 * Order fulfilment metrics across lifecycle stages.
 */
router.get(
  '/fulfilment',
  requireAuth,
  requireCinemaTenant(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const theatreId = req.tenant!.restaurantId;
      const reportData = await computeCinemaReportData(theatreId, req.query as ReportFilterParams);
      res.json({
        success: true,
        theatreId,
        fulfilmentReports: reportData.fulfilmentReports,
        deliveryRate: reportData.summary.deliveryRate,
        cancellationRate: reportData.summary.cancellationRate
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
