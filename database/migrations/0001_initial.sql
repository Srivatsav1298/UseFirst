-- USE FIRST initial schema (PostgreSQL / PGlite compatible)

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS household_members_unique ON household_members (household_id, user_id);
CREATE INDEX IF NOT EXISTS household_members_user_idx ON household_members (user_id);

CREATE TABLE IF NOT EXISTS household_invitations (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS household_invitations_token_unique ON household_invitations (token_hash);
CREATE INDEX IF NOT EXISTS household_invitations_household_idx ON household_invitations (household_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY,
  barcode text NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  image_url text,
  package_size text,
  source text NOT NULL DEFAULT 'openfoodfacts',
  source_attribution text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products (barcode);

CREATE TABLE IF NOT EXISTS household_inventory (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  barcode text,
  category text,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'item',
  package_size text,
  image_url text,
  date_value date,
  date_type text NOT NULL DEFAULT 'unknown' CHECK (date_type IN ('use_by','best_before','unknown')),
  original_date_text text,
  date_confidence text NOT NULL DEFAULT 'none' CHECK (date_confidence IN ('high','medium','low','none')),
  storage_location text NOT NULL DEFAULT 'pantry' CHECK (storage_location IN ('refrigerator','freezer','pantry','cupboard','other')),
  notes text,
  price numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  added_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_household_idx ON household_inventory (household_id);
CREATE INDEX IF NOT EXISTS inventory_household_date_idx ON household_inventory (household_id, date_value);
CREATE INDEX IF NOT EXISTS inventory_barcode_idx ON household_inventory (household_id, barcode);

CREATE TABLE IF NOT EXISTS inventory_events (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES household_inventory(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_events_household_idx ON inventory_events (household_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_events_inventory_idx ON inventory_events (inventory_id);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL,
  cooking_time_minutes integer NOT NULL DEFAULT 30,
  difficulty text NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard')),
  dietary_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  allergens jsonb NOT NULL DEFAULT '[]'::jsonb,
  cuisine text NOT NULL DEFAULT 'international',
  servings integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'item',
  optional boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id);

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  planned_for date NOT NULL,
  servings integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','cooked','skipped')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_plans_household_idx ON meal_plans (household_id, planned_for);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Shopping list',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_lists_household_idx ON shopping_lists (household_id);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id uuid PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'item',
  category text NOT NULL DEFAULT 'other',
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  added_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_items_household_idx ON shopping_list_items (household_id, checked);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS food_waste_records (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES household_inventory(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'item',
  reason text NOT NULL,
  estimated_value numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS waste_household_idx ON food_waste_records (household_id, created_at);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en',
  currency text NOT NULL DEFAULT 'USD',
  units text NOT NULL DEFAULT 'metric' CHECK (units IN ('metric','imperial')),
  notification_frequency text NOT NULL DEFAULT 'daily' CHECK (notification_frequency IN ('off','daily','weekly')),
  dietary_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  household_servings integer NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_household_idx ON audit_events (household_id, created_at);
