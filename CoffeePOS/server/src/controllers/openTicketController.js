/**
 * Controlador de Tickets Abiertos (Mongoose)
 * Gestión de cuentas/tickets abiertos
 */

import OpenTicket from '../models/OpenTicket.js';
import OpenTicketItem from '../models/OpenTicketItem.js';
import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import SaleDetail from '../models/SaleDetail.js';
import Product from '../models/Product.js';
import Config from '../models/Config.js';

// Generar número de ticket único
async function generateTicketNumber(clientId) {
  const lastTicket = await OpenTicket.findOne({ clientId })
    .sort({ numero_ticket: -1 })
    .select('numero_ticket');
  
  return lastTicket ? lastTicket.numero_ticket + 1 : 1;
}

// Crear ticket abierto
export const createOpenTicket = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const empleadoId = req.user?._id;
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

    const importe = cantidad * precio;

    const item = await OpenTicketItem.create({
      clientId,
      openTicketId: ticket._id,
      producto_id: producto_id || null,
      producto_nombre,
      cantidad,
      precio,
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

    item.cantidad = cantidad;
    item.importe = cantidad * item.precio;
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
export const closeTicket = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const empleadoId = req.user?._id;
    const { ticketId } = req.params;
    const { metodo_pago, monto_recibido, cambio, tipo_cambio, dolar_recibido, tipo_tarjeta, efectivo_mxn, efectivo_usd, tarjeta_credito, tarjeta_debito } = req.body;

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
        message: 'El ticket ya no está abierto'
      });
    }

    // Obtener items del ticket
    const items = await OpenTicketItem.find({ openTicketId: ticket._id });

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El ticket no tiene items'
      });
    }

    // Obtener número de venta
    const lastSale = await Sale.findOne({ clientId }).sort({ numero_venta: -1 });
    const numero_venta = lastSale ? lastSale.numero_venta + 1 : 1;

    // Marcar ticket en proceso de cobro
    ticket.estado = 'en_proceso_cobro';
    await ticket.save();

    // Crear venta
    const sale = await Sale.create({
      clientId: ticket.clientId,
      customerId: ticket.customerId,
      numero_venta,
      fecha: new Date(),
      subtotal: ticket.subtotal,
      impuestos: ticket.impuestos,
      total: ticket.total,
      metodo_pago,
      tipo_tarjeta,
      usuario_id: empleadoId,
      iva_rate: ticket.iva_rate,
      monto_recibido,
      cambio,
      tipo_cambio,
      dolar_recibido,
      efectivo_mxn,
      efectivo_usd,
      tarjeta_credito,
      tarjeta_debito
    });

    // Crear detalles de venta
    for (const item of items) {
      await SaleDetail.create({
        clientId,
        venta_id: sale._id,
        customerId: ticket.customerId,
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        importe: item.importe,
        personalizaciones: item.personalizaciones,
        isCombo: item.isCombo,
        comboData: item.comboData
      });
    }

    // Actualizar ticket
    ticket.estado = 'pagada';
    ticket.venta_id = sale._id;
    ticket.fecha_cierre = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket cerrado y venta registrada exitosamente',
      data: { ticket, sale }
    });
  } catch (error) {
    console.error('Error al cerrar ticket:', error);
    
    // Revertir estado del ticket en caso de error
    try {
      const ticket = await OpenTicket.findById(req.params.ticketId);
      if (ticket && ticket.estado === 'en_proceso_cobro') {
        ticket.estado = 'abierta';
        await ticket.save();
      }
    } catch (e) {
      console.error('Error al revertir estado del ticket:', e);
    }

    res.status(500).json({
      success: false,
      message: 'Error al cerrar ticket',
      error: error.message
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
