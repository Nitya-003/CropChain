"use client";
import React from 'react';
import { FileText, Download, Trash2, Image as ImageIcon } from 'lucide-react';
import { DocumentData } from '../services/realCropBatchService';
import { API_URL } from '../services/apiClient';
import toast from 'react-hot-toast';

interface DocumentGalleryProps {
  documents: DocumentData[];
  batchId: string;
  canDelete?: boolean;
  onDelete?: (docId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) {
    return <ImageIcon className="h-8 w-8 text-green-500" />;
  }
  return <FileText className="h-8 w-8 text-blue-500" />;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function DocumentGallery({ documents, batchId, canDelete, onDelete }: DocumentGalleryProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <FileText className="mx-auto h-12 w-12 opacity-50 mb-2" />
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  const handleDownload = (doc: DocumentData) => {
    const link = document.createElement('a');
    link.href = API_URL.replace('/api', '') + doc.url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (docId: string) => {
    if (!onDelete) return;
    try {
      await onDelete(docId);
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {documents.map((doc) => (
        <div
          key={doc.docId}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
        >
          <div className="flex items-center gap-3 mb-3">
            {doc.fileType.startsWith('image/') ? (
              <img
                src={API_URL.replace('/api', '') + doc.url}
                alt={doc.fileName}
                className="h-16 w-16 object-cover rounded border"
              />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center rounded border bg-gray-100 dark:bg-gray-700">
                {getFileIcon(doc.fileType)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.fileName}</p>
              <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</p>
              <p className="text-xs text-gray-500">{formatDate(doc.uploadedAt)}</p>
            </div>
          </div>
          {doc.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{doc.description}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(doc)}
              className="flex-1 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            {canDelete && (
              <button
                onClick={() => handleDelete(doc.docId)}
                className="py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
