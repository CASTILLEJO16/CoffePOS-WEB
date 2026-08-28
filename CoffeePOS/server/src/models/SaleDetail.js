/**
 * Modelo de Detalle de Venta (Mongoose)
 * Define la estructura y operaciones básicas para detalles de venta
 */

import mongoose from 'mongoose';

const SaleDetailSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  venta_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  cantidad: {
    type: Number,
    required: true
  },
  precio: {
    type: Number,
    required: true
  },
  importe: {
    type: Number,
    required: true
  },
  personalizaciones: {
    type: String
  },
  descuento: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('SaleDetail', SaleDetailSchema);
