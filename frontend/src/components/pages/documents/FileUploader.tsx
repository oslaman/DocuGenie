import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  onFilesAdded: (files: File[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesAdded }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAdded(acceptedFiles);
  }, [onFilesAdded]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: 'application/pdf',
  });

  return (
    <div {...getRootProps()} className="border-dashed border-2 p-4 text-center">
      <input {...getInputProps()} />
      <p>Drag 'n' drop some files here, or click to select files</p>
    </div>
  );
};

export default FileUploader;
