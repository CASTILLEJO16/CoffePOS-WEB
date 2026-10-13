/**
 * Modelo de Item de Ticket Abierto (Mongoose)
 * Define la estructura para productos en cuentas/tickets abiertos
 */

import mongoose from 'mongoose';

const openTicketItemSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  openTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OpenTicket',
    required: true,
    index: true
  },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  producto_nombre: {
    type: String,
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1
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
  },
  promocion_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promotion'
  },
  promocion_nombre: {
    type: String
  },
  isCombo: {
    type: Boolean,
    default: false
  },
  comboData: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Índice para items por ticket
openTicketItemSchema.index({ openTicketId: 1, createdAt: -1 });

export default mongoose.model('OpenTicketItem', openTicketItemSchema);
