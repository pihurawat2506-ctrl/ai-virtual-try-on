interface DownloadImageOptions {
  imageUrl: string;
  filter: string;
  filename: string;
}

/**
 * Downloads an image from a data URL, applying a CSS filter before saving.
 * @param {DownloadImageOptions} options - The options for downloading the image.
 * @returns {Promise<void>} A promise that resolves when the download is initiated.
 */
export const downloadImage = ({ imageUrl, filter, filename }: DownloadImageOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      return reject(new Error("No image URL provided for download."));
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageUrl;

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error("Could not get canvas 2D context."));
        }

        // Apply the filter to the canvas context
        ctx.filter = filter;
        ctx.drawImage(image, 0, 0);

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        
        // Append to DOM, click, and then remove for cross-browser compatibility
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${imageUrl}`));
    };
  });
};
