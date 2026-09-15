import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/features/auth/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const admin = await prisma.admin.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!admin || !admin.isActive) return null;

        const passwordMatches = await bcrypt.compare(password, admin.password);
        if (!passwordMatches) return null;

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          roleId: admin.roleId,
          roleName: admin.role.name,
          isFullAccess: admin.role.isFullAccess,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.isFullAccess = user.isFullAccess;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.isFullAccess = token.isFullAccess as boolean;
      }
      return session;
    },
  },
});
