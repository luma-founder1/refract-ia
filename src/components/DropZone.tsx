import React, { useState, useRef } from 'react'
import { Upload, FolderOpen } from 'lucide-react'

interface DropZoneProps {
  onFiles: (files: File[] | FileList) => void
}

export const DropZone: React.FC<DropZoneProps> = ({ onFiles }) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) {
      const files = e.dataTransfer.files;
      if (files.length > 0) onFiles(files);
      return;
    }

    const filesArray: File[] = [];
    
    const readEntry = async (entry: any, path = '') => {
      if (entry.isFile) {
        return new Promise<void>((resolve) => {
          entry.file((file: File) => {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: path + file.name
            });
            filesArray.push(file);
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries: any[] = await new Promise((resolve) => {
          dirReader.readEntries((res: any[]) => resolve(res));
        });
        for (const subEntry of entries) {
          await readEntry(subEntry, path + entry.name + '/');
        }
      }
    };

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) promises.push(readEntry(entry));
      }
    }

    await Promise.all(promises);
    if (filesArray.length > 0) {
      onFiles(filesArray);
    } else if (e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFiles(files)
    }
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '48px 32px',
        textAlign: 'center',
        cursor: 'pointer',
        background: isDragging ? 'var(--accent)' : 'var(--background)',
        transition: 'all 0.2s ease',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        {...({ webkitdirectory: "true", directory: "true" } as any)}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <div style={{ marginBottom: 16 }}>
        {isDragging ? (
          <Upload size={48} color="var(--primary)" />
        ) : (
          <FolderOpen size={48} color="var(--muted-foreground)" />
        )}
      </div>
      
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--foreground)', marginBottom: 8 }}>
        {isDragging ? 'Drop your project folder here' : 'Select a project folder'}
      </p>
      
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        Drag and drop or click to browse
      </p>
    </div>
  )
}
