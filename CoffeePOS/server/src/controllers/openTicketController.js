/**
 * Controlador de Tickets Abiertos (Mongoose)
 * Gestión de cuentas/tickets abiertos
 */

import mongoose from 'mongoose';
import OpenTicket from '../models/OpenTicket.js';
import OpenTicketItem from '../models/OpenTicketItem.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Config from '../models/Config.js';
import { createSale } from '../services/saleService.js';
import { nextSequence } from '../utils/sequence.js';

// Generar número de ticket único (atómico: no se repite aunque se abran 2 al mismo tiempo)
async function generateTicketNumber(clientId) {
  return nextSequence(clientId, 'numero_ticket', async () => {
    const lastTicket = await OpenTicket.findOne({ clientId })
      .sort({ numero_ticket: -1 })
      .select('numero_ticket');
    return lastTicket?.numero_ticket || 0;
  });
}

// Crear ticket abierto
export const createOpenTicket = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const empleadoId = req.user?.userId;
    const { numero_mesa, customerId, observaciones } = req.body;

    // Validar cliente si se proporciona
    if (customerId) {
      const customer = await Customer.findOne({ 
        _id: customerId, 
        clientId 
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
    }

    const numero_ticket = await generateTicketNumber(clientId);

    const ticket = await OpenTicket.create({
      clientId,
      numero_ticket,
      numero_mesa: numero_mesa?.trim() || null,
      customerId: customerId || null,
      empleado_id: empleadoId,
      estado: 'abierta',
      observaciones: observaciones?.trim() || null
    });

    res.status(201).json({
      success: true,
      message: 'Ticket abierto creado exitosamente',
      data: ticket
    });
  } catch (error) {
    console.error('Error al crear ticket abierto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear ticket',
      error: error.message
    });
  }
};

// Obtener todos los tickets abiertos
export const getOpenTickets = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { estado, numero_mesa } = req.query;

    let query = { clientId };
    if (estado) query.estado = estado;
    if (numero_mesa) query.numero_mesa = numero_mesa;

    const tickets = await OpenTicket.find(query)
      .populate('customerId', 'nombre telefono')
      .populate('empleado_id', 'nombre')
      .sort({ fecha_apertura: -1 });

    // Calcular tiempo transcurrido para cada ticket
    const ticketsWithTime = tickets.map(ticket => {
      const now = new Date();
      const opened = new Date(ticket.fecha_apertura);
      const elapsedMinutes = Math.floor((now - opened) / (1000 * 60));
      return {
        ...ticket.toJSON(),
        tiempo_transcurrido: elapsedMinutes
      };
    });

    res.status(200).json({
      success: true,
      data: ticketsWithTime
    });
  } catch (error) {
    console.error('Error al obtener tickets abiertos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tickets',
      error: error.message
    });
  }
};

// Obtener ticket por ID con items
export const getOpenTicketById = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const ticket = await OpenTicket.findOne({ 
      _id: req.params.id, 
      clientId 
    })
    .populate('customerId', 'nombre telefono')
    .populate('empleado_id', 'nombre');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    // Obtener items del ticket
    const items = await OpenTicketItem.find({ 
      openTicketId: ticket._id,
      clientId 
    }).sort({ createdAt: -1 });

    const now = new Date();
    const opened = new Date(ticket.fecha_apertura);
    const elapsedMinutes = Math.floor((now - opened) / (1000 * 60));

    res.status(200).json({
      success: true,
      data: {
        ...ticket.toJSON(),
        tiempo_transcurrido: elapsedMinutes,
        items
      }
    });
  } catch (error) {
    console.error('Error al obtener ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ticket',
      error: error.message
    });
  }
};

