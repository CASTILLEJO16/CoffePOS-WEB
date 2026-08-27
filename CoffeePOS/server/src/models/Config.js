/**
 * Modelo de Configuración (Mongoose)
 * Define la configuración general del sistema
 */

import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  clave: {
    type: String,
    required: true,
    unique: true
  },
  valor: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Config', ConfigSchema);
