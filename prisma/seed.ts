import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.env.SEED_ADMIN_NAME ?? "مدير النظام";
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env.local before seeding.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const adminRole = await prisma.role.upsert({
    where: { id: "role_admin" },
    update: {},
    create: {
      id: "role_admin",
      name: "Admin",
      isSystem: true,
      isFullAccess: true,
    },
  });
  await prisma.role.upsert({
    where: { id: "role_user" },
    update: {},
    create: { id: "role_user", name: "Staff" },
  });

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      password: hashedPassword,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log(`تم إنشاء حساب المدير: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
