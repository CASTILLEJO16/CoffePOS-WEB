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

export default mongoose.model('Recipe', RecipeSchema);
