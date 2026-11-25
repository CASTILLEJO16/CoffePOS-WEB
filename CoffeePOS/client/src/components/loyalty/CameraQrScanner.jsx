import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X } from 'lucide-react';

/**
 * Lector de QR con la cámara del dispositivo (tablet, celular o laptop).
 * Llama onDetect(texto) en cuanto lee un código y se cierra solo.
 * Requiere HTTPS o localhost (regla del navegador para usar la cámara).
 */
export default function CameraQrScanner({ onDetect, onClose, title = 'Escanear tarjeta' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  // Ref para no reiniciar la cámara cada vez que el padre se vuelve a renderizar
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    let stream;
    let rafId;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Reducir resolución: más rápido y suficiente para un QR
        const scale = Math.min(1, 640 / (video.videoWidth || 640));
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          stop();
          if (navigator.vibrate) navigator.vibrate(80);
          onDetectRef.current(code.data);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Usa un lector USB o escribe el teléfono.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        rafId = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Actívalo en el navegador o usa un lector USB.'
            : 'No se pudo abrir la cámara.'
        );
      }
    })();

    return stop;
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', borderRadius: 16, padding: 16, width: 'min(420px, 100%)', color: '#fff' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>{title}</strong>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>
        {error ? (
          <p style={{ color: '#fca5a5', margin: '24px 0' }}>{error}</p>
        ) : (
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <video ref={videoRef} muted style={{ width: '100%', display: 'block' }} />
            <div
              style={{
                position: 'absolute', inset: '15%', border: '3px solid #10b981',
                borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)'
              }}
            />
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 12, marginBottom: 0 }}>
          Apunta al código QR de la tarjeta del cliente.
        </p>
      </div>
    </div>
  );
}
