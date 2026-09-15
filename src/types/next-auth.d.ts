import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    roleId: string;
    roleName: string;
    isFullAccess: boolean;
  }

  interface Session {
    user: {
      id: string;
      roleId: string;
      roleName: string;
      isFullAccess: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roleId: string;
    roleName: string;
    isFullAccess: boolean;
  }
}
