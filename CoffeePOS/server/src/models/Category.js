/**
 * Modelo de Categoría (Mongoose)
 * Define las categorías de productos
 */

import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Category', CategorySchema);
