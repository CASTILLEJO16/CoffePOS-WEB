import * as categoryService from '../services/categoryService.js';

/**
 * Controlador de Categorías
 * Maneja las requests HTTP relacionadas con categorías
 */

export async function getCategories(req, res) {
  try {
    const clientId = req.user?.clientId;
    const categories = await categoryService.getAllCategories(clientId);
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error en getCategories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createCategory(req, res) {
  try {
    const { nombre } = req.body;
    const clientId = req.user?.clientId;
    
    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la categoría es requerido'
      });
    }
    
    const category = await categoryService.createCategory(nombre, clientId);
    
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({
        success: false,
        error: 'Esa categoría ya existe'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la categoría es requerido'
      });
    }
    
    const category = await categoryService.updateCategory(id, nombre);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error en updateCategory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const clientId = req.user?.clientId;
    
    await categoryService.deleteCategory(id, clientId);
    
    res.json({
      success: true,
      message: 'Categoría eliminada correctamente'
    });
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    if (error.code === 'CATEGORY_IN_USE') {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ success: false, error: error.message });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
