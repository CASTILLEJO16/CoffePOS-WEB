/**
 * Modelo de Cliente Individual (Mongoose)
 * Define la estructura para clientes individuales del programa de lealtad
 * NOTA: Este es diferente del modelo "Client" que representa la cafetería
 */

import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  telefono: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  fecha_registro: {
    type: Date,
    default: Date.now
  },
  notas: {
    type: String,
    trim: true
  },
  loyaltyCardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoyaltyCard'
  }
}, {
  timestamps: true
});

// Índice único para teléfono + clientId (evita duplicados por cafetería)
customerSchema.index({ telefono: 1, clientId: 1 }, { unique: true });

export default mongoose.model('Customer', customerSchema);
