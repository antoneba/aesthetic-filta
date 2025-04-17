import './Home.css';
import { useState, useRef, useEffect } from 'react';

function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setFinalImage(null);
        setShowModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the exact position where user clicked, accounting for any scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Draw the image with radial gradient
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the original image
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    
    // Create radial gradient (25% of image dimension instead of 50%)
    const gradientSize = Math.min(canvas.width, canvas.height) * 0.45;
    const gradient = ctx.createRadialGradient(
      x, y, 0,
      x, y, gradientSize
    );
    
    // Reduce the intensity from 0.7 to 0.4
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // Apply gradient
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply temperature and exposure adjustments
    ctx.globalCompositeOperation = 'source-over';
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // First adjust temperature (add blue, reduce red)
    for (let i = 0; i < data.length; i += 4) {
      // Decrease exposure by 5
      data[i] = Math.max(0, data[i] - 5);      // Red
      data[i + 1] = Math.max(0, data[i + 1] - 5); // Green
      data[i + 2] = Math.max(0, data[i + 2] - 5); // Blue
      
      // First adjust temperature (add blue, reduce red)
      let red = Math.max(0, data[i] - 5);
      let green = data[i + 1];
      let blue = Math.min(255, data[i + 2] + 5);
      
     

      

      // Finally increase contrast by +35
      const factor = (259 * (22 + 255)) / (255 * (259 - 22));
      red = Math.max(0, Math.min(255, Math.round(factor * (red - 128) + 128)));
      green = Math.max(0, Math.min(255, Math.round(factor * (green - 128) + 128)));
      blue = Math.max(0, Math.min(255, Math.round(factor * (blue - 128) + 128)));
      
      data[i] = red;
      data[i + 1] = green;
      data[i + 2] = blue;
    }
    
    // Apply clarity enhancement (local contrast) +18
    const clarityStrength = 18;
    const tempImageData = new ImageData(new Uint8ClampedArray(data), canvas.width, canvas.height);
    
    // For each pixel (except edges)
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const pixelIndex = (y * canvas.width + x) * 4;
        
        // For each color channel
        for (let c = 0; c < 3; c++) {
          // Calculate local average (excluding the center pixel)
          let sum = 0;
          sum += data[((y-1) * canvas.width + (x-1)) * 4 + c]; // top-left
          sum += data[((y-1) * canvas.width + x) * 4 + c];     // top
          sum += data[((y-1) * canvas.width + (x+1)) * 4 + c]; // top-right
          sum += data[(y * canvas.width + (x-1)) * 4 + c];     // left
          sum += data[(y * canvas.width + (x+1)) * 4 + c];     // right
          sum += data[((y+1) * canvas.width + (x-1)) * 4 + c]; // bottom-left
          sum += data[((y+1) * canvas.width + x) * 4 + c];     // bottom
          sum += data[((y+1) * canvas.width + (x+1)) * 4 + c]; // bottom-right
          
          const average = sum / 8;
          
          // Apply clarity: enhance difference between pixel and local average
          const currentValue = data[pixelIndex + c];
          const difference = currentValue - average;
          
          // Apply the clarity effect with the specified strength
          tempImageData.data[pixelIndex + c] = Math.max(0, Math.min(255, 
            currentValue + (difference * (clarityStrength / 100))
          ));
        }
      }
    }

    // Copy enhanced data back to original
    data.set(tempImageData.data);
    // Apply vignette effect with strength 25
    const vignetteStrength = 20;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Calculate distance from center (normalized)
        const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) / maxDistance;
        
        // Calculate darkening factor based on distance and strength
        const darkeningFactor = 1 - Math.min(1, distanceFromCenter * (vignetteStrength / 100));
        
        // Apply the vignette effect
        const pixelIndex = (y * canvas.width + x) * 4;
        data[pixelIndex] = Math.max(0, Math.round(data[pixelIndex] * darkeningFactor));
        data[pixelIndex + 1] = Math.max(0, Math.round(data[pixelIndex + 1] * darkeningFactor));
        data[pixelIndex + 2] = Math.max(0, Math.round(data[pixelIndex + 2] * darkeningFactor));
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Save the final image with max quality
    setFinalImage(canvas.toDataURL('image/png', 1.0));
    
    // Close modal after a short delay
    setTimeout(() => {
      setShowModal(false);
    }, 500);
  };

  // Setup canvas when modal is shown
  useEffect(() => {
    if (showModal && image && canvasRef.current) {
      const canvas = canvasRef.current;
      const img = new Image();
      img.onload = () => {
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw initial image
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        
        // Store image reference
        imageRef.current = img;
      };
      img.src = image;
    }
  }, [showModal, image]);

  const handleDownload = () => {
    if (!finalImage) return;
    
    // Check if user is on mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // For mobile devices, convert the base64 image to a blob first
      fetch(finalImage)
        .then(res => res.blob())
        .then(blob => {
          // Create object URL from blob
          const blobUrl = URL.createObjectURL(blob);
          
          // Check if we're on iOS (special handling needed)
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          
          if (isIOS) {
            // Try to use the share API which works better on iOS for saving to camera roll
            try {
              // Check if Share API with file support is available (iOS 15+)
              if (navigator.share && navigator.canShare) {
                const file = new File([blob], 'aesthetic-filta-image.png', { type: 'image/png' });
                const shareData = { files: [file] };
                
                // Check if this data can be shared on this device
                if (navigator.canShare(shareData)) {
                  navigator.share(shareData).catch(() => {
                    // If share fails, fall back to direct download
                    saveWithLink(blobUrl);
                  });
                  return; // Exit early if sharing is initiated
                }
              }
            } catch (error) {
              console.log('Share API error:', error);
            }
          }
          
          // For Android or iOS without share support, use direct download
          saveWithLink(blobUrl);
          
          // Clean up the object URL after download is triggered
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 100);
        });
    } else {
      // Desktop approach - use traditional download method
      saveWithLink(finalImage);
    }
  };
  
  // Helper function for traditional download approach
  const saveWithLink = (imageUrl: string) => {
    // Create a temporary link
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'aesthetic-filta-image.png';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  };

  return (
    <div className="home-container">
      <h1 className="title">Aesthetic Filta</h1>
      <p className="subtitle">The Simple & Free Editor for <span>🔥🔥&nbsp;Gym Photos</span></p>
      
      <div className="image-upload-container">
        <label htmlFor="image-upload" className="image-upload-area">
          {finalImage ? (
            <img src={finalImage} alt="Edited Preview" className="image-preview" />
          ) : image && !showModal ? (
            <img src={image} alt="Preview" className="image-preview" />
          ) : (
            <div className="upload-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="#888" style={{ marginBottom: '10px' }}>
                <path d="M12 9a3 3 0 100 6 3 3 0 000-6zm0 8a5 5 0 110-10 5 5 0 010 10z"/>
                <path d="M20 6h-4l-2-2H10L8 6H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h4.05l.59-.65L9.88 6h4.24l1.24 1.35.59.65H20v10z"/>
              </svg>
              <span>Drop image here or click to upload</span>
            </div>
          )}
          <input 
            type="file" 
            id="image-upload" 
            accept="image/*" 
            onChange={handleImageUpload} 
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {finalImage && (
        <button className="download-button" onClick={handleDownload}>
          Download Image
        </button>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Click the very top of your head</h3>
            </div>
            <div className="canvas-container">
              <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                className="edit-canvas"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home; 