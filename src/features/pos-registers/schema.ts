import { z } from "zod";

export const posRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  customerId: z.string().min(1),
  isActive: z.boolean(),
  categoryIds: z.array(z.string().min(1)),
  adminIds: z.array(z.string().min(1)),
});

export type PosRegisterInput = z.infer<typeof posRegisterSchema>;
