/**
 * Modelo de Receta de Personalización (Mongoose)
 * Define las recetas de ingredientes para personalizaciones
 */

import mongoose from 'mongoose';

const RecipePersonalizationSchema = new mongoose.Schema({
  personalizacion_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personalization',
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

export default mongoose.model('RecipePersonalization', RecipePersonalizationSchema);
