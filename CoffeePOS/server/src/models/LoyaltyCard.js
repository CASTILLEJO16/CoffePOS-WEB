/**
 * Modelo de Tarjeta de Lealtad (Mongoose)
 * Define la estructura para tarjetas de lealtad con sistema de sellos
 */

import mongoose from 'mongoose';

const loyaltyCardSchema = new mongoose.Schema({
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
  qr_token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sellos_actuales: {
    type: Number,
    default: 0,
    min: 0
  },
  sellos_requeridos: {
    type: Number,
    default: 10,
    min: 1
  },
  recompensas_disponibles: {
    type: Number,
    default: 0,
    min: 0
  },
  estado: {
    type: String,
    enum: ['activa', 'bloqueada', 'deshabilitada'],
    default: 'activa'
  },
  ciclo_actual: {
    type: Number,
    default: 1
  },
  ultima_recompensa_canjeada: {
    type: Date
  }
}, {
  timestamps: true
});

// Índice compuesto para cliente + cafetería
loyaltyCardSchema.index({ customerId: 1, clientId: 1 }, { unique: true });

export default mongoose.model('LoyaltyCard', loyaltyCardSchema);
