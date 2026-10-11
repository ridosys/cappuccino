-- POS_CONFIGURE: lets a role create/edit/delete configured caisses (a caisse
-- locked to one customer and a set of categories, assigned to specific
-- users). Not granted to any existing custom role automatically — tick it in
-- Roles & Permissions. Full-access roles are unaffected.
ALTER TYPE "PermissionKey" ADD VALUE 'POS_CONFIGURE';
