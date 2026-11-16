import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const households = pgTable("households", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "admin" | "member">().notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("household_members_unique").on(t.householdId, t.userId),
    index("household_members_user_idx").on(t.userId),
  ],
);

export const householdInvitations = pgTable(
  "household_invitations",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    email: text("email"),
    role: text("role").$type<"admin" | "member">().notNull().default("member"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("household_invitations_token_unique").on(t.tokenHash),
    index("household_invitations_household_idx").on(t.householdId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    barcode: text("barcode").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category"),
    imageUrl: text("image_url"),
    packageSize: text("package_size"),
    source: text("source").notNull().default("openfoodfacts"),
    sourceAttribution: text("source_attribution"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_barcode_unique").on(t.barcode)],
);

export const inventory = pgTable(
  "household_inventory",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    brand: text("brand"),
    barcode: text("barcode"),
    category: text("category"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("item"),
    packageSize: text("package_size"),
    imageUrl: text("image_url"),
    dateValue: date("date_value"),
    dateType: text("date_type")
      .$type<"use_by" | "best_before" | "unknown">()
      .notNull()
      .default("unknown"),
    originalDateText: text("original_date_text"),
    dateConfidence: text("date_confidence")
      .$type<"high" | "medium" | "low" | "none">()
      .notNull()
      .default("none"),
    storageLocation: text("storage_location")
      .$type<"refrigerator" | "freezer" | "pantry" | "cupboard" | "other">()
      .notNull()
      .default("pantry"),
    notes: text("notes"),
    price: numeric("price", { precision: 10, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_household_idx").on(t.householdId),
    index("inventory_household_date_idx").on(t.householdId, t.dateValue),
    index("inventory_barcode_idx").on(t.householdId, t.barcode),
  ],
);

export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    inventoryId: uuid("inventory_id").references(() => inventory.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_events_household_idx").on(t.householdId, t.createdAt),
    index("inventory_events_inventory_idx").on(t.inventoryId),
  ],
);

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull(),
  cookingTimeMinutes: integer("cooking_time_minutes").notNull().default(30),
  difficulty: text("difficulty").$type<"easy" | "medium" | "hard">().notNull().default("easy"),
  dietaryTags: jsonb("dietary_tags").$type<string[]>().notNull().default([]),
  allergens: jsonb("allergens").$type<string[]>().notNull().default([]),
  cuisine: text("cuisine").notNull().default("international"),
  servings: integer("servings").notNull().default(4),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("item"),
    optional: boolean("optional").notNull().default(false),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    plannedFor: date("planned_for").notNull(),
    servings: integer("servings").notNull().default(4),
    status: text("status").$type<"planned" | "cooked" | "skipped">().notNull().default("planned"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meal_plans_household_idx").on(t.householdId, t.plannedFor)],
);

export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Shopping list"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shopping_lists_household_idx").on(t.householdId)],
);

export const shoppingListItems = pgTable(
  "shopping_list_items",
  {
    id: uuid("id").primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("item"),
    category: text("category").notNull().default("other"),
    checked: boolean("checked").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shopping_items_household_idx").on(t.householdId, t.checked)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const foodWasteRecords = pgTable(
  "food_waste_records",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    inventoryId: uuid("inventory_id").references(() => inventory.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("item"),
    reason: text("reason").notNull(),
    estimatedValue: numeric("estimated_value", { precision: 10, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("waste_household_idx").on(t.householdId, t.createdAt)],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  currency: text("currency").notNull().default("USD"),
  units: text("units").$type<"metric" | "imperial">().notNull().default("metric"),
  notificationFrequency: text("notification_frequency")
    .$type<"off" | "daily" | "weekly">()
    .notNull()
    .default("daily"),
  dietaryTags: jsonb("dietary_tags").$type<string[]>().notNull().default([]),
  householdServings: integer("household_servings").notNull().default(4),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_household_idx").on(t.householdId, t.createdAt)],
);
