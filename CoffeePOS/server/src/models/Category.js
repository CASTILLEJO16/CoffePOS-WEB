/**
 * Modelo de Categoría (Mongoose)
 * Define las categorías de productos
 */

import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
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
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto único para nombre + clientId
CategorySchema.index({ nombre: 1, clientId: 1 }, { unique: true });

export default mongoose.model('Category', CategorySchema);