// Agregar item a ticket
export const addTicketItem = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { ticketId } = req.params;
    const { 
      producto_id, 
      producto_nombre, 
      cantidad, 
      precio, 
      personalizaciones,
      isCombo,
      comboData 
    } = req.body;

    const ticket = await OpenTicket.findOne({ 
      _id: ticketId, 
      clientId 
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    if (ticket.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden agregar items a tickets abiertos'
      });
    }

    // Precio y nombre SIEMPRE desde la BD (el navegador podía mandar cualquier precio)
    const qty = Number(cantidad);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Cantidad inválida' });
    }
    if (!producto_id || !mongoose.Types.ObjectId.isValid(String(producto_id))) {
      return res.status(400).json({ success: false, message: 'Selecciona un producto válido' });
    }
    const product = await Product.findOne({ _id: producto_id, clientId, activo: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o inactivo' });
    }
    const desc = Number(product.descuento) || 0;
    const unitPrice = Math.round((desc > 0 ? product.precio * (1 - desc / 100) : product.precio) * 100) / 100;
    const importe = Math.round(qty * unitPrice * 100) / 100;

    const item = await OpenTicketItem.create({
      clientId,
      openTicketId: ticket._id,
      producto_id: product._id,
      producto_nombre: product.nombre,
      cantidad: qty,
      precio: unitPrice,
      importe,
      personalizaciones: personalizaciones || null,
      isCombo: isCombo || false,
      comboData: comboData || null
    });

    // Actualizar totales del ticket
    const allItems = await OpenTicketItem.find({ openTicketId: ticket._id });
    const subtotal = allItems.reduce((sum, i) => sum + i.importe, 0);
    
    // Obtener IVA configurado
    const config = await Config.findOne({ clientId, clave: 'iva_rate' });
    const ivaRate = config ? parseFloat(config.valor) : 0.16;
    const impuestos = subtotal * ivaRate;
    const total = subtotal + impuestos;

    ticket.subtotal = subtotal;
    ticket.impuestos = impuestos;
    ticket.total = total;
    ticket.iva_rate = ivaRate;
    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Item agregado exitosamente',
      data: { item, ticket }
    });
  } catch (error) {
    console.error('Error al agregar item al ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar item',
      error: error.message
    });
  }
};

// Actualizar item de ticket
export const updateTicketItem = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { itemId } = req.params;
    const { cantidad, personalizaciones } = req.body;

    const item = await OpenTicketItem.findOne({ 
      _id: itemId, 
      clientId 
    }).populate('openTicketId');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    if (item.openTicketId.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden modificar items de tickets abiertos'
      });
    }

    const newQty = Number(cantidad);
    if (!Number.isInteger(newQty) || newQty <= 0) {
      return res.status(400).json({ success: false, message: 'Cantidad inválida' });
    }
    item.cantidad = newQty;
    item.importe = Math.round(newQty * item.precio * 100) / 100;
    if (personalizaciones !== undefined) {
      item.personalizaciones = personalizaciones;
    }
    await item.save();

    // Actualizar totales del ticket
    const allItems = await OpenTicketItem.find({ 
      openTicketId: item.openTicketId._id 
    });
    const ticket = item.openTicketId;
    const subtotal = allItems.reduce((sum, i) => sum + i.importe, 0);
    const impuestos = subtotal * ticket.iva_rate;
    const total = subtotal + impuestos;

    ticket.subtotal = subtotal;
    ticket.impuestos = impuestos;
    ticket.total = total;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Item actualizado exitosamente',
      data: { item, ticket }
    });
  } catch (error) {
    console.error('Error al actualizar item del ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar item',
      error: error.message
    });
  }
};

// Eliminar item de ticket
export const deleteTicketItem = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { itemId } = req.params;

    const item = await OpenTicketItem.findOne({ 
      _id: itemId, 
      clientId 
    }).populate('openTicketId');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    if (item.openTicketId.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar items de tickets abiertos'
      });
    }

    await OpenTicketItem.deleteOne({ _id: itemId });

    // Actualizar totales del ticket
    const allItems = await OpenTicketItem.find({ 
      openTicketId: item.openTicketId._id 
    });
    const ticket = item.openTicketId;
    const subtotal = allItems.reduce((sum, i) => sum + i.importe, 0);
    const impuestos = subtotal * ticket.iva_rate;
    const total = subtotal + impuestos;

    ticket.subtotal = subtotal;
    ticket.impuestos = impuestos;
    ticket.total = total;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Item eliminado exitosamente',
      data: ticket
    });
  } catch (error) {
    console.error('Error al eliminar item del ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar item',
      error: error.message
    });
  }
};

