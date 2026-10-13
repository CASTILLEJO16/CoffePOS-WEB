/**
 * Rutas para Tickets Abiertos (API REST)
 */

import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import * as openTicketController from '../controllers/openTicketController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// CRUD de tickets abiertos
router.post('/', openTicketController.createOpenTicket);
router.get('/', openTicketController.getOpenTickets);
router.get('/:id', openTicketController.getOpenTicketById);

// Items del ticket
router.post('/:ticketId/items', openTicketController.addTicketItem);
router.put('/items/:itemId', openTicketController.updateTicketItem);
router.delete('/items/:itemId', openTicketController.deleteTicketItem);

// Operaciones de ticket
router.post('/:ticketId/close', openTicketController.closeTicket);
router.post('/:ticketId/cancel', openTicketController.cancelTicket);
router.post('/:ticketId/assign-customer', openTicketController.assignCustomerToTicket);

export default router;
