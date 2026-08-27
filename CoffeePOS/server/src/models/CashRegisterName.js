/**
 * Modelo de Nombres de Caja (Mongoose)
 * Define los nombres disponibles para las cajas
 */

import mongoose from 'mongoose';

const CashRegisterNameSchema = new mongoose.Schema({
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

export default mongoose.model('CashRegisterName', CashRegisterNameSchema);
