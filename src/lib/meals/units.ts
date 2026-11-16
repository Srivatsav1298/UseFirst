const MASS = new Set(["g", "kg"]);
const VOLUME = new Set(["ml", "l", "dl"]);

export function unitsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (MASS.has(a) && MASS.has(b)) return true;
  if (VOLUME.has(a) && VOLUME.has(b)) return true;
  return false;
}

function toBase(value: number, unit: string): number {
  if (unit === "kg" || unit === "l") return value * 1000;
  if (unit === "dl") return value * 100;
  return value;
}

function fromBase(value: number, unit: string): number {
  if (unit === "kg" || unit === "l") return value / 1000;
  if (unit === "dl") return value / 100;
  return value;
}

export function convertQuantity(value: number, from: string, to: string): number | null {
  if (from === to) return value;
  if (!unitsCompatible(from, to)) return null;
  return fromBase(toBase(value, from), to);
}
