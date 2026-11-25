/**
 * Modelo de Recompensa (Mongoose)
 * Define la estructura para recompensas canjeadas
 */

import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
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
    index: true
  },
  empleado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  producto_recompensa: {
    type: String,
    required: true
  },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  ciclo: {
    type: Number,
    required: true
  },
  // 'main' (tarjeta completa) o 'tier:<id>' (nivel)
  clave: {
    type: String,
    default: 'main'
  },
  descuento: {
    type: Number,
    default: 0
  },
  // true si la venta se canceló/devolvió y la recompensa se le regresó al cliente
  revertida: {
    type: Boolean,
    default: false
  },
  fecha_canje: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para consultas frecuentes
rewardSchema.index({ customerId: 1, fecha_canje: -1 });
rewardSchema.index({ loyaltyCardId: 1, ciclo: 1 });

export default mongoose.model('Reward', rewardSchema);
