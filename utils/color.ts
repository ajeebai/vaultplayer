/**
 * Extracts the dominant color from an image blob.
 * It uses a simple bucketing algorithm on a canvas to find the most frequent color.
 * @param imageBlob The image blob (e.g., from a poster).
 * @returns A promise that resolves with the dominant color as an RGB string (e.g., "rgb(10,20,30)").
 */
export function getDominantColor(imageBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(imageBlob);
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = objectUrl;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject('Canvas context not available');
        return;
      }

      const width = image.width;
      const height = image.height;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const colorCounts: { [key: string]: number } = {};
        let maxCount = 0;
        let dominantRgb: string | null = null;
        
        // Downsample by skipping pixels to improve performance
        const sampleRate = Math.max(1, Math.floor(Math.sqrt(data.length / 4) / 100));

        for (let i = 0; i < data.length; i += 4 * sampleRate) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Ignore transparent, white, and black pixels for a more vibrant color
          if (a > 128 && (r > 10 || g > 10 || b > 10) && (r < 245 || g < 245 || b < 245)) {
            const rgb = `${r},${g},${b}`;
            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
            if (colorCounts[rgb] > maxCount) {
              maxCount = colorCounts[rgb];
              dominantRgb = rgb;
            }
          }
        }
        
        URL.revokeObjectURL(objectUrl);
        if (dominantRgb) {
            resolve(`rgb(${dominantRgb})`);
        } else {
            // Fallback to a neutral gray if no dominant color found
            resolve('rgb(128,128,128)');
        }
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };

    image.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
  });
}