import { useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';

const LoyaltyCardGenerator = ({ customer, qrToken, businessName, stamps, required, onImageGenerated }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !customer || !qrToken) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Configurar tamaño de la tarjeta
    canvas.width = 600;
    canvas.height = 350;

    // Colores del tema café
    const primaryColor = '#5c4033';
    const secondaryColor = '#d4a574';
    const textColor = '#1a1a1a';
    const bgColor = '#f5f0e8';

    // Fondo con gradiente
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, secondaryColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borde decorativo
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Nombre de la cafetería
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(businessName || 'Cafetería', canvas.width / 2, 50);

    // Línea separadora
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 65);
    ctx.lineTo(canvas.width - 50, 65);
    ctx.stroke();

    // Título "Tarjeta de Lealtad"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('TARJETA DE LEALTAD', canvas.width / 2, 95);

    // Información del cliente
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(customer.nombre, canvas.width / 2, 130);
    ctx.font = '14px Arial';
    ctx.fillText(customer.telefono, canvas.width / 2, 155);

    // Sellos
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${stamps} de ${required} Sellos`, canvas.width / 2, 185);

    // Dibujar círculos de sellos
    const startX = 80;
    const startY = 220;
    const spacing = 50;
    const radius = 18;

    for (let i = 0; i < required; i++) {
      const x = startX + (i * spacing);
      const y = startY;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      
      if (i < stamps) {
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Checkmark
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x - 2, y + 4);
        ctx.lineTo(x + 6, y - 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Generar QR code como imagen
    const qrCanvas = document.createElement('canvas');
    QRCode.toCanvas(qrCanvas, qrToken, { width: 100, margin: 1 }, (error) => {
      if (error) {
        console.error(error);
        return;
      }

      // Dibujar el QR en el canvas principal
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(canvas.width - 120, canvas.height - 120, 110, 110);
      ctx.drawImage(qrCanvas, canvas.width - 115, canvas.height - 115, 100, 100);

      // Texto "Escanea para acumular"
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Escanea para acumular', canvas.width - 65, canvas.height - 130);

      // Enviar la imagen generada
      const dataUrl = canvas.toDataURL('image/png');
      if (onImageGenerated) {
        onImageGenerated(dataUrl);
      }
    });
  }, [customer, qrToken, businessName, stamps, required, onImageGenerated]);

  return (
    <div style={{ display: 'none' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default LoyaltyCardGenerator;
