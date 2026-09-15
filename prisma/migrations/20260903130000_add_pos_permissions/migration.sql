-- Two new permission keys for the La Caisse (POS) module, following the
-- same VIEW/MANAGE pair convention as every other module. POS_VIEW gates
-- access to /caisse and the POS interface; POS_MANAGE gates completing
-- sales and other POS management actions.
--
-- Existing custom roles get nothing granted automatically (matches how
-- every other permission has been introduced) — an admin must explicitly
-- check these on the Roles & Permissions page. Full-access roles are
-- unaffected, since isFullAccess bypasses the permission list entirely.
ALTER TYPE "PermissionKey" ADD VALUE 'POS_VIEW';
ALTER TYPE "PermissionKey" ADD VALUE 'POS_MANAGE';
