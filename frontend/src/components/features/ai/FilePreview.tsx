'use client';

import { FileText, Image, X } from 'lucide-react';

interface FilePreviewProps {
  files: Array<{
    file: File;
    preview?: string; // 图片的 data URL 预览
  }>;
  onRemove: (index: number) => void;
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-1">
      {files.map((item, index) => (
        <div
          key={index}
          className="group relative flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-2xs-plus shadow-sm"
        >
          {item.preview ? (
            <img
              src={item.preview}
              alt={item.file.name}
              className="h-8 w-8 rounded object-cover"
            />
          ) : item.file.type === 'application/pdf' ? (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-red-50 text-red-500">
              <FileText className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-50 text-indigo-500">
              <Image className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 max-w-[120px]">
            <p className="truncate text-foreground">{item.file.name}</p>
            <p className="text-muted-foreground/60">
              {item.file.size < 1024
                ? `${item.file.size}B`
                : item.file.size < 1024 * 1024
                  ? `${(item.file.size / 1024).toFixed(0)}KB`
                  : `${(item.file.size / (1024 * 1024)).toFixed(1)}MB`}
            </p>
          </div>
          <button
            onClick={() => onRemove(index)}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-opacity hover:bg-red-100 hover:text-red-500 group-hover:opacity-100"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
