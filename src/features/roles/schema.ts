import { z } from "zod";
import { PermissionKey } from "@/generated/prisma/enums";

export const roleSchema = z.object({
  name: z.string().min(2, { error: "اسم الدور يجب أن يتكون من حرفين على الأقل" }),
  isFullAccess: z.boolean(),
  permissions: z.array(z.enum(PermissionKey)),
});

export type RoleInput = z.infer<typeof roleSchema>;
