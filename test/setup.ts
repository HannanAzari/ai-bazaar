import { beforeEach } from "vitest";

// Minimal in-memory localStorage so the demo libs (which guard on `window`)
// run under Node. Cleared before every test for isolation.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
const win = {
  localStorage: storage,
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

globalThis.localStorage = storage as unknown as Storage;
globalThis.window = win as unknown as Window & typeof globalThis;

beforeEach(() => storage.clear());
