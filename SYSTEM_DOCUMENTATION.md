# System Documentation — Inventory & Sales Management System

**Version:** 0.1.0 · **Last updated:** 2026-08-29 · **Scope:** entire codebase as currently implemented (no aspirational/planned features included)

This document is the single source of truth for this system: what it does, who can do what, how it's built, and how to run it. It was produced by directly inspecting the codebase (routes, server actions, Prisma schema, permission logic, API routes) rather than from assumptions.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Complete Feature List](#2-complete-feature-list)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Admin Guide](#4-admin-guide)
5. [Normal User (Staff) Guide](#5-normal-user-staff-guide)
6. [Pages & Navigation](#6-pages--navigation)
7. [Main Workflows](#7-main-workflows)
8. [Technical Overview](#8-technical-overview)
9. [Backend & API](#9-backend--api)
10. [Troubleshooting](#10-troubleshooting)
11. [Known Issues / Implementation Gaps](#11-known-issues--implementation-gaps)

---

## 1. System Overview

### What it is

The application now contains only the staff dashboard (`/dashboard/**`) and cashier workspace (`/caisse/**`), with `/login` and `/choose` supporting authentication and workspace selection. `/` redirects to `/choose`. The public storefront, catalog pages, shopping cart, and public checkout action have been removed; their former URLs return 404. Staff order management remains available in the dashboard.

An Arabic-first (RTL, with English/French support), full-stack inventory + sales management system built on Next.js — an internal admin dashboard (`/dashboard/**`) for staff to manage products, stock, customers, sales, purchasing, suppliers, expenses, and reporting.

### Main purpose

Run the day-to-day operations of a small-to-mid-size retail/wholesale business: track stock, record sales as invoices, manage customer accounts and balances/debt, manage supplier purchase orders and payments, handle sales/purchase returns, and report on all of the above.

### Who uses it

**Store staff/admins** — logged-in users under `/dashboard/**`, each with a role that grants specific permissions.

### Main modules

Products & Catalog, Inventory, Customers, Orders, Invoices (sales), Suppliers, Purchases, Sales/Purchase Returns, Expenses, Reports, and Admin Settings (Users, Roles & Permissions, Appearance).

### High-level workflow

```
Admin creates an Order in the dashboard (or an Invoice directly)
                                     │
                                     ▼
Invoice tracks payment (cash/card/etc. or customer balance) → updates customer balance/debt
                                     │
                                     ▼
Selling reduces stock (InventoryMovement) → low stock triggers restocking
                                     │
                                     ▼
Staff creates a Purchase Order from a Supplier → receiving it increases stock
                                     │
                                     ▼
Reports & the Dashboard summarize sales, purchases, stock, customers, suppliers over any period
```

---

## 2. Complete Feature List

Every feature below was confirmed to exist in the codebase (route + server action + permission gate). "Permission" is the `PermissionKey` enum value checked before the action/page runs — see [Section 3](#3-user-roles--permissions) for the full list.

### 2.1 Products & Catalog

| Feature         | What it does                                                                                                                                                                                           | Permission                                                          | UI location                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Product CRUD    | Create/edit/delete products: name, SKU, barcode, category, brand, quantity, min stock level, 3 price tiers (price1/2/3), purchase price (cost), weight, status (Active/Inactive), up to several images | `PRODUCTS_VIEW` (list/view), `PRODUCTS_MANAGE` (create/edit/delete) | `/dashboard/products`, `/dashboard/products/[id]`     |
| Bulk delete     | Select multiple products and delete them together (password-confirmed)                                                                                                                                 | `PRODUCTS_MANAGE`                                                   | Products list, checkbox selection                     |
| Barcode lookup  | Find a product by scanning/typing its barcode (used throughout invoices, orders, purchases, inventory)                                                                                                 | `PRODUCTS_VIEW`                                                     | Barcode scanner control embedded in several forms     |
| Image upload    | Product photos uploaded directly to Cloudinary from the browser (signed upload)                                                                                                                        | `PRODUCTS_MANAGE`                                                   | Product create/edit form                              |
| Bulk import     | Upload an `.xlsx` file to create/update many products at once; streams progress back live (NDJSON)                                                                                                     | `PRODUCTS_MANAGE`                                                   | Products page import action                           |
| Categories CRUD | Hierarchical categories (a category can have a parent), each with a slug and optional image                                                                                                            | `PRODUCTS_VIEW`/`PRODUCTS_MANAGE`                                   | `/dashboard/categories`, `/dashboard/categories/[id]` |
| Brands CRUD     | Brand name, slug, logo                                                                                                                                                                                 | `PRODUCTS_VIEW`/`PRODUCTS_MANAGE`                                   | `/dashboard/brands`, `/dashboard/brands/[id]`         |

### 2.2 Inventory

| Feature                    | What it does                                                                                                                                                          | Permission         | UI location                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------- |
| Record inventory movement  | Manually record IN, OUT, or ADJUSTMENT stock movements for a product with a reason/reference                                                                          | `INVENTORY_MANAGE` | `/dashboard/inventory`           |
| Low-stock table            | Lists products at/under their `minStockLevel`; each row can jump straight into "record movement" pre-filled for that product, or open the product's profile           | `INVENTORY_VIEW`   | `/dashboard/inventory`           |
| Movement history           | `InventoryMovement` records (IN/OUT/ADJUSTMENT/SALE_RETURN/PURCHASE_RETURN) are written automatically by sales, purchases, and returns, in addition to manual entries | `INVENTORY_VIEW`   | Inventory page / product profile |
| Damaged/defective tracking | Product carries `damagedQuantity`/`defectiveQuantity` counters, populated by the returns flow                                                                         | `INVENTORY_VIEW`   | Product profile                  |

### 2.3 Customers

| Feature                                       | What it does                                                                                                                                                                                                                           | Permission                                           | UI location                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Customer CRUD                                 | Name, phone, email, address, notes, favorite flag                                                                                                                                                                                      | `CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE`                  | `/dashboard/customers`, `/dashboard/customers/[id]` |
| Duplicate-phone detection                     | While adding/editing, warns if the phone number already belongs to another customer, with options to update the existing record, keep it as-is, or save as a separate record anyway                                                    | `CUSTOMERS_MANAGE`                                   | Customer form                                       |
| Fuzzy name/phone search                       | Search customers by phone (exact/partial) or by name using `pg_trgm` similarity over a normalized Arabic name, so spelling variants still match                                                                                        | `CUSTOMERS_VIEW`                                     | Customer picker (used in invoices, orders)          |
| Customer balance                              | A running account credit/debit balance, separate from unpaid-invoice debt. Adjustable manually with a reason; every change is logged                                                                                                   | `CUSTOMERS_MANAGE` (adjust) / `CUSTOMERS_VIEW` (see) | Customer profile                                    |
| Balance history                               | Full audit trail of every balance change (previous → new, reason, note, linked invoice if any)                                                                                                                                         | `CUSTOMERS_VIEW`                                     | Customer profile                                    |
| Favorite customers                            | Toggle a "favorite" flag; favorites sort first in the customer list                                                                                                                                                                    | `CUSTOMERS_MANAGE`                                   | Customers list                                      |
| Customer profile — Overview                   | Totals purchased/paid, current balance, outstanding invoices breakdown, personal info, full order/invoice history, payment history, balance history                                                                                    | `CUSTOMERS_VIEW`                                     | `/dashboard/customers/[id]`                         |
| Customer profile — Compare Customer Purchases | Rich, date-range-scoped view: a paired-bar chart comparing each purchased product's price then vs. now, plus a paginated products table with the same comparison. Presets: Today/7 days/30 days/This month/Last month/This year/Custom | `CUSTOMERS_VIEW`                                     | `/dashboard/customers/[id]?tab=statement`           |
| Printable account statement                   | A separate, print/PDF-oriented statement (invoices + payments + totals for a date range), reusing the app's print/PDF infrastructure                                                                                                   | `CUSTOMERS_VIEW`                                     | `/dashboard/customers/[id]/statement`               |
| Bulk delete customers                         | Select and delete multiple customers (password-confirmed)                                                                                                                                                                              | `CUSTOMERS_MANAGE`                                   | Customers list                                      |

### 2.4 Orders

| Feature                 | What it does                                                                                                        | Permission        | UI location              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------ |
| Orders list/management  | Staff view of all orders, status (Pending/Processing/Completed/Cancelled), search                                   | `ORDERS_VIEW`     | `/dashboard/orders`      |
| Create order            | Staff create an order directly                                                                                      | `ORDERS_MANAGE`   | `/dashboard/orders/new`  |
| Edit order items/status | Change item quantities/prices, update status, reassign or edit the linked customer                                  | `ORDERS_MANAGE`   | `/dashboard/orders/[id]` |
| Convert order → invoice | An invoice can be created from an order (`getOrCreateInvoiceForOrder`), turning it into a tracked sale with payment | `INVOICES_MANAGE` | Order detail page        |
| Bulk delete orders      |                                                                                                                     | `ORDERS_MANAGE`   | Orders list              |

### 2.5 Invoices (sales)

| Feature                      | What it does                                                                                                                                                                                                  | Permission        | UI location                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| Create invoice               | Pick/create a customer, add line items (product, quantity, unit price — 3 price tiers or custom), language (AR/EN/FR) for the printed document, payment method, initial payment                               | `INVOICES_MANAGE` | `/dashboard/invoices/new`                                     |
| Sequence number              | Every invoice gets an atomic, sequential counter (001, 002, 003…) shown in the admin UI, separate from the random customer-facing `invoiceNumber` (e.g. `INV-XXXXXX`); never printed on the customer document | automatic         | Invoices list & profile                                       |
| Stock check before saving    | Validates requested quantities against current stock; can be overridden to allow negative stock with an explicit confirmation                                                                                 | `INVOICES_MANAGE` | Invoice form                                                  |
| Payments                     | Record one or more payments against an invoice (cash, bank transfer, card, "from balance", other); partial payments set status to Partially Paid; full payment sets Paid                                      | `INVOICES_MANAGE` | Invoice profile                                               |
| Pay across multiple invoices | A single payment can be applied across several of a customer's outstanding invoices at once                                                                                                                   | `INVOICES_MANAGE` | Invoice/customer payment flow                                 |
| Balance effects              | Paying with "customer balance", overpaying (credit), editing/cancelling an invoice, or merging old debt into a new invoice all adjust `Customer.balance` and are logged to `CustomerBalanceHistory`           | automatic         | Invoice actions                                               |
| Edit invoice                 | Change items/customer/payment method after creation; recalculates totals and balance effects                                                                                                                  | `INVOICES_MANAGE` | Invoice profile                                               |
| Delete invoice(s)            | Requires the delete-confirmation password; if the invoice had a balance effect, asks explicitly whether to reverse that effect                                                                                | `INVOICES_MANAGE` | Invoices list / profile                                       |
| Print / PDF                  | Printable invoice document in the selected language, with a "save as PDF" option                                                                                                                              | `INVOICES_VIEW`   | `/dashboard/invoices/[id]/print`                              |
| Quick add by category/brand  | A side panel to bulk-add all products in a chosen category or brand as line items in one click                                                                                                                | `INVOICES_MANAGE` | Invoice form (new & edit), same component reused in Purchases |

### 2.6 Suppliers & Purchases

| Feature                     | What it does                                                                                                                         | Permission                          | UI location                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------- |
| Supplier CRUD               | Name, phone, email, address, running balance                                                                                         | `SUPPLIERS_VIEW`/`SUPPLIERS_MANAGE` | `/dashboard/suppliers`, `/dashboard/suppliers/[id]` |
| Supplier balance            | Adjustable, with a logged history (`SupplierBalanceHistory`) — credited automatically by purchase returns, debited by payments       | `SUPPLIERS_MANAGE` (adjust)         | Supplier profile                                    |
| Create purchase order       | Pick a supplier, add items (product, quantity, unit cost), optionally update the product's stored `purchasePrice` from what was paid | `PURCHASES_MANAGE`                  | `/dashboard/purchases/new`                          |
| Quick add by category/brand | Same bulk-add-by-category/brand panel as invoices, positioned in a sticky side panel                                                 | `PURCHASES_MANAGE`                  | Purchase order form                                 |
| Receive purchase order      | Marks it Received and increases product stock (`InventoryMovement` type `IN`)                                                        | `PURCHASES_MANAGE`                  | `/dashboard/purchases/[id]`                         |
| Cancel purchase order       | Marks it Cancelled (no stock effect)                                                                                                 | `PURCHASES_MANAGE`                  | Purchase order detail                               |
| Supplier payments           | Record payments against a purchase order (cash/bank/card/other); tracks paid amount and payment status                               | `PURCHASES_MANAGE`                  | Purchase order detail                               |
| Edit purchase items         | Adjust quantities/costs on an existing order                                                                                         | `PURCHASES_MANAGE`                  | Purchase order detail                               |
| Print purchase order        | Printable document, language selectable per order                                                                                    | `PURCHASES_VIEW`                    | `/dashboard/purchases/[id]/print`                   |
| Delete purchase order(s)    | Password-confirmed                                                                                                                   | `PURCHASES_MANAGE`                  | Purchases list/detail                               |

### 2.7 Returns

| Feature              | What it does                                                                                                                                                                                          | Permission       | UI location                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| Sales return         | Return items from a specific invoice; each returned item is tagged Good/Damaged/Defective, with a refund method (cash/card/bank/customer credit/none) and refund status; optionally restocks the item | `RETURNS_MANAGE` | `/dashboard/sales-returns/new`, `/dashboard/sales-returns/[id]`       |
| Purchase return      | Return items from a specific purchase order back to the supplier, with a refund method and status                                                                                                     | `RETURNS_MANAGE` | `/dashboard/purchase-returns/new`, `/dashboard/purchase-returns/[id]` |
| Return source search | Look up the invoice/purchase order to return against                                                                                                                                                  | `RETURNS_VIEW`   | Return creation forms                                                 |
| Returns lists        | Browse all sales returns / purchase returns                                                                                                                                                           | `RETURNS_VIEW`   | `/dashboard/sales-returns`, `/dashboard/purchase-returns`             |

### 2.8 Expenses

| Feature      | What it does                                                                       | Permission                        | UI location           |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------- | --------------------- |
| Expense CRUD | Category (Rent/Salaries/Transportation/Utilities/Other), amount, description, date | `EXPENSES_VIEW`/`EXPENSES_MANAGE` | `/dashboard/expenses` |
| Bulk delete  |                                                                                    | `EXPENSES_MANAGE`                 | Expenses list         |

### 2.9 Reports

| Feature        | What it does                                                                                              | Permission     | UI location                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Report browser | Six report types: Inventory, Products, Orders, Customers, Purchases, Suppliers — each paginated on-screen | `REPORTS_VIEW` | `/dashboard/reports`, `/dashboard/reports/{inventory,products,orders,customers,purchases,suppliers}` |
| Export         | Download any report as CSV, XLSX, or JSON, with an optional column subset and row limit                   | `REPORTS_VIEW` | Report pages, via `/api/reports/export`                                                              |

### 2.10 Dashboard (analytics)

| Feature                                                                 | What it does                                                                                                                                                                          | Permission                                                              | UI location  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ |
| Overview stats                                                          | Total products, customers, active orders, low-stock count, total owed by customers, total inventory purchase value                                                                    | none beyond being logged in (root `/dashboard` is deliberately ungated) | `/dashboard` |
| Period analytics                                                        | Revenue, invoice count, average invoice, order count, new customers, purchases total — for a selectable date range (Today/7d/30d/90d/This month/Last month/This year/All time/Custom) | same                                                                    | `/dashboard` |
| Revenue vs. purchases trend chart                                       | Time-bucketed (hour/day/month, auto-chosen by range length) area chart                                                                                                                | same                                                                    | `/dashboard` |
| Top products / top customers                                            | Ranked lists for the selected period                                                                                                                                                  | same                                                                    | `/dashboard` |
| Category sales, payment status, order status, expenses breakdown charts | Pie/bar charts for the selected period                                                                                                                                                | same                                                                    | `/dashboard` |

### 2.11 Admin Settings

See [Section 4](#4-admin-guide) for full step-by-step coverage. Summary:

| Feature                                                                       | Permission        |
| ----------------------------------------------------------------------------- | ----------------- |
| User management (create/edit/reset password/activate-deactivate/delete)       | `USERS_MANAGE`    |
| Role management (create/edit/delete, permission matrix)                       | `USERS_MANAGE`    |
| Appearance (app name, short name, light-mode color tokens, reset to defaults) | `SETTINGS_MANAGE` |

---

## 3. User Roles & Permissions

### Roles

There is no fixed list of role _names_ — roles are records in the database that an admin creates. Two are seeded automatically:

| Role      | `isSystem` | `isFullAccess` | Notes                                                                                                                                                    |
| --------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** | `true`     | `true`         | Seeded once by `prisma/seed.ts`. Bypasses every permission check. Cannot be deleted or edited (name/full-access flag locked) because `isSystem` is true. |
| **Staff** | `false`    | `false`        | Seeded with zero permissions by default — an admin must grant it permissions via the Roles page.                                                         |

An admin can create additional custom roles freely (e.g. "Cashier", "Warehouse"), each with its own hand-picked set of permissions, and can also create another full-access role if desired.

### Permission model

Permissions are **per-module, split into VIEW and MANAGE**, plus two standalone administrative permissions. 22 values total, defined as the `PermissionKey` enum in `prisma/schema.prisma`:

| Module    | View permission  | Manage permission                                                                                                                              |
| --------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Products  | `PRODUCTS_VIEW`  | `PRODUCTS_MANAGE`                                                                                                                              |
| Orders    | `ORDERS_VIEW`    | `ORDERS_MANAGE`                                                                                                                                |
| Customers | `CUSTOMERS_VIEW` | `CUSTOMERS_MANAGE`                                                                                                                             |
| Inventory | `INVENTORY_VIEW` | `INVENTORY_MANAGE`                                                                                                                             |
| Purchases | `PURCHASES_VIEW` | `PURCHASES_MANAGE`                                                                                                                             |
| Invoices  | `INVOICES_VIEW`  | `INVOICES_MANAGE`                                                                                                                              |
| Suppliers | `SUPPLIERS_VIEW` | `SUPPLIERS_MANAGE`                                                                                                                             |
| Expenses  | `EXPENSES_VIEW`  | `EXPENSES_MANAGE`                                                                                                                              |
| Reports   | `REPORTS_VIEW`   | `REPORTS_MANAGE` (reserved — no UI currently distinguishes report _management_ from viewing; only `REPORTS_VIEW` is actually checked anywhere) |
| Returns   | `RETURNS_VIEW`   | `RETURNS_MANAGE`                                                                                                                               |

Standalone (not tied to a module, not shown in the module VIEW/MANAGE matrix):

| Permission        | Controls                             |
| ----------------- | ------------------------------------ |
| `USERS_MANAGE`    | Users page, Roles & Permissions page |
| `SETTINGS_MANAGE` | Appearance / system settings page    |

`MANAGE` generally implies the ability to create/edit/delete within that module; `VIEW` alone means read-only access to that module's list/detail pages. Note: in a handful of places a "manage-only" action reads related data via a `VIEW`-gated helper internally — the enforcement described in the Backend & API section reflects what's actually checked at each entry point.

### How permissions are enforced

- **Every page** under `/dashboard/**` calls `requirePageAccess(permission)` as the first line of its Server Component. If the logged-in admin lacks that permission, they are redirected to `/dashboard/access-denied` (a clear "you don't have access" page, distinct from a generic 404).
- **Every mutating server action** (create/update/delete across every feature) calls `requirePermission(permission)` first and returns `{ error }` if it fails — this is enforced on the server regardless of what the UI shows, so a user can't bypass it by crafting a request.
- **Real API routes** (`/api/**`) use `requireApiPermission(permission)`, which returns a genuine HTTP `401` (not logged in) or `403` (logged in, forbidden) response.
- **The sidebar** hides any nav item/group the current admin has no permission to see at all (it doesn't just disable it) — see `src/components/layout/admin-nav-items.ts`.
- Permission checks always re-read from the database (`getEffectivePermissions`), never from the login session/JWT — so revoking a permission takes effect on that admin's very next action, not just their next login.
- A role with `isFullAccess = true` bypasses all individual permission checks entirely (used by the Admin role).

### What happens without permission

| Context                              | Result                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visiting a gated dashboard page      | Redirected to `/dashboard/access-denied` with a clear message                                                                                                |
| Calling a gated server action        | Action returns a localized error object, e.g. `{ error: "You don't have sufficient permission to perform this action" }`; nothing is written to the database |
| Calling a gated API route            | Real `403 Forbidden` JSON response (or `401` if not logged in at all)                                                                                        |
| Nav item for a module you can't view | Not rendered in the sidebar at all                                                                                                                           |

### Admin-only functionality

Everything gated by `USERS_MANAGE` or `SETTINGS_MANAGE` (Users, Roles & Permissions, Appearance) is, in practice, admin-only — a Staff role isn't granted these by default and there's no other route to reach them.

### Self-escalation & last-admin protection (enforced server-side, not just hidden in the UI)

- A user editing **their own** role or permissions is blocked outright, even if they hold `USERS_MANAGE`.
- Before deactivating, deleting, or demoting the last remaining **active full-access** admin (`countOtherActiveFullAccessAdmins`), the action is rejected with an explicit error — this applies whether it's happening to yourself or someone else.
- The seeded **Admin role** itself can't be renamed, deleted, or have its full-access flag removed (`isSystem: true`).
- A role that's currently assigned to any user can't be deleted (enforced at the database level via a foreign-key restrict, surfaced as a friendly error).

### Assigning/removing permissions (as an admin)

1. Go to **Settings → Roles & Permissions** (`/dashboard/settings/roles`).
2. Edit an existing role or create a new one.
3. Use the permission matrix (one row per module, View/Manage checkboxes) plus the two standalone "Manage Users" / "Manage Settings" switches.
4. Save — the change applies to every user with that role immediately (no re-login needed, since permissions are read fresh on every action).
5. Assign a role to a user from the **Users** page (`/dashboard/settings/users`) when creating or editing them.

---

## 4. Admin Guide

All of the following requires `USERS_MANAGE` (Users, Roles) or `SETTINGS_MANAGE` (Appearance).

### 4.1 Creating a user

1. Go to `/dashboard/settings/users`.
2. Click the add-user action (opens a form sheet).
3. Fill in name, email, password, and select a role.
4. Save. The password is hashed with bcrypt before storage — it is never stored or shown in plaintext again.

### 4.2 Editing a user

1. From the Users list, open the user to edit.
2. Change name, email, or role.
3. Save. (Changing your own role is blocked — see [Section 3](#3-user-roles--permissions).)

### 4.3 Resetting a password

1. From the Users list, use the reset-password action on the target user.
2. Enter and confirm a new password.
3. Save — the new password is hashed and replaces the old one immediately.

### 4.4 Activating / deactivating a user

1. From the Users list, toggle the active/inactive state.
2. A deactivated user can no longer log in (`authorize()` in `src/lib/auth.ts` rejects inactive accounts), even with the correct password.
3. Deactivating the last active full-access admin is blocked.

### 4.5 Deleting a user

1. From the Users list, choose delete (single) or select several for bulk delete.
2. Requires the delete-confirmation password (the `DELETE_CONFIRM_PASSWORD` environment value) — this applies to invoices, customers, and payments too, not just users.
3. Deleting the last active full-access admin is blocked.

### 4.6 Managing roles

1. Go to `/dashboard/settings/roles`.
2. Create a new role: give it a name, optionally mark it as full-access (bypasses the matrix), and set its permission matrix.
3. Edit an existing custom role the same way. The seeded Admin role's name/full-access flag can't be changed.
4. Delete a role — blocked if any user currently holds it, or if it's the system Admin role.

### 4.7 System settings — Appearance

Go to `/dashboard/settings/appearance` (requires `SETTINGS_MANAGE`).

- **App name / short name** — the full name shown across the admin UI and print documents, plus a short name used for the browser tab title.
- **Light-mode colors** — a real color picker (native `<input type="color">`) plus a text field per token (primary, secondary, sidebar, sidebar text, header, background, text, button, accent), each with a live swatch preview and its own "reset to default" button.
- Only light mode is shown in the UI; dark-mode color values still exist in the underlying settings record and are preserved unedited (submitted through unchanged) — there's currently no UI to edit them directly.
- **"Restore default settings"** — resets the form (name, short name, and all colors) back to the values in `src/config/company.ts`, without saving until you press Save.
- Saving updates the theme across the whole app immediately (no rebuild/restart needed) via `revalidatePath("/", "layout")`.

### 4.8 Other admin-relevant functionality

- **Product bulk import** (`PRODUCTS_MANAGE`) — upload an `.xlsx` file from the Products page to create/update many products at once, with live streamed progress.
- **Deleting sensitive records** (invoices, customers, payments, users) always requires the shared delete-confirmation password, on top of the normal permission check.

---

## 5. Normal User (Staff) Guide

A "normal user" here means any non-full-access admin account — what they can do depends entirely on the permissions their assigned role carries.

### Logging in

1. Go to `/login`.
2. Enter your email and password (given to you by an administrator).
3. On success you land on `/dashboard` — the overview page is visible to any logged-in user regardless of permissions.
4. If your account has been deactivated, or the password is wrong, login fails with a generic error (no distinction is shown between the two, to avoid confirming which accounts exist).

### What you see depends on your permissions

- The sidebar only lists the modules you have at least `*_VIEW` on. A module you have no permission for simply isn't shown.
- Within a module you can view, action buttons/forms that require `*_MANAGE` will still exist in the page if you also have that permission; if you only have `*_VIEW`, you can browse and open records but cannot create/edit/delete — attempting to would be rejected server-side even if you found a way to trigger it.
- Visiting a URL directly for a module you can't view at all redirects you to a clear "access denied" page.

### Typical staff workflows

- **Selling**: Customers → find/create customer → Invoices → new invoice → add items → record payment.
- **Stock**: Inventory → check low-stock list → record a movement, or receive a purchase order to restock.
- **Purchasing**: Suppliers → Purchases → new purchase order → receive it when goods arrive → record payment to the supplier.
- **Returns**: Sales Returns / Purchase Returns → search for the source invoice/purchase order → process the return.

If a workflow step requires a permission you don't have (e.g. you can view invoices but not create them), the corresponding button/form won't be available, and going around it directly is blocked server-side too.

---

## 6. Pages & Navigation

All dashboard pages live under `/dashboard/**` and require being logged in (enforced in `src/proxy.ts`, which redirects an unauthenticated visitor to `/login`). Each page below additionally requires the listed permission via `requirePageAccess()`.

| Page                             | Path                                                                           | Permission                                                    | Purpose                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Dashboard overview               | `/dashboard`                                                                   | none (just logged in)                                         | Stats + analytics, see §2.10                                                      |
| Products list                    | `/dashboard/products`                                                          | `PRODUCTS_VIEW`                                               | Browse/search/filter products, bulk actions, import                               |
| Product profile                  | `/dashboard/products/[id]`                                                     | `PRODUCTS_VIEW`                                               | Full detail, edit, movement history, buyers list                                  |
| Categories list/profile          | `/dashboard/categories`, `/dashboard/categories/[id]`                          | `PRODUCTS_VIEW`                                               | Category tree management                                                          |
| Brands list/profile              | `/dashboard/brands`, `/dashboard/brands/[id]`                                  | `PRODUCTS_VIEW`                                               | Brand management                                                                  |
| Inventory                        | `/dashboard/inventory`                                                         | `INVENTORY_VIEW`(page)/`INVENTORY_MANAGE`(record movement)    | Low-stock table, manual stock movements                                           |
| Customers list                   | `/dashboard/customers`                                                         | `CUSTOMERS_VIEW`                                              | Search/filter/sort customers, debt filter                                         |
| Customer profile                 | `/dashboard/customers/[id]`                                                    | `CUSTOMERS_VIEW`                                              | Overview tab + Statement tab (see §2.3)                                           |
| Customer statement (print)       | `/dashboard/customers/[id]/statement`                                          | `CUSTOMERS_VIEW`                                              | Print/PDF-ready ledger for a date range                                           |
| Orders list                      | `/dashboard/orders`                                                            | `ORDERS_VIEW`                                                 | All orders, status filter                                                         |
| New order                        | `/dashboard/orders/new`                                                        | `ORDERS_MANAGE`                                               | Manually create an order                                                          |
| Order detail                     | `/dashboard/orders/[id]`                                                       | `ORDERS_VIEW`(view)/`ORDERS_MANAGE`(edit)                     | Status, items, convert to invoice                                                 |
| Invoices list                    | `/dashboard/invoices`                                                          | `INVOICES_VIEW`                                               | All invoices, payment-status filter, search                                       |
| New invoice                      | `/dashboard/invoices/new`                                                      | `INVOICES_MANAGE`                                             | Create a sale                                                                     |
| Invoice detail                   | `/dashboard/invoices/[id]`                                                     | `INVOICES_VIEW`(view)/`INVOICES_MANAGE`(edit/payments)        | Full invoice, payments, edit                                                      |
| Invoice print                    | `/dashboard/invoices/[id]/print`                                               | `INVOICES_VIEW`                                               | Printable document                                                                |
| Suppliers list/profile           | `/dashboard/suppliers`, `/dashboard/suppliers/[id]`                            | `SUPPLIERS_VIEW`/`SUPPLIERS_MANAGE`                           | Supplier management, balance                                                      |
| Purchases list                   | `/dashboard/purchases`                                                         | `PURCHASES_VIEW`                                              | All purchase orders                                                               |
| New purchase order               | `/dashboard/purchases/new`                                                     | `PURCHASES_MANAGE`                                            | Create a purchase order                                                           |
| Purchase order detail            | `/dashboard/purchases/[id]`                                                    | `PURCHASES_VIEW`(view)/`PURCHASES_MANAGE`(receive/cancel/pay) | Full order, payments                                                              |
| Purchase order print             | `/dashboard/purchases/[id]/print`                                              | `PURCHASES_VIEW`                                              | Printable document                                                                |
| Sales returns list/new/detail    | `/dashboard/sales-returns[/…]`                                                 | `RETURNS_VIEW`/`RETURNS_MANAGE`                               | Return items from an invoice                                                      |
| Purchase returns list/new/detail | `/dashboard/purchase-returns[/…]`                                              | `RETURNS_VIEW`/`RETURNS_MANAGE`                               | Return items to a supplier                                                        |
| Expenses                         | `/dashboard/expenses`                                                          | `EXPENSES_VIEW`/`EXPENSES_MANAGE`                             | Expense tracking                                                                  |
| Reports index                    | `/dashboard/reports`                                                           | `REPORTS_VIEW`                                                | Links into the six report types                                                   |
| Report pages                     | `/dashboard/reports/{inventory,products,orders,customers,purchases,suppliers}` | `REPORTS_VIEW`                                                | On-screen paginated report + export                                               |
| Users                            | `/dashboard/settings/users`                                                    | `USERS_MANAGE`                                                | User CRUD, see §4.1–4.5                                                           |
| Roles & Permissions              | `/dashboard/settings/roles`                                                    | `USERS_MANAGE`                                                | Role CRUD, permission matrix                                                      |
| Appearance                       | `/dashboard/settings/appearance`                                               | `SETTINGS_MANAGE`                                             | Branding & theme colors                                                           |
| Access denied                    | `/dashboard/access-denied`                                                     | —                                                             | Shown when a logged-in user lacks the permission for the page they tried to reach |

---

## 7. Main Workflows

### 7.1 Selling to a walk-in/known customer (direct invoice)

1. Log in → `/dashboard`.
2. Go to **Customers**, find or create the customer (or skip and pick/create them inline from the invoice form).
3. Go to **Invoices → New Invoice**.
4. Select the customer, add line items (search by name/barcode, or use "quick add by category/brand"), set quantities/prices.
5. Choose a payment method and enter an initial payment amount (can be partial or zero).
6. Save — this creates the `Invoice` + `InvoiceItem` rows, deducts stock, and applies any balance/payment effects.
7. Optionally print or save as PDF from the invoice detail page.
8. If more payment comes in later, record additional payments from the invoice profile until it's fully paid.

### 7.2 Order → fulfilled sale

1. Staff create an order in **Orders → New Order** (or edit one already on file).
2. Update its status as it's processed, editing items/customer if needed.
3. Convert the order into an **Invoice** to record it as a tracked, payable sale.
4. From here it follows the same payment/print flow as 7.1.

### 7.3 Restocking via a supplier purchase

1. Go to **Suppliers**, find or create the supplier.
2. Go to **Purchases → New Purchase Order**.
3. Select the supplier, add items (product, quantity, unit cost), optionally flag that the product's stored purchase price should update.
4. Save (status starts `PENDING`).
5. When goods physically arrive, open the order and **Receive** it — this increases stock and records `IN` inventory movements.
6. Record supplier payment(s) against the order as they're paid.

### 7.4 Processing a customer return

1. Go to **Sales Returns → New Return**.
2. Search for and select the source invoice.
3. Choose which items and quantities are being returned, and each item's condition (Good/Damaged/Defective).
4. Choose a refund method (cash/card/bank transfer/customer credit/no immediate refund) and whether to restock the item.
5. Save — this may restock the product (if flagged), update the invoice's returned amounts, and credit the customer's balance if the refund method is "customer credit".

### 7.5 Granting a staff member access to a module

1. Log in as an admin (or any user with `USERS_MANAGE`).
2. Go to **Settings → Roles & Permissions**.
3. Edit the target role (or create a new one), check the relevant View/Manage boxes.
4. Save.
5. The affected user(s) see the change immediately on their next action — no re-login required.

### 7.6 Reviewing a customer's purchase history & price changes

1. Go to **Customers**, open the customer's profile.
2. Click the "Compare Customer Purchases" button in the header to switch to that view.
3. Pick a date range (preset or custom).
4. Review the price-comparison chart and the products table — both show, per product, the price the customer paid vs. the product's current price, with the percentage difference.

---

## 8. Technical Overview

The technologies this system is built with:

- **Next.js / React** — the web application framework the whole system runs on.
- **PostgreSQL** (hosted on Neon) — the database that stores everything.
- **NextAuth (Auth.js)** — handles staff login and sessions.
- **Tailwind CSS** — the visual styling system.
- **Recharts** — the charts on the dashboard and customer statement.
- **Cloudinary** — hosts and serves product photos.
- **Excel / PDF tools** — power the report export (CSV/XLSX/JSON) and printable invoices/purchase orders.

---

## 9. Backend & API

### 9.1 Real HTTP Route Handlers (`src/app/api/**`)

These are genuine REST-style endpoints with real HTTP status codes (unlike Server Actions, which return `{ error }` values instead of statuses).

| Method       | Path                                                | Purpose                                                                                                                                                                                                         | Auth     | Permission        | Notes / errors                                                                                                                                    |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`/`POST` | `/api/auth/[...nextauth]`                           | NextAuth's own sign-in/session/callback machinery                                                                                                                                                               | —        | —                 | Framework-managed, not custom application logic                                                                                                   |
| `POST`       | `/api/cloudinary/sign`                              | Returns a signed Cloudinary upload payload (timestamp, signature, folder, API key, cloud name) for direct browser upload                                                                                        | Required | `PRODUCTS_MANAGE` | `401` not logged in, `403` missing permission                                                                                                     |
| `POST`       | `/api/products/import`                              | Streams NDJSON progress events while bulk-importing products from an uploaded `.xlsx` file                                                                                                                      | Required | `PRODUCTS_MANAGE` | `401`/`403` as above; `400` if no file, or file isn't `.xlsx`; per-row errors are streamed as NDJSON events rather than failing the whole request |
| `GET`        | `/api/reports/export?type=&format=&limit=&columns=` | Exports one of six report types (`inventory`, `products`, `orders`, `customers`, `purchases`, `suppliers`) as `csv` (default), `xlsx`, or `json`, with optional column subset (`columns=0,2,4`) and row `limit` | Required | `REPORTS_VIEW`    | `401`/`403` as above; `400` if `type` isn't one of the six known report types                                                                     |

### 9.2 Server Actions (by feature)

These live in each feature's `actions.ts`, are invoked directly from forms/components (not fetched by URL), and every mutating one calls `requirePermission()` first. Grouped by module — permission shown once per module since it's consistent per action name (`*_MANAGE` for writes):

| Module         | Actions                                                                                                                                                                                                                                                  | Permission                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Auth**       | `authenticate`, `logout`                                                                                                                                                                                                                                 | none (public)                                       |
| **Products**   | `findProductIdByBarcode`, `createProduct`, `updateProduct`, `deleteProduct`, `deleteProducts`                                                                                                                                                            | `PRODUCTS_MANAGE` (writes)                          |
| **Categories** | `createCategory`, `updateCategory`, `deleteCategory`, `deleteCategories`                                                                                                                                                                                 | `PRODUCTS_MANAGE`                                   |
| **Brands**     | `createBrand`, `updateBrand`, `deleteBrand`, `deleteBrands`                                                                                                                                                                                              | `PRODUCTS_MANAGE`                                   |
| **Inventory**  | `recordInventoryMovement`                                                                                                                                                                                                                                | `INVENTORY_MANAGE`                                  |
| **Customers**  | `createCustomer`, `updateCustomer`, `adjustCustomerBalanceManual`, `findCustomerByPhoneAction`, `deleteCustomer`, `deleteCustomers`, `toggleCustomerFavorite`                                                                                            | `CUSTOMERS_MANAGE`                                  |
| **Orders**     | `updateOrderStatus`, `getOrderStockIssue`, `updateOrderItems`, `reassignOrderCustomer`, `saveOrderCustomerInfo`, `createOrder`, `deleteOrder`, `deleteOrders`                                                                                            | `ORDERS_MANAGE`                                     |
| **Invoices**   | `checkInvoiceStockAvailability`, `fetchCustomerOutstandingInvoices`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `deleteInvoices`, `getOrCreateInvoiceForOrder`, `recordPayment`, `recordPaymentAcrossInvoices`, `updatePayment`, `deletePayment` | `INVOICES_MANAGE`                                   |
| **Suppliers**  | `adjustSupplierBalance`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `deleteSuppliers`                                                                                                                                                         | `SUPPLIERS_MANAGE`                                  |
| **Purchases**  | `createPurchaseOrder`, `updatePurchaseOrderItems`, `recordSupplierPayment`, `deleteSupplierPayment`, `receivePurchaseOrder`, `cancelPurchaseOrder`, `deletePurchaseOrder`, `deletePurchaseOrders`                                                        | `PURCHASES_MANAGE`                                  |
| **Returns**    | `searchReturnSources`, `createSalesReturn`, `createPurchaseReturn`                                                                                                                                                                                       | `RETURNS_VIEW` (search) / `RETURNS_MANAGE` (create) |
| **Expenses**   | `createExpense`, `updateExpense`, `deleteExpense`, `deleteExpenses`                                                                                                                                                                                      | `EXPENSES_MANAGE`                                   |
| **Users**      | `createUser`, `updateUser`, `resetUserPassword`, `toggleUserActive`, `deleteUser`, `deleteUsers`                                                                                                                                                         | `USERS_MANAGE`                                      |
| **Roles**      | `createRole`, `updateRole`, `deleteRole`                                                                                                                                                                                                                 | `USERS_MANAGE`                                      |
| **Settings**   | `updateSystemSettings`                                                                                                                                                                                                                                   | `SETTINGS_MANAGE`                                   |

Every action in this table returns an `ActionResult`-shaped value (`{ error?: string }` on failure; `void`/data on success) rather than an HTTP status — that's the nature of Next.js Server Actions. Deletions of invoices, customers, payments, and users additionally require the `DELETE_CONFIRM_PASSWORD` value to be supplied and correct.

### 9.3 Common error shapes

Every error message returned by a server action or API route is looked up from the app's dictionary (`ar`/`en`/`fr`) based on the visitor's locale cookie, not a fixed string — the English text shown below is just that lookup's English value.

| Situation                     | Server Action                                                                                                    | Route Handler                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Not logged in                 | `{ error: "You must log in first" }` (localized)                                                                 | `401` JSON `{ error }`                                 |
| Logged in, missing permission | `{ error: "You don't have sufficient permission to perform this action" }` (localized)                           | `403` JSON `{ error }`                                 |
| Invalid input (zod)           | `{ error: <validation message> }`                                                                                | `400` for malformed request shape (e.g. bad file type) |
| Record not found              | Page-level: Next.js `notFound()` → its own not-found boundary                                                    | n/a for the current API routes                         |
| Server/database error         | Generally surfaced as `{ error: <message> }`; unhandled exceptions fall back to Next.js's default error handling | `500` implicitly via unhandled exceptions              |

---

## 10. Troubleshooting

### Login problems

- **"Invalid credentials" even though the password looks right** — login always checks the `Admin` table in the database (bcrypt-compared), not the `SEED_ADMIN_PASSWORD` env var — that variable is only used once, by `prisma/seed.ts`, to create the _initial_ account. If the password was changed since via the Users page, use the current one.
- **Account can't log in at all** — check whether the user was deactivated (`isActive = false`); `authorize()` rejects inactive accounts outright.

### `403` / "permission denied"

- Confirm the user's role actually has the relevant `*_VIEW`/`*_MANAGE` permission on the **Roles & Permissions** page.
- Remember permissions are checked fresh on every action — if you just granted one, the user does not need to log out/in, but _you_ (the admin) may need to refresh the roles page to see the change reflected in the matrix UI.
- If you're testing as the affected user and still see it after confirming the role has the permission, double check they're actually assigned that role (Users page).

### `401` / "must log in first"

- Session likely expired or was never established — go to `/login`. If this happens repeatedly right after logging in, check that `AUTH_SECRET` is set and stable (changing it invalidates all existing sessions).

### Database connection issues

- Verify `DATABASE_URL` is correct and reachable; Neon pooled connections need `sslmode=require` or `verify-full`.
- `PrismaClientKnownRequestError` after a schema change while a dev server was left running usually means a stale Turbopack build cache — run `npx prisma generate`, delete `.next/`, and restart the dev server.
- Run `npx prisma migrate status` to check for unapplied migrations (do **not** run `migrate reset` against a database with real data — it wipes it).

### Configuration problems

- Missing `AUTH_SECRET` — NextAuth will fail to establish sessions; generate one with `npx auth secret`.
- Image upload fails — check `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` are all set; the signing endpoint (`/api/cloudinary/sign`) requires `PRODUCTS_MANAGE` too, so a permission issue can look like a Cloudinary issue.
- Deleting an invoice/customer/payment/user fails with a password error — that's `DELETE_CONFIRM_PASSWORD`, not the admin's own login password.

### Build/startup errors

- This is a customized Next.js fork with breaking changes from the version most tooling/training data expects — if a build error references an API that "should" exist per general Next.js knowledge, check `node_modules/next/dist/docs/` before assuming it's a bug.
- `npm install` failing on the Prisma step — ensure `DATABASE_URL` is set before `postinstall` runs `prisma generate` (client generation itself doesn't need a live DB connection, but some environments still expect the env var to be present).

---

## 11. Known Issues / Implementation Gaps

- **`REPORTS_MANAGE` is unused.** The permission exists in the `PermissionKey` enum and appears in the Roles permission matrix, but no page or action currently checks it — only `REPORTS_VIEW` gates anything in the Reports module. Granting/withholding `REPORTS_MANAGE` currently has no effect.
- **Root `/dashboard` is intentionally ungated.** Any logged-in user can see the overview stats/analytics regardless of their permissions — this includes revenue, customer, and purchase figures even if the user lacks `REPORTS_VIEW`, `CUSTOMERS_VIEW`, etc. This is a deliberate design choice (documented in the code as "left ungated by design"), not an oversight, but it does mean the dashboard overview is not permission-scoped the way every other page is.
- **Dashboard "top customers" widget** shows customer names/figures to any logged-in user, independent of whether they hold `CUSTOMERS_VIEW` — a direct consequence of the point above.
- **Page-level access denial returns HTTP 200, not 403/404.** Because of how Next.js streaming/`loading.tsx` interacts with `redirect()`/`notFound()` inside a nested page, a permission-denied page redirect to `/dashboard/access-denied` cannot carry a real 403 status code by the time it fires — the browser sees a 200 for the redirected page. The redirect and message are still correct and no denied data is ever included in the response; only the raw HTTP status code is not meaningful here. Server Actions and the real API routes under `/api/**` are unaffected and return correct `401`/`403` statuses.
