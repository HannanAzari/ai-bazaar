import type { ImageStorage, UploadResult } from "@/lib/storage/types";

export class LocalMockStorage implements ImageStorage {
  async upload(file: File, path: string): Promise<UploadResult> {
    return {
      key: path,
      publicUrl: URL.createObjectURL(file),
    };
  }

  async remove() {
    return Promise.resolve();
  }
}
