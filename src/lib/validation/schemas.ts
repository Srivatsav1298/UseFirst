import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(200);
export const nameSchema = z.string().trim().min(2).max(80);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(["en", "nb"]).optional().default("en"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const householdCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const householdRenameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const invitationCreateSchema = z.object({
  email: emailSchema.optional(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const memberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

const dateValueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .nullable()
  .optional();

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

export const inventoryCreateSchema = z
  .object({
    productId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    brand: nullableTrimmed(120),
    barcode: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, "Barcode must be 8-14 digits")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    category: nullableTrimmed(80),
    quantity: z.coerce.number().positive().max(9999).default(1),
    unit: z.string().trim().min(1).max(20).default("item"),
    packageSize: nullableTrimmed(40),
    imageUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine((u) => u.startsWith("https://"), "Image URL must use HTTPS")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    dateValue: dateValueSchema,
    dateType: z.enum(["use_by", "best_before", "unknown"]).default("unknown"),
    originalDateText: nullableTrimmed(120),
    dateConfidence: z.enum(["high", "medium", "low", "none"]).default("none"),
    storageLocation: z.enum(["refrigerator", "freezer", "pantry", "cupboard", "other"]).default("pantry"),
    notes: nullableTrimmed(500),
    price: z.coerce.number().nonnegative().max(1_000_000).nullable().optional(),
    currency: z.string().trim().length(3).toUpperCase().default("USD"),
  })
  .superRefine((data, ctx) => {
    if (!data.dateValue) {
      if (data.dateConfidence !== "none") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateConfidence"], message: "No date value provided" });
      }
      return;
    }
    if (data.dateType === "unknown") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateType"],
        message: "Choose whether this is a use-by or best-before date",
      });
    }
    if (data.dateConfidence === "low") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateConfidence"],
        message: "Low-confidence dates cannot be saved. Confirm the date or type it manually.",
      });
    }
    if (data.dateConfidence === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateConfidence"],
        message: "Confirm the date before saving",
      });
    }
  });

export const inventoryUpdateSchema = z.object({
  version: z.coerce.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120).optional(),
  brand: nullableTrimmed(120),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: nullableTrimmed(80),
  quantity: z.coerce.number().positive().max(9999).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  packageSize: nullableTrimmed(40),
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://"), "Image URL must use HTTPS")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  dateValue: dateValueSchema,
  dateType: z.enum(["use_by", "best_before", "unknown"]).optional(),
  originalDateText: nullableTrimmed(120),
  dateConfidence: z.enum(["high", "medium", "low", "none"]).optional(),
  storageLocation: z.enum(["refrigerator", "freezer", "pantry", "cupboard", "other"]).optional(),
  notes: nullableTrimmed(500),
  price: z.coerce.number().nonnegative().max(1_000_000).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
});

export const inventoryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("consume"),
    quantity: z.coerce.number().positive().max(9999).optional(),
  }),
  z.object({
    action: z.literal("discard"),
    quantity: z.coerce.number().positive().max(9999).optional(),
    reason: z.enum(["expired", "forgot", "too_much", "spoiled", "other"]).default("other"),
    estimatedValue: z.coerce.number().nonnegative().max(1_000_000).nullable().optional(),
  }),
  z.object({ action: z.literal("freeze") }),
  z.object({ action: z.literal("unfreeze") }),
  z.object({
    action: z.literal("quantity"),
    quantity: z.coerce.number().positive().max(9999),
    version: z.coerce.number().int().nonnegative(),
  }),
]);

export const shoppingItemCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().positive().max(9999).default(1),
  unit: z.string().trim().min(1).max(20).default("item"),
  category: z.string().trim().max(40).default("other"),
});

export const shoppingItemUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  quantity: z.coerce.number().positive().max(9999).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  category: z.string().trim().max(40).optional(),
  checked: z.boolean().optional(),
});

export const purchaseSchema = z.object({
  addToInventory: z.boolean().default(false),
  inventory: inventoryCreateSchema.optional(),
});

export const wasteCreateSchema = z.object({
  inventoryId: z.string().uuid().optional(),
  productName: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().positive().max(9999).default(1),
  unit: z.string().trim().min(1).max(20).default("item"),
  reason: z.enum(["expired", "forgot", "too_much", "spoiled", "other"]),
  estimatedValue: z.coerce.number().nonnegative().max(1_000_000).nullable().optional(),
});

export const preferencesSchema = z.object({
  locale: z.enum(["en", "nb"]).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  notificationFrequency: z.enum(["off", "daily", "weekly"]).optional(),
  dietaryTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  householdServings: z.coerce.number().int().min(1).max(30).optional(),
});

export const cookSchema = z.object({
  recipeId: z.string().uuid(),
  servings: z.coerce.number().int().min(1).max(30).default(4),
  updateInventory: z.boolean().default(true),
  planFor: dateValueSchema,
});

export const planSchema = z.object({
  recipeId: z.string().uuid(),
  plannedFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .refine((value) => {
      const d = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
    }, "Invalid calendar date"),
  servings: z.coerce.number().int().min(1).max(30).default(4),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
  confirm: z.literal("DELETE"),
});
