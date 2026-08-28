import mongoose from 'mongoose';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import RecipePersonalization from '../models/RecipePersonalization.js';

export async function getIngredientes(req, res) {
  try {
    const clientId = req.user?.clientId;
    const ingredientes = await Ingredient.find({ clientId, activo: true }).sort({ nombre: 1 });
    res.json({ success: true, data: ingredientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createIngrediente(req, res) {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId requerido' });
    const { nombre, unidad_medida, stock_minimo, categoria_reemplazo } = req.body;
    if (!nombre || !unidad_medida) throw new Error('Nombre y unidad de medida requeridos');
    
    const newIngrediente = await Ingredient.create({
      clientId,
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
    const clientId = req.user?.clientId;
    const { id } = req.params;
    const { nombre, unidad_medida, stock_minimo, categoria_reemplazo } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    // Verificar ownership
    const existing = await Ingredient.findOne({ _id: id, clientId });
    if (!existing) return res.status(404).json({ success: false, error: 'Ingrediente no encontrado' });

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
    const clientId = req.user?.clientId;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const result = await Ingredient.findOneAndUpdate({ _id: id, clientId }, { activo: false });
    
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
    const clientId = req.user?.clientId;
    const { id } = req.params;
    const { cantidad, tipo, observaciones } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    
    const ing = await Ingredient.findOne({ _id: id, clientId });
    if (!ing) return res.status(404).json({ success: false, error: 'Ingrediente no encontrado' });

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
    const clientId = req.user?.clientId;
    const { id } = req.params;
    
    // Verificar que el producto pertenezca al cliente
    const Product = (await import('../models/Product.js')).default;
    const prod = await Product.findOne({ _id: id, clientId });
    if (!prod) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    const receta = await Recipe.aggregate([
      { $match: { producto_id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id, clientId: new mongoose.Types.ObjectId(clientId) }},
      { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
      { $unwind: '$ingrediente' },
      { $match: { 'ingrediente.activo': true, 'ingrediente.clientId': new mongoose.Types.ObjectId(clientId) }},
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
    const clientId = req.user?.clientId;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId requerido' });
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID de producto inválido' });
    }

    const Product = (await import('../models/Product.js')).default;
    const prod = await Product.findOne({ _id: id, clientId });
    if (!prod) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    
    // Validar que cada ingrediente tenga un ID válido y pertenezca al cliente
    if (ingredientes && ingredientes.length > 0) {
      for (const ing of ingredientes) {
        if (!mongoose.Types.ObjectId.isValid(ing.ingrediente_id)) {
          return res.status(400).json({ success: false, error: 'ID de ingrediente inválido' });
        }
        if (!ing.cantidad || ing.cantidad <= 0) {
          return res.status(400).json({ success: false, error: 'La cantidad debe ser mayor a 0' });
        }
        const ingDoc = await Ingredient.findOne({ _id: ing.ingrediente_id, clientId });
        if (!ingDoc) return res.status(400).json({ success: false, error: 'Ingrediente no pertenece a este negocio' });
      }
    }
    
    await Recipe.deleteMany({ producto_id: new mongoose.Types.ObjectId(id), clientId });
    
    if (ingredientes && ingredientes.length > 0) {
      await Recipe.insertMany(
        ingredientes.map(ing => ({
          clientId,
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
    const clientId = req.user?.clientId;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const pers = await (await import('../models/Personalization.js')).default.findOne({ _id: id, clientId });
    if (!pers) return res.status(404).json({ success: false, error: 'Personalización no encontrada' });
    
    const receta = await RecipePersonalization.aggregate([
      { $match: { personalizacion_id: new mongoose.Types.ObjectId(id), clientId: new mongoose.Types.ObjectId(clientId) }},
      { $lookup: { from: 'ingredients', localField: 'ingrediente_id', foreignField: '_id', as: 'ingrediente' }},
      { $unwind: '$ingrediente' },
      { $match: { 'ingrediente.activo': true, 'ingrediente.clientId': new mongoose.Types.ObjectId(clientId) }},
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
    const clientId = req.user?.clientId;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId requerido' });
    const { id } = req.params;
    const { ingredientes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID de personalización inválido' });
    }

    const pers = await (await import('../models/Personalization.js')).default.findOne({ _id: id, clientId });
    if (!pers) return res.status(404).json({ success: false, error: 'Personalización no encontrada' });
    
    // Validar que cada ingrediente tenga un ID válido
    if (ingredientes && ingredientes.length > 0) {
      for (const ing of ingredientes) {
        if (!mongoose.Types.ObjectId.isValid(ing.ingrediente_id)) {
          return res.status(400).json({ success: false, error: 'ID de ingrediente inválido' });
        }
        if (!ing.cantidad || ing.cantidad <= 0) {
          return res.status(400).json({ success: false, error: 'La cantidad debe ser mayor a 0' });
        }
        const ingDoc = await Ingredient.findOne({ _id: ing.ingrediente_id, clientId });
        if (!ingDoc) return res.status(400).json({ success: false, error: 'Ingrediente no pertenece a este negocio' });
      }
    }
    
    await RecipePersonalization.deleteMany({ personalizacion_id: new mongoose.Types.ObjectId(id), clientId });
    
    if (ingredientes && ingredientes.length > 0) {
      await RecipePersonalization.insertMany(
        ingredientes.map(ing => ({
          clientId,
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
