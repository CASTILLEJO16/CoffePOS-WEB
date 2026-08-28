/**
 * Modelo de Producto (Mongoose)
 * Define la estructura y operaciones básicas para productos
 */

import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  nombre: {
    type: String,
    required: true
  },
  precio: {
    type: Number,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  imagen: {
    type: String
  },
  activo: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 0
  },
  descuento: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Product', ProductSchema);
