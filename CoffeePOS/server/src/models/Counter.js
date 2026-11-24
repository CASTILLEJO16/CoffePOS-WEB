/**
 * Modelo de Contador (Mongoose)
 * Secuencias atómicas por cafetería (número de venta, número de ticket abierto, etc.)
 */

import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

CounterSchema.index({ clientId: 1, name: 1 }, { unique: true });

export default mongoose.model('Counter', CounterSchema);
