import React, { useRef } from 'react';
import { fileToBase64, Base64File } from '../utils/fileUtils';
import { UploadIcon, TrashIcon } from './icons';

interface ImageUploaderProps {
  title: string;
  image: Base64File | null;
  onImageChange: (file: Base64File | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ title, image, onImageChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = image ? `data:${image.mimeType};base64,${image.base64}` : null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const base64File = await fileToBase64(file);
        onImageChange(base64File);
      } catch (error) {
        console.error("Error converting file to base64:", error);
        onImageChange(null);
      }
    }
  };

  const handleClear = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
       try {
        const base64File = await fileToBase64(file);
        onImageChange(base64File);
      } catch (error) {
        console.error("Error converting file to base64:", error);
        onImageChange(null);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-2xl p-6 flex flex-col items-center justify-center aspect-square shadow-lg transition-all duration-300 hover:border-purple-400 hover:bg-gray-800">
      <h2 className="text-xl font-semibold text-gray-300 mb-4">{title}</h2>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        id={`file-upload-${title.replace(/\s+/g, '-')}`}
      />
      {previewUrl ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
            aria-label="Remove image"
          >
            <TrashIcon />
          </button>
        </div>
      ) : (
        <label
          htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`}
          className="w-full h-full flex flex-col items-center justify-center text-center cursor-pointer text-gray-500"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <UploadIcon />
          <p className="mt-2">
            <span className="font-semibold text-purple-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-600">PNG, JPG, WEBP</p>
        </label>
      )}
    </div>
  );
};
