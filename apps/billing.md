# CRITICAL REQUIREMENT — STRICT TENANT COST ISOLATION

This requirement is mandatory for THE QR OS billing engine.

Restaurant A must NEVER pay for Restaurant B's infrastructure usage.

Restaurant B must NEVER pay for Restaurant A's infrastructure usage.

Cinema A must NEVER pay for another cinema's infrastructure usage.

Restaurants must NEVER pay for cinema infrastructure usage, and cinemas must NEVER pay for restaurant infrastructure usage.

## 1. Tenant-level cost attribution

Every usage event must be associated with exactly one tenant wherever technically attributable.

Every tenant must have an independent cost ledger.

The billing engine must calculate:

TENANT_TOTAL_COST =
DIRECT_TENANT_COST +
TENANT_SHARE_OF_SHARED_INFRASTRUCTURE

CUSTOMER_CHARGE =
TENANT_TOTAL_COST / 0.30

GROSS_MARGIN =
(CUSTOMER_CHARGE - TENANT_TOTAL_COST) / CUSTOMER_CHARGE

The minimum gross margin must be 70% for every tenant independently.

Never calculate the customer price using another tenant's infrastructure consumption.

## 2. Shared infrastructure allocation

When infrastructure is shared, calculate each tenant's consumption independently.

Use appropriate metrics:

- CPU milliseconds for compute.
- Memory consumption over time where measurable.
- Database workload attribution.
- Storage GB-hours.
- Network egress bytes.
- WebSocket connection-seconds and attributable compute.
- Background worker execution resources.

Allocate each shared cost pool proportionally using the relevant measured consumption.

Example:

Shared API cost = ₹100.

Restaurant A usage = 20%.
Restaurant B usage = 70%.
Cinema A usage = 10%.

Allocate:

Restaurant A = ₹20.
Restaurant B = ₹70.
Cinema A = ₹10.

The sum of all tenant allocations must never exceed or duplicate the original shared cost.

## 3. Unattributed costs

If an infrastructure expense cannot be accurately attributed:

- Mark it as UNALLOCATED.
- Store the reason.
- Display it in Super Admin.
- Do not silently distribute it equally.
- Do not charge an arbitrary tenant.
- Do not hide it from financial reports.

Provide an administrative workflow for investigating and resolving unallocated expenses.

## 4. Database isolation and access control

Every tenant-level usage query, cost allocation and invoice query must be scoped by the authenticated tenant ID.

Never trust a tenant ID submitted by the frontend.

Restaurant users can access only their restaurant billing records.

Cinema users can access only their cinema billing records.

Only authorized Super Admins can inspect global billing records.

Implement database constraints, authorization checks and tests for cross-tenant access.

## 5. Billing validation

Before finalizing each tenant invoice:

- Confirm every allocated cost belongs to that tenant or is a legitimate share of a shared resource.
- Confirm no provider cost record has been allocated more than once.
- Confirm all allocations reconcile against the relevant provider cost pool.
- Confirm the tenant's margin is at least 70%.
- Confirm no other tenant's direct usage has entered the calculation.

Reject invoice generation if these validations fail.

## 6. Required automated tests

Test:

1. Restaurant A cannot see Restaurant B's usage.
2. Restaurant A cannot see Restaurant B's invoices.
3. Restaurant A cannot be charged for Restaurant B's direct infrastructure cost.
4. Cinema A cannot be charged for restaurant usage.
5. Shared costs are allocated by measured consumption.
6. Unattributed costs remain unallocated.
7. Duplicate provider costs cannot be allocated twice.
8. Each tenant independently achieves at least 70% gross margin.
9. Cross-tenant API requests are rejected.
10. All tenant allocations reconcile with the original provider costs.

This requirement takes priority over convenience, equal allocation or simplified billing calculations.