/**
 * Modelo de Personalización (Mongoose)
 * Define las opciones de personalización para productos
 */

import mongoose from 'mongoose';

const PersonalizationSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  precio_adicional: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Personalization', PersonalizationSchema);
