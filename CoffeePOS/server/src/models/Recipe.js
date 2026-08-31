/**
 * Modelo de Receta (Mongoose)
 * Define las recetas de ingredientes por producto
 */

import mongoose from 'mongoose';

const RecipeSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  ingrediente_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  cantidad: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Índice compuesto para optimizar queries de recetas por cliente y producto
RecipeSchema.index({ clientId: 1, producto_id: 1 });

export default mongoose.model('Recipe', RecipeSchema);
