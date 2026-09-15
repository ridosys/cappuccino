CREATE TYPE "PermissionKey" AS ENUM (
  'PRODUCTS_VIEW', 'PRODUCTS_MANAGE',
  'ORDERS_VIEW', 'ORDERS_MANAGE',
  'CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE',
  'INVENTORY_VIEW', 'INVENTORY_MANAGE',
  'PURCHASES_VIEW', 'PURCHASES_MANAGE',
  'INVOICES_VIEW', 'INVOICES_MANAGE',
  'SUPPLIERS_VIEW', 'SUPPLIERS_MANAGE',
  'EXPENSES_VIEW', 'EXPENSES_MANAGE',
  'REPORTS_VIEW', 'REPORTS_MANAGE',
  'RETURNS_VIEW', 'RETURNS_MANAGE',
  'USERS_MANAGE', 'SETTINGS_MANAGE'
);

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isFullAccess" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permission" "PermissionKey" NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSettings" (
  "id" TEXT NOT NULL,
  "appName" TEXT,
  "appShortName" TEXT,
  "colorsLight" JSONB,
  "colorsDark" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the two built-in roles with fixed, human-readable ids so seed.ts and
-- this migration agree on which row is "the" admin role.
INSERT INTO "Role" ("id", "name", "isSystem", "isFullAccess", "createdAt", "updatedAt")
VALUES
  ('role_admin', 'Admin', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'User', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Admin.roleId: add nullable, backfill every existing admin to the seeded
-- Admin role, then enforce NOT NULL — safe against existing rows.
ALTER TABLE "Admin" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Admin" ADD COLUMN "roleId" TEXT;
UPDATE "Admin" SET "roleId" = 'role_admin' WHERE "roleId" IS NULL;
ALTER TABLE "Admin" ALTER COLUMN "roleId" SET NOT NULL;

CREATE INDEX "Admin_roleId_idx" ON "Admin"("roleId");
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
