import { recordTenantUsageEvent } from './billing-engine';

export interface OrderUsageParams {
  restaurantId: string;
  tenantType: 'restaurant' | 'cinema';
  orderId: string;
  totalAmount?: number;
  itemCount?: number;
}

export interface MenuBrowseUsageParams {
  restaurantId: string;
  tenantType?: 'restaurant' | 'cinema';
  action: 'view' | 'scroll';
  scrollDepth?: number;
  metadata?: Record<string, any>;
}

export interface AdminActionUsageParams {
  restaurantId: string;
  tenantType: 'restaurant' | 'cinema';
  method: string;
  path: string;
  userEmail?: string;
}

/**
 * Tracks usage incurred when a customer places an order
 */
export async function trackOrderUsage(params: OrderUsageParams): Promise<void> {
  try {
    // 1. Transactional DB queries for order snapshotting and item insertions
    await recordTenantUsageEvent({
      restaurantId: params.restaurantId,
      tenantType: params.tenantType,
      eventType: 'order_placement',
      unit: 'db_queries',
      quantity: 6,
      directCostPaise: 25, // ₹0.25 per order placement
      metadata: {
        orderId: params.orderId,
        totalAmount: params.totalAmount,
        itemCount: params.itemCount
      }
    });

    // 2. Compute execution for order serialization and realtime websocket dispatch
    await recordTenantUsageEvent({
      restaurantId: params.restaurantId,
      tenantType: params.tenantType,
      eventType: 'compute_cpu',
      unit: 'cpu_ms',
      quantity: 150,
      directCostPaise: 15, // ₹0.15 compute cost
      metadata: { orderId: params.orderId }
    });
  } catch (err) {
    console.error('[Usage Tracking Error - Order Placement]:', err);
  }
}

/**
 * Tracks usage incurred when active customers browse or scroll through the menu
 */
export async function trackMenuBrowseUsage(params: MenuBrowseUsageParams): Promise<void> {
  try {
    const tenantType = params.tenantType || 'restaurant';

    if (params.action === 'view') {
      // Menu data delivery egress
      await recordTenantUsageEvent({
        restaurantId: params.restaurantId,
        tenantType,
        eventType: 'menu_browse',
        unit: 'egress_bytes',
        quantity: 48000, // ~48 KB JSON & layout payload
        directCostPaise: 5, // ₹0.05 per menu view
        metadata: { action: 'menu_view', ...params.metadata }
      });
    } else if (params.action === 'scroll') {
      // Active user interactive scrolling compute / presence
      await recordTenantUsageEvent({
        restaurantId: params.restaurantId,
        tenantType,
        eventType: 'menu_scroll',
        unit: 'cpu_ms',
        quantity: 40,
        directCostPaise: 2, // ₹0.02 per active scroll heartbeat
        metadata: { action: 'menu_scroll', scrollDepth: params.scrollDepth, ...params.metadata }
      });
    }
  } catch (err) {
    console.error('[Usage Tracking Error - Menu Browse]:', err);
  }
}

/**
 * Tracks usage incurred when an admin makes changes (menu, tables, staff, screens, status updates)
 */
export async function trackAdminActionUsage(params: AdminActionUsageParams): Promise<void> {
  try {
    await recordTenantUsageEvent({
      restaurantId: params.restaurantId,
      tenantType: params.tenantType,
      eventType: 'admin_mutation',
      unit: 'worker_execution_ms',
      quantity: 75,
      directCostPaise: 15, // ₹0.15 per admin mutation
      metadata: {
        method: params.method,
        path: params.path,
        userEmail: params.userEmail
      }
    });
  } catch (err) {
    console.error('[Usage Tracking Error - Admin Mutation]:', err);
  }
}
