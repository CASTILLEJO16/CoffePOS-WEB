/**
 * Modelo de Caja (Mongoose)
 * Define la estructura y operaciones básicas para cajas
 */

import mongoose from 'mongoose';

const CashRegisterSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nombre_caja: {
    type: String
  },
  fondo_inicial: {
    type: Number,
    default: 0
  },
  fecha_apertura: {
    type: Date,
    default: Date.now
  },
  fecha_cierre: {
    type: Date
  },
  ventas_efectivo: {
    type: Number,
    default: 0
  },
  ventas_tarjeta: {
    type: Number,
    default: 0
  },
  ventas_transferencia: {
    type: Number,
    default: 0
  },
  ventas_otros: {
    type: Number,
    default: 0
  },
  total_descuentos: {
    type: Number,
    default: 0
  },
  total_devoluciones: {
    type: Number,
    default: 0
  },
  total_esperado: {
    type: Number,
    default: 0
  },
  total_contado: {
    type: Number,
    default: 0
  },
  diferencia: {
    type: Number,
    default: 0
  },
  observaciones: {
    type: String
  },
  estado: {
    type: String,
    enum: ['abierta', 'cerrada'],
    default: 'abierta'
  }
}, {
  timestamps: true
});

// Método para verificar si está abierta
CashRegisterSchema.methods.isOpen = function() {
  return this.estado === 'abierta';
};

// Método para calcular total de ventas
CashRegisterSchema.methods.getTotalVentas = function() {
  return this.ventas_efectivo + this.ventas_tarjeta + this.ventas_transferencia + this.ventas_otros;
};

// Método para calcular total esperado
CashRegisterSchema.methods.calcularTotalEsperado = function() {
  return this.fondo_inicial + this.ventas_efectivo - this.total_devoluciones;
};

export default mongoose.model('CashRegister', CashRegisterSchema);
