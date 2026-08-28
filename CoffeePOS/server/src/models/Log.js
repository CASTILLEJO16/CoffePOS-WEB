/**
 * Modelo de Log (Mongoose)
 * Define la estructura y operaciones básicas para logs de auditoría
 */

import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  accion: {
    type: String,
    required: true
  },
  detalles: {
    type: String
  }
}, {
  timestamps: true
});

export default mongoose.model('Log', LogSchema);
