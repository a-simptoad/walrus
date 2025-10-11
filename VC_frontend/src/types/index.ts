export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: string | null;
  lastModified: string;
}

export interface Version {
  id: string;
  name: string;
  date: string;
  files: FileItem[];
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  commitCount: number;
  versions: Version[];
}