import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET,
  ivaRate: parseFloat(process.env.IVA_RATE) || 0.16
};

// Validar que JWT_SECRET esté configurado
if (!config.jwtSecret) {
  console.error('❌ ERROR CRÍTICO: JWT_SECRET no está configurado en las variables de entorno.');
  console.error('Por favor configura JWT_SECRET en tu archivo .env antes de iniciar el servidor.');
  process.exit(1);
}
