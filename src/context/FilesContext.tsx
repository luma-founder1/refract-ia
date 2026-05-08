import React, { createContext, useContext, useState, useCallback } from 'react';

export interface FilesContextValue {
  fileMap: Map<string, string>;
  setFileMap: (map: Map<string, string>) => void;
  clearFileMap: () => void;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export const FilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fileMap, setFileMapState] = useState<Map<string, string>>(new Map());

  const setFileMap = useCallback((map: Map<string, string>) => {
    setFileMapState(new Map(map));
  }, []);

  const clearFileMap = useCallback(() => {
    setFileMapState(new Map());
  }, []);

  return (
    <FilesContext.Provider value={{ fileMap, setFileMap, clearFileMap }}>
      {children}
    </FilesContext.Provider>
  );
};

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error('useFiles must be used within FilesProvider');
  return ctx;
}
