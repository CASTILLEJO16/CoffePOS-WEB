import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Log from '../src/models/Log.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeepos';

async function cleanLogs() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Contar logs antes de limpiar
    const countBefore = await Log.countDocuments();
    console.log(`📊 Logs antes de limpiar: ${countBefore}`);

    // Eliminar todos los logs
    const result = await Log.deleteMany({});
    console.log(`🗑️ Logs eliminados: ${result.deletedCount}`);

    // Contar logs después de limpiar
    const countAfter = await Log.countDocuments();
    console.log(`📊 Logs después de limpiar: ${countAfter}`);

    console.log('✅ Limpieza completada');
  } catch (error) {
    console.error('❌ Error al limpiar logs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

cleanLogs();
