import { LocalMockStorage } from "@/lib/storage/local";
import type { ImageStorage } from "@/lib/storage/types";

// Swap this factory to an R2 implementation without changing studio components.
export function getImageStorage(): ImageStorage {
  return new LocalMockStorage();
}
