import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { closeDb } from "../src/lib/database";

async function main() {
  const dataDir = resolve(process.env.PGLITE_DATA_DIR || "./data/pglite");
  console.log(`Closing database and removing ${dataDir}`);
  await closeDb();
  rmSync(dataDir, { recursive: true, force: true });
  console.log("Database reset. Run `npm run db:seed` to add the recipe catalogue.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
