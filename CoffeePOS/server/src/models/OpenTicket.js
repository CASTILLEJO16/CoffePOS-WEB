/**
 * Modelo de Ticket Abierto (Mongoose)
 * Define la estructura para cuentas/tickets abiertos
 */

import mongoose from 'mongoose';

const openTicketSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  numero_ticket: {
    type: Number,
    required: true
  },
  numero_mesa: {
    type: String,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  empleado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  estado: {
    type: String,
    enum: ['abierta', 'en_proceso_cobro', 'pagada', 'cancelada'],
    default: 'abierta'
  },
  subtotal: {
    type: Number,
    default: 0
  },
  impuestos: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  iva_rate: {
    type: Number,
    default: 0.16
  },
  fecha_apertura: {
    type: Date,
    default: Date.now
  },
  fecha_cierre: {
    type: Date
  },
  venta_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    index: true
  },
  observaciones: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para consultas frecuentes
openTicketSchema.index({ clientId: 1, estado: 1, fecha_apertura: -1 });
openTicketSchema.index({ numero_mesa: 1, estado: 1 });
openTicketSchema.index({ empleado_id: 1, estado: 1 });

export default mongoose.model('OpenTicket', openTicketSchema);
