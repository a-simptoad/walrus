import type { Repository } from '../types/index.ts';

export const mockRepositories: Repository[] = [
  {
    id: "repo-1",
    name: "my-awesome-project",
    description: "A full-stack web application",
    lastUpdated: "2025-10-10T14:30:00Z",
    commitCount: 15,
    versions: [
      {
        id: "v1.2.0", name: "v1.2.0", date: "2025-10-10T14:30:00Z",
        files: [
          { name: "src", type: "directory", size: null, lastModified: "2025-10-10T14:30:00Z" },
          { name: "package.json", type: "file", size: "2.1 KB", lastModified: "2025-10-10T14:30:00Z" },
          { name: "README.md", type: "file", size: "3.5 KB", lastModified: "2025-10-09T10:15:00Z" },
          { name: "vite.config.ts", type: "file", size: "1.2 KB", lastModified: "2025-10-08T16:45:00Z" }
        ]
      },
      // ... (rest of the versions for repo-1)
    ]
  },
  {
    id: "repo-2",
    name: "data-analysis-toolkit",
    description: "Python scripts for data processing",
    lastUpdated: "2025-10-11T11:20:00Z",
    commitCount: 8,
    versions: [
       // ... (versions for repo-2)
    ]
  },
  {
    id: "repo-3",
    name: "mobile-app-ui",
    description: "React Native mobile application",
    lastUpdated: "2025-10-12T08:45:00Z",
    commitCount: 23,
    versions: [
        // ... (versions for repo-3)
    ]
  }
];

export const fileIcons: { [key: string]: string } = {
  '.json': '📄',
  '.md': '📝',
  '.ts': '💻',
  '.tsx': '⚛️',
  '.py': '🐍',
  '.js': '💛',
  'directory': '📁'
};