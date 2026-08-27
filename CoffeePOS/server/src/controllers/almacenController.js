import mongoose from 'mongoose';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import RecipePersonalization from '../models/RecipePersonalization.js';

export async function getIngredientes(req, res) {
  try {
    const ingredientes = await Ingredient.find({ activo: true }).sort({ nombre: 1 });
    res.json({ success: true, data: ingredientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createIngrediente(req, res) {
  try {
    const { nombre, unidad_medida, stock_minimo, categoria_reemplazo } = req.body;
    if (!nombre || !unidad_medida) throw new Error('Nombre y unidad de medida requeridos');
    
    const newIngrediente = await Ingredient.create({
      nombre,
      unidad_medida,
      stock_minimo: stock_minimo || 0,
      categoria_reemplazo: categoria_reemplazo || null
    });
    
    res.status(201).json({ success: true, data: newIngrediente });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateIngrediente(req, res) {
  try {
    const { id } = req.params;
    const { nombre, unidad_medida, stock_minimo, categoria_reemplazo } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const updatedIngrediente = await Ingredient.findByIdAndUpdate(
      id,
      { nombre, unidad_medida, stock_minimo, categoria_reemplazo },
      { new: true }
    );
    
    if (!updatedIngrediente) {
      return res.status(404).json({ success: false, error: 'Ingrediente no encontrado' });
    }
    
    res.json({ success: true, data: updatedIngrediente });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteIngrediente(req, res) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const result = await Ingredient.findByIdAndUpdate(id, { activo: false });
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Ingrediente no encontrado' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function ajustarStock(req, res) {
  try {
    const { id } = req.params;
    const { cantidad, tipo, observaciones } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    if (tipo === 'agregar') {
      await Ingredient.findByIdAndUpdate(id, { $inc: { stock_actual: cantidad } });
    } else {
      await Ingredient.findByIdAndUpdate(id, { stock_actual: cantidad });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRecetaProducto(req, res) {
  try {
    const { id } = req.params;
    console.log('Buscando receta para producto ID:', id);
    console.log('ID es ObjectId válido?', mongoose.Types.ObjectId.isValid(id));
    
    const receta = await Recipe.aggregate([
      { $match: { producto_id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id }},
      { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
      { $unwind: '$ingrediente' },
      { $match: { 'ingrediente.activo': true }},
      { $project: {
        ingrediente_id: 1,
        cantidad: 1,
        nombre: '$ingrediente.nombre',
        unidad_medida: '$ingrediente.unidad_medida'
      }}
    ]);
    
    console.log('Receta encontrada:', receta);
    res.json({ success: true, data: receta });
  } catch (error) {
    console.error('Error en getRecetaProducto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function saveRecetaProducto(req, res) {
  try {
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID de producto inválido' });
    }
    
    // Validar que cada ingrediente tenga un ID válido
    if (ingredientes && ingredientes.length > 0) {
      for (const ing of ingredientes) {
        if (!mongoose.Types.ObjectId.isValid(ing.ingrediente_id)) {
          return res.status(400).json({ success: false, error: 'ID de ingrediente inválido' });
        }
        if (!ing.cantidad || ing.cantidad <= 0) {
          return res.status(400).json({ success: false, error: 'La cantidad debe ser mayor a 0' });
        }
      }
    }
    
    await Recipe.deleteMany({ producto_id: new mongoose.Types.ObjectId(id) });
    
    if (ingredientes && ingredientes.length > 0) {
      await Recipe.insertMany(
        ingredientes.map(ing => ({
          producto_id: new mongoose.Types.ObjectId(id),
          ingrediente_id: new mongoose.Types.ObjectId(ing.ingrediente_id),
          cantidad: ing.cantidad
        }))
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRecetaPersonalizacion(req, res) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const receta = await RecipePersonalization.aggregate([
      { $match: { personalizacion_id: new mongoose.Types.ObjectId(id) }},
      { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
      { $unwind: '$ingrediente' },
      { $match: { 'ingrediente.activo': true }},
      { $project: {
        ingrediente_id: 1,
        cantidad: 1,
        nombre: '$ingrediente.nombre',
        unidad_medida: '$ingrediente.unidad_medida'
      }}
    ]);
    res.json({ success: true, data: receta });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function saveRecetaPersonalizacion(req, res) {
  try {
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID de personalización inválido' });
    }
    
    // Validar que cada ingrediente tenga un ID válido
    if (ingredientes && ingredientes.length > 0) {
      for (const ing of ingredientes) {
        if (!mongoose.Types.ObjectId.isValid(ing.ingrediente_id)) {
          return res.status(400).json({ success: false, error: 'ID de ingrediente inválido' });
        }
        if (!ing.cantidad || ing.cantidad <= 0) {
          return res.status(400).json({ success: false, error: 'La cantidad debe ser mayor a 0' });
        }
      }
    }
    
    await RecipePersonalization.deleteMany({ personalizacion_id: new mongoose.Types.ObjectId(id) });
    
    if (ingredientes && ingredientes.length > 0) {
      await RecipePersonalization.insertMany(
        ingredientes.map(ing => ({
          personalizacion_id: new mongoose.Types.ObjectId(id),
          ingrediente_id: new mongoose.Types.ObjectId(ing.ingrediente_id),
          cantidad: ing.cantidad
        }))
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
