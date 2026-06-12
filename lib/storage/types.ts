export type UploadResult = {
  key: string;
  publicUrl: string;
};

export interface ImageStorage {
  upload(file: File, path: string): Promise<UploadResult>;
  remove(key: string): Promise<void>;
}
