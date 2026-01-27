export interface OneDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  thumbnails?: Array<{ 
    small?: { url: string };
    medium?: { url: string };
    large?: { url: string };
  }>;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
