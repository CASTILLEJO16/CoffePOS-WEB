/**
 * Modelo de Ingrediente (Mongoose)
 * Define los ingredientes para el almacén
 */

import mongoose from 'mongoose';

const IngredientSchema = new mongoose.Schema({
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
  unidad_medida: {
    type: String,
    required: true
  },
  stock_actual: {
    type: Number,
    default: 0
  },
  stock_minimo: {
    type: Number,
    default: 0
  },
  categoria_reemplazo: {
    type: String
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto para optimizar queries de stock bajo por cliente
IngredientSchema.index({ clientId: 1, stock_actual: 1 });

export default mongoose.model('Ingredient', IngredientSchema);
