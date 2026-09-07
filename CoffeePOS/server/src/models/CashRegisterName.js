/**
 * Modelo de Nombres de Caja (Mongoose)
 * Define los nombres disponibles para las cajas
 */

import mongoose from 'mongoose';

const CashRegisterNameSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  nombre: {
    type: String,
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice para búsquedas por cafetería; el duplicado se valida en controlador por clientId
// Permite que "Caja 2" exista en diferentes clientId sin colisión
CashRegisterNameSchema.index({ clientId: 1, nombre: 1 });

export default mongoose.model('CashRegisterName', CashRegisterNameSchema);
