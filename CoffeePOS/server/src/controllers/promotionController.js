import Promotion from '../models/Promotion.js';
import Product from '../models/Product.js';

export async function getPromotions(req, res) {
  try {
    const clientId = req.user.clientId;
    const { estado, tipo } = req.query;
    
    let query = { clientId };
    
    if (estado) {
      query.estado = estado;
    }
    
    if (tipo) {
      query.tipo = tipo;
    }
    
    const promotions = await Promotion.find(query)
      .sort({ fechaCreacion: -1 });
    
    res.json({
      success: true,
      count: promotions.length,
      data: promotions
    });
  } catch (error) {
    console.error('Error al obtener promociones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createPromotion(req, res) {
  try {
    const { nombre, tipo, productosParticipantes, cantidadComprar, cantidadPagar,
             descuentoPorcentaje, descuentoFijo, productosCombo, precioCombo, descripcion,
             fechaInicio, fechaFinalizacion, horaInicio, horaFinalizacion, diasSemana } = req.body;

    console.log('Datos recibidos:', { nombre, tipo, productosParticipantes, productosCombo, fechaInicio, fechaFinalizacion });

    if (!nombre || !tipo || !fechaInicio || !fechaFinalizacion) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: nombre, tipo, fechaInicio, fechaFinalizacion'
      });
    }

    const clientId = req.user.clientId;
    const usuarioAdmin = req.user.userId || req.user._id;

    if (!usuarioAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no autenticado correctamente'
      });
    }

    // Para developers, no requerir clientId
    if (!clientId && !req.user.isDeveloper) {
      return res.status(400).json({
        success: false,
        error: 'Usuario sin clientId asignado'
      });
    }

    const startDate = new Date(fechaInicio);
    const endDate = new Date(fechaFinalizacion);

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de inicio debe ser anterior a la fecha de finalización'
      });
    }

    // Normalizar productosParticipantes (solo si no es developer)
    let normalizedProducts = [];
    if (productosParticipantes && productosParticipantes.length > 0) {
      for (const pp of productosParticipantes) {
        const productId = typeof pp === 'string' ? pp : pp.producto_id;
        const productQuery = req.user.isDeveloper
          ? { _id: productId }
          : { _id: productId, clientId };
        const product = await Product.findOne(productQuery);
        if (!product) {
          return res.status(400).json({
            success: false,
            error: `Producto no encontrado o no pertenece a este cliente: ${productId}`
          });
        }
        normalizedProducts.push({ producto_id: product._id, nombre: product.nombre });
      }
    }

    // Normalizar productosCombo para combos (solo si no es developer)
    let normalizedCombo = [];
    if (productosCombo && productosCombo.length > 0) {
      for (const pc of productosCombo) {
        const productId = typeof pc === 'string' ? pc : pc.producto_id;
        const cantidad = typeof pc === 'string' ? 1 : (pc.cantidad || 1);
        const productQuery = req.user.isDeveloper
          ? { _id: productId }
          : { _id: productId, clientId };
        const product = await Product.findOne(productQuery);
        if (!product) {
          return res.status(400).json({
            success: false,
            error: `Producto del combo no encontrado o no pertenece a este cliente: ${productId}`
          });
        }
        normalizedCombo.push({ producto_id: product._id, nombre: product.nombre, cantidad });
      }
    }

    const promotionData = {
      ...(clientId && { clientId }),
      nombre,
      tipo,
      productosParticipantes: normalizedProducts,
      cantidadComprar,
      cantidadPagar,
      descuentoPorcentaje,
      descuentoFijo,
      productosCombo: normalizedCombo,
      precioCombo,
      descripcion,
      fechaInicio: startDate,
      fechaFinalizacion: endDate,
      horaInicio,
      horaFinalizacion,
      diasSemana: diasSemana || [],
      estado: 'Activa',
      usuarioAdmin
    };

    console.log('Datos a guardar:', promotionData);

    const promotion = await Promotion.create(promotionData);

    res.status(201).json({ success: true, data: promotion });
  } catch (error) {
    console.error('Error al crear promoción:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Error de validación: ' + Object.values(error.errors).map(e => e.message).join(', ')
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updatePromotion(req, res) {
  try {
    const { id } = req.params;
    const { nombre, tipo, productosParticipantes, cantidadComprar, cantidadPagar,
             descuentoPorcentaje, descuentoFijo, productosCombo, precioCombo, descripcion,
             fechaInicio, fechaFinalizacion, horaInicio, horaFinalizacion, diasSemana, estado } = req.body;

    const clientId = req.user.clientId;
    const usuarioAdmin = req.user.userId || req.user._id;

    if (fechaInicio && fechaFinalizacion) {
      const startDate = new Date(fechaInicio);
      const endDate = new Date(fechaFinalizacion);
      if (startDate >= endDate) {
        return res.status(400).json({ success: false, error: 'La fecha de inicio debe ser anterior a la fecha de finalización' });
      }
    }

    let normalizedProducts = [];
    if (productosParticipantes && productosParticipantes.length > 0) {
      for (const pp of productosParticipantes) {
        const productId = typeof pp === 'string' ? pp : pp.producto_id;
        const productQuery = req.user.isDeveloper
          ? { _id: productId }
          : { _id: productId, clientId };
        const product = await Product.findOne(productQuery);
        if (!product) {
          return res.status(400).json({ success: false, error: 'Producto no encontrado o no pertenece a este cliente' });
        }
        normalizedProducts.push({ producto_id: product._id, nombre: product.nombre });
      }
    }

    let normalizedCombo = [];
    if (productosCombo && productosCombo.length > 0) {
      for (const pc of productosCombo) {
        const productId = typeof pc === 'string' ? pc : pc.producto_id;
        const cantidad = typeof pc === 'string' ? 1 : (pc.cantidad || 1);
        const productQuery = req.user.isDeveloper
          ? { _id: productId }
          : { _id: productId, clientId };
        const product = await Product.findOne(productQuery);
        if (!product) {
          return res.status(400).json({ success: false, error: 'Producto del combo no encontrado o no pertenece a este cliente' });
        }
        normalizedCombo.push({ producto_id: product._id, nombre: product.nombre, cantidad });
      }
    }

    const updateData = {
      nombre,
      tipo,
      productosParticipantes: normalizedProducts,
      cantidadComprar,
      cantidadPagar,
      descuentoPorcentaje,
      descuentoFijo,
      productosCombo: normalizedCombo,
      precioCombo,
      descripcion,
      ...(fechaInicio && fechaFinalizacion ? {
        fechaInicio: new Date(fechaInicio),
        fechaFinalizacion: new Date(fechaFinalizacion)
      } : {}),
      horaInicio,
      horaFinalizacion,
      diasSemana: diasSemana || [],
      ...(estado !== undefined ? { estado } : {}),
      ...(usuarioAdmin && { usuarioAdmin })
    };

    // Para developers, buscar solo por ID. Para usuarios normales, también por clientId
    const query = req.user.isDeveloper
      ? { _id: id }
      : { _id: id, clientId };

    const promotion = await Promotion.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    );

    if (!promotion) {
      return res.status(404).json({ success: false, error: 'Promoción no encontrada' });
    }

    res.json({ success: true, data: promotion });
  } catch (error) {
    console.error('Error al actualizar promoción:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function togglePromotion(req, res) {
  try {
    const { id } = req.params;
    const clientId = req.user.clientId;
    
    const promo = await Promotion.findById(id);
    if (!promo || promo.clientId.toString() !== clientId) {
      return res.status(404).json({
        success: false,
        error: 'Promoción no encontrada'
      });
    }
    
    const newState = promo.estado === 'Activa' ? 'Inactiva' : 'Activa';
    
    const updated = await Promotion.findByIdAndUpdate(
      id,
      { estado: newState },
      { new: true }
    );
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error al togglear promoción:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function deletePromotion(req, res) {
  try {
    const { id } = req.params;
    const clientId = req.user.clientId;
    
    const deleted = await Promotion.findOneAndDelete({
      _id: id,
      clientId
    });
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Promoción no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Promoción eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar promoción:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}