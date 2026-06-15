import { LocalMockStorage } from "@/lib/storage/local";
import { SupabaseStorage } from "@/lib/storage/supabase";
import type { ImageStorage } from "@/lib/storage/types";
import { type RuntimeMode, getRuntimeMode } from "@/lib/runtime-mode";

// Image storage factory — runtime mode → implementation, mirroring getRepositories()
// and getAuthClient(). Demo uses the local mock; production uses Supabase Storage.
// The studio components never change; only the driver does.
export function getImageStorage(mode: RuntimeMode = getRuntimeMode()): ImageStorage {
  return mode === "production" ? new SupabaseStorage() : new LocalMockStorage();
}
