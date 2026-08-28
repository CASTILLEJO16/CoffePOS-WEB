/**
 * Modelo de Venta (Mongoose)
 * Define la estructura y operaciones básicas para ventas
 */

import mongoose from 'mongoose';

const SaleSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  numero_venta: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  subtotal: {
    type: Number,
    required: true
  },
  impuestos: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  metodo_pago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'otros', 'dolar', 'mixto'],
    default: 'efectivo'
  },
  tipo_tarjeta: {
    type: String
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caja_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashRegister'
  },
  iva_rate: {
    type: Number,
    default: 0.16
  },
  cancelada: {
    type: Boolean,
    default: false
  },
  devuelta: {
    type: Boolean,
    default: false
  },
  motivo_devolucion: {
    type: String
  },
  tipo_cambio: {
    type: Number
  },
  monto_dolar: {
    type: Number
  },
  dolar_recibido: {
    type: Number
  },
  cambio_pesos: {
    type: Number
  },
  efectivo_mxn: {
    type: Number,
    default: 0
  },
  efectivo_usd: {
    type: Number,
    default: 0
  },
  tarjeta_credito: {
    type: Number,
    default: 0
  },
  tarjeta_debito: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Sale', SaleSchema);
