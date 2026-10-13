/**
 * Modelo de Historial de Sellos (Mongoose)
 * Define el historial de sellos otorgados para auditoría
 */

import mongoose from 'mongoose';

const stampHistorySchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  loyaltyCardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoyaltyCard',
    required: true,
    index: true
  },
  venta_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true
  },
  empleado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    enum: ['otorgado', 'revertido'],
    required: true
  },
  numero_sello: {
    type: Number,
    required: true
  },
  motivo_reversion: {
    type: String
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para consultas frecuentes
stampHistorySchema.index({ venta_id: 1, tipo: 1 });
stampHistorySchema.index({ loyaltyCardId: 1, fecha: -1 });

export default mongoose.model('StampHistory', stampHistorySchema);
