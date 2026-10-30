/** Firestore can't store an array inside an array, so inner arrays are wrapped on the way in. */
const WRAP = '__array';

export function encodeNested<T>(value: T, inArray = false): T {
  if (Array.isArray(value)) {
    const items = value.map((item) => encodeNested(item, true));
    return (inArray ? { [WRAP]: items } : items) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeNested(v)])) as T;
  }
  return value;
}

export function decodeNested<T>(value: T): T {
  if (Array.isArray(value)) return value.map(decodeNested) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    if (WRAP in record) return decodeNested(record[WRAP]) as T;
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, decodeNested(v)])) as T;
  }
  return value;
}
