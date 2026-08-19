export type ConnectionStatus = {
  connected: boolean;
  message: string;
};

export type Theme = "light" | "dark" | "system";

export type CloudinaryUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  resourceType: string;
};
