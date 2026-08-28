/**
 * Modelo de Configuración (Mongoose)
 * Define la configuración general del sistema
 */

import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  clave: {
    type: String,
    required: true
  },
  valor: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

ConfigSchema.index({ clave: 1, clientId: 1 }, { unique: true });

export default mongoose.model('Config', ConfigSchema);
