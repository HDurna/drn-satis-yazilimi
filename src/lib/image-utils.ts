/**
 * Compresses an image file using client-side canvas.
 * Resizes to a max dimension (default 800px) and converts to JPEG with quality 0.7.
 */
export const compressImage = async (file: File, maxWidth = 800, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = URL.createObjectURL(file);

        image.onload = () => {
            const canvas = document.createElement('canvas');
            let width = image.width;
            let height = image.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height *= maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width = Math.round((width *= maxWidth / height));
                    height = maxWidth;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.drawImage(image, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                },
                'image/jpeg',
                quality
            );

            // Clean up
            URL.revokeObjectURL(image.src);
        };

        image.onerror = (error) => {
            reject(error);
        };
    });
};