// Cerrar ticket (convertir en venta)
// Usa la MISMA lógica de venta del POS (createSale): precios del servidor, promociones,
// descuento de stock, caja abierta del cajero y numeración atómica.
export const closeTicket = async (req, res) => {
  const clientId = req.user?.clientId;
  const empleadoId = req.user?.userId;
  const { ticketId } = req.params;
  let lockedTicket = null;

  try {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ success: false, message: 'ID de ticket inválido' });
    }

    // Bloqueo atómico: solo una petición puede pasar el ticket de 'abierta' a 'en_proceso_cobro'
    lockedTicket = await OpenTicket.findOneAndUpdate(
      { _id: ticketId, clientId, estado: 'abierta' },
      { estado: 'en_proceso_cobro' },
      { new: true }
    );

    if (!lockedTicket) {
      const exists = await OpenTicket.exists({ _id: ticketId, clientId });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'El ticket ya no está abierto' : 'Ticket no encontrado'
      });
    }

    const items = await OpenTicketItem.find({ openTicketId: lockedTicket._id, clientId });

    if (items.length === 0) {
      lockedTicket.estado = 'abierta';
      await lockedTicket.save();
      return res.status(400).json({
        success: false,
        message: 'El ticket no tiene items'
      });
    }

    const {
      metodo_pago = 'efectivo', tipo_tarjeta, tipo_cambio, dolar_recibido,
      efectivo_mxn, efectivo_usd, tarjeta_credito, tarjeta_debito, cambio_pesos
    } = req.body || {};

    const sale = await createSale({
      items: items.map(i => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        personalizaciones: i.personalizaciones || null,
        precio_final: i.precio
      })),
      metodo_pago,
      tipo_tarjeta,
      tipo_cambio,
      dolar_recibido,
      efectivo_mxn,
      efectivo_usd,
      tarjeta_credito,
      tarjeta_debito,
      cambio_pesos
    }, empleadoId, clientId);

    lockedTicket.estado = 'pagada';
    lockedTicket.venta_id = sale._id;
    lockedTicket.fecha_cierre = new Date();
    // Reflejar los importes reales cobrados
    lockedTicket.subtotal = sale.subtotal;
    lockedTicket.impuestos = sale.impuestos;
    lockedTicket.total = sale.total;
    await lockedTicket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket cerrado y venta registrada exitosamente',
      data: { ticket: lockedTicket, sale },
      stockAlertas: sale.stockAlertas || null,
      hasStockAlertas: sale.hasStockAlertas || false
    });
  } catch (error) {
    console.error('Error al cerrar ticket:', error);

    // Revertir estado del ticket en caso de error
    try {
      if (lockedTicket) {
        await OpenTicket.updateOne(
          { _id: lockedTicket._id, estado: 'en_proceso_cobro' },
          { estado: 'abierta' }
        );
      }
    } catch (e) {
      console.error('Error al revertir estado del ticket:', e);
    }

    const isStockError = error.code === 'INSUFFICIENT_STOCK';
    const isUserError = isStockError || /caja abierta|no encontrado|inválid/i.test(error.message || '');
    res.status(isUserError ? 400 : 500).json({
      success: false,
      message: error.message || 'Error al cerrar ticket',
      error: error.message,
      code: error.code,
      faltantes: error.faltantes || null
    });
  }
};

// Cancelar ticket
export const cancelTicket = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { ticketId } = req.params;

    const ticket = await OpenTicket.findOne({ 
      _id: ticketId, 
      clientId 
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    if (ticket.estado === 'pagada') {
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar un ticket ya pagado'
      });
    }

    ticket.estado = 'cancelada';
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket cancelado exitosamente',
      data: ticket
    });
  } catch (error) {
    console.error('Error al cancelar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar ticket',
      error: error.message
    });
  }
};

// Asociar cliente a ticket
export const assignCustomerToTicket = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { ticketId } = req.params;
    const { customerId } = req.body;

    const ticket = await OpenTicket.findOne({ 
      _id: ticketId, 
      clientId 
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    if (ticket.estado !== 'abierta') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede asignar cliente a tickets abiertos'
      });
    }

    const customer = await Customer.findOne({ 
      _id: customerId, 
      clientId 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    ticket.customerId = customerId;
    await ticket.save();

    const updatedTicket = await OpenTicket.findById(ticket._id)
      .populate('customerId', 'nombre telefono');

    res.status(200).json({
      success: true,
      message: 'Cliente asignado exitosamente',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Error al asignar cliente al ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar cliente',
      error: error.message
    });
  }
};
