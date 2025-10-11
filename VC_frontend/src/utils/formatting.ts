import { fileIcons } from '../data/mockData';

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const getFileIcon = (fileName: string, fileType: string): string => {
  if (fileType === 'directory') return fileIcons.directory;
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  return fileIcons[extension] || '📄';
};