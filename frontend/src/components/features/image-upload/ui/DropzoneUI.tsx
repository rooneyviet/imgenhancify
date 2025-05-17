"use client";

import { useDropzone } from "react-dropzone-esm";
import { MAX_IMAGES, acceptedFileTypes } from "../constants";

interface DropzoneUIProps {
  onDrop: (acceptedFiles: File[], fileRejections: any[]) => void;
  error?: string | null;
}

export function DropzoneUI({ onDrop, error }: DropzoneUIProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true,
    maxFiles: MAX_IMAGES,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer mb-4
        ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/70"}
        ${error ? "border-destructive" : ""}
        transition-colors duration-200 ease-in-out`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-primary">Drop the images here...</p>
        ) : (
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 mx-auto mb-4 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338 0 4.5 4.5 0 0 1-1.41 8.775H6.75Z"
              />
            </svg>
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              Multiple images (up to {MAX_IMAGES}) - JPEG, PNG, WEBP, GIF
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <p className="mb-4 text-sm text-destructive text-center">{error}</p>
      )}
    </>
  );
}
