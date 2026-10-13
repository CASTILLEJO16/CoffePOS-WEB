import { useState, useEffect } from 'react';
import { Plus, Search, X, Clock, DollarSign, User, Table, Check, Trash2 } from 'lucide-react';
import { getOpenTickets, createOpenTicket, getOpenTicketById, cancelTicket, assignCustomerToTicket, addTicketItem, closeTicket } from '../services/openTicketService.js';
import { getProducts } from '../services/productService.js';
import { getCustomers } from '../services/customerService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import Swal from 'sweetalert2';
import './OpenTickets.css';

export default function OpenTickets() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('abierta');

  // Form states
  const [newTicket, setNewTicket] = useState({ numero_mesa: '', customerId: '' });
  const [newItem, setNewItem] = useState({ producto_id: '', producto_nombre: '', cantidad: 1, precio: 0, personalizaciones: '' });

  useEffect(() => {
    loadTickets();
    loadProducts();
    loadCustomers();
  }, [filterStatus]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await getOpenTickets({ estado: filterStatus });
      if (response.success) {
        setTickets(response.data);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      Swal.fire('Error', 'Error al cargar tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await getProducts();
      setProducts(response);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await getCustomers();
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const response = await createOpenTicket(newTicket);
      if (response.success) {
        Swal.fire('Éxito', 'Ticket creado exitosamente', 'success');
        setShowCreateModal(false);
        setNewTicket({ numero_mesa: '', customerId: '' });
        loadTickets();
      } else {
        Swal.fire('Error', response.message, 'error');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      Swal.fire('Error', 'Error al crear ticket', 'error');
    }
  };

  const handleSelectTicket = async (ticketId) => {
    try {
      setLoading(true);
      const response = await getOpenTicketById(ticketId);
      if (response.success) {
        setSelectedTicket(response.data);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
      Swal.fire('Error', 'Error al cargar detalles del ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTicket = async (ticketId) => {
    try {
      const result = await Swal.fire({
        title: '¿Cancelar ticket?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No'
      });

      if (result.isConfirmed) {
        const response = await cancelTicket(ticketId);
        if (response.success) {
          Swal.fire('Éxito', 'Ticket cancelado', 'success');
          loadTickets();
          if (selectedTicket?._id === ticketId) {
            setSelectedTicket(null);
          }
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error canceling ticket:', error);
      Swal.fire('Error', 'Error al cancelar ticket', 'error');
    }
  };

  const handleAssignCustomer = async (customerId) => {
    if (!selectedTicket) return;
    try {
      const response = await assignCustomerToTicket(selectedTicket._id, customerId);
      if (response.success) {
        Swal.fire('Éxito', 'Cliente asignado', 'success');
        handleSelectTicket(selectedTicket._id);
      } else {
        Swal.fire('Error', response.message, 'error');
      }
    } catch (error) {
      console.error('Error assigning customer:', error);
      Swal.fire('Error', 'Error al asignar cliente', 'error');
    }
  };

  const handleAddItem = async () => {
    if (!selectedTicket) return;
    try {
      const response = await addTicketItem(selectedTicket._id, newItem);
      if (response.success) {
        Swal.fire('Éxito', 'Producto agregado', 'success');
        setShowAddItemModal(false);
        setNewItem({ producto_id: '', producto_nombre: '', cantidad: 1, precio: 0, personalizaciones: '' });
        handleSelectTicket(selectedTicket._id);
      } else {
        Swal.fire('Error', response.message, 'error');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Swal.fire('Error', 'Error al agregar producto', 'error');
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      const result = await Swal.fire({
        title: '¿Cerrar ticket y cobrar?',
        text: `Total: ${formatCurrency(selectedTicket.total)}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cobrar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        const response = await closeTicket(selectedTicket._id, {
          metodo_pago: 'efectivo',
          monto_recibido: selectedTicket.total,
          cambio: 0
        });

        if (response.success) {
          Swal.fire('Éxito', 'Ticket cobrado exitosamente', 'success');
          loadTickets();
          setSelectedTicket(null);
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      Swal.fire('Error', 'Error al cobrar ticket', 'error');
    }
  };

  const formatElapsedTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filteredTickets = tickets.filter(ticket => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.numero_mesa?.toLowerCase().includes(search) ||
      ticket.customerId?.nombre?.toLowerCase().includes(search) ||
      ticket.numero_ticket.toString().includes(search)
    );
  });

  return (
    <div className="open-tickets-page">
      <div className="tickets-header">
        <h1><Table size={32} /> Tickets Abiertos</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={20} /> Nuevo Ticket
        </button>
      </div>

      <div className="tickets-controls">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Buscar por mesa, cliente o número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="status-filter"
        >
          <option value="abierta">Abiertas</option>
          <option value="en_proceso_cobro">En Proceso de Cobro</option>
          <option value="pagada">Pagadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="tickets-layout">
        <div className="tickets-list">
          {loading && <div className="loading">Cargando...</div>}
          
          {!loading && filteredTickets.length === 0 && (
            <div className="empty-state">
              <p>No hay tickets {filterStatus === 'abierta' ? 'abiertos' : filterStatus}</p>
            </div>
          )}

          {!loading && filteredTickets.map(ticket => (
            <div
              key={ticket._id}
              className={`ticket-card ${selectedTicket?._id === ticket._id ? 'selected' : ''}`}
              onClick={() => handleSelectTicket(ticket._id)}
            >
              <div className="ticket-header">
                <span className="ticket-number">#{ticket.numero_ticket}</span>
                <span className={`ticket-status ${ticket.estado}`}>{ticket.estado}</span>
              </div>
              
              {ticket.numero_mesa && (
                <div className="ticket-info">
                  <Table size={16} />
                  <span>Mesa {ticket.numero_mesa}</span>
                </div>
              )}
              
              {ticket.customerId && (
                <div className="ticket-info">
                  <User size={16} />
                  <span>{ticket.customerId.nombre}</span>
                </div>
              )}
              
              <div className="ticket-info">
                <Clock size={16} />
                <span>{formatElapsedTime(ticket.tiempo_transcurrido)}</span>
              </div>
              
              <div className="ticket-total">
                <DollarSign size={16} />
                <span>{formatCurrency(ticket.total)}</span>
              </div>

              {ticket.estado === 'abierta' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelTicket(ticket._id);
                  }}
                  className="btn-cancel"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedTicket && (
          <div className="ticket-details">
            <div className="details-header">
              <h2>Ticket #{selectedTicket.numero_ticket}</h2>
              {selectedTicket.numero_mesa && <span className="mesa-badge">Mesa {selectedTicket.numero_mesa}</span>}
            </div>

            {selectedTicket.customerId && (
              <div className="customer-section">
                <User size={20} />
                <span>{selectedTicket.customerId.nombre}</span>
                <span className="phone">{selectedTicket.customerId.telefono}</span>
              </div>
            )}

            <div className="items-section">
              <h3>Productos</h3>
              {selectedTicket.items?.length === 0 ? (
                <p className="empty-items">Sin productos</p>
              ) : (
                <div className="items-list">
                  {selectedTicket.items.map(item => (
                    <div key={item._id} className="item-row">
                      <div className="item-info">
                        <span className="item-quantity">{item.cantidad}x</span>
                        <span className="item-name">{item.producto_nombre}</span>
                      </div>
                      <span className="item-price">{formatCurrency(item.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="totals-section">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedTicket.subtotal)}</span>
              </div>
              <div className="total-row">
                <span>Impuestos</span>
                <span>{formatCurrency(selectedTicket.impuestos)}</span>
              </div>
              <div className="total-row total-final">
                <span>Total</span>
                <span>{formatCurrency(selectedTicket.total)}</span>
              </div>
            </div>

            <div className="details-actions">
              <button
                onClick={() => setShowAddItemModal(true)}
                className="btn btn-secondary"
                disabled={selectedTicket.estado !== 'abierta'}
              >
                <Plus size={20} /> Agregar Producto
              </button>
              <button
                onClick={handleCloseTicket}
                className="btn btn-primary"
                disabled={selectedTicket.estado !== 'abierta' || !selectedTicket.items?.length}
              >
                <Check size={20} /> Cobrar
              </button>
            </div>

            {!selectedTicket.customerId && selectedTicket.estado === 'abierta' && (
              <div className="assign-customer">
                <select
                  onChange={(e) => handleAssignCustomer(e.target.value)}
                  className="customer-select"
                >
                  <option value="">Asignar cliente...</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer.nombre} - {customer.telefono}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={() => setShowCreateModal(false)} className="close-btn">
              <X size={24} />
            </button>
            <h2>Crear Nuevo Ticket</h2>
            <div className="form-group">
              <label>Número de Mesa (opcional)</label>
              <input
                type="text"
                value={newTicket.numero_mesa}
                onChange={(e) => setNewTicket({ ...newTicket, numero_mesa: e.target.value })}
                placeholder="Ej: 1, 2, A1..."
              />
            </div>
            <div className="form-group">
              <label>Cliente (opcional)</label>
              <select
                value={newTicket.customerId}
                onChange={(e) => setNewTicket({ ...newTicket, customerId: e.target.value })}
              >
                <option value="">Sin cliente</option>
                {customers.map(customer => (
                  <option key={customer._id} value={customer._id}>
                    {customer.nombre} - {customer.telefono}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleCreateTicket} className="btn btn-primary btn-full">
              Crear Ticket
            </button>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={() => setShowAddItemModal(false)} className="close-btn">
              <X size={24} />
            </button>
            <h2>Agregar Producto</h2>
            <div className="form-group">
              <label>Producto</label>
              <select
                value={newItem.producto_id}
                onChange={(e) => {
                  const product = products.find(p => p._id === e.target.value);
                  setNewItem({
                    ...newItem,
                    producto_id: e.target.value,
                    producto_nombre: product?.nombre || '',
                    precio: product?.precio || 0
                  });
                }}
              >
                <option value="">Seleccionar producto...</option>
                {products.map(product => (
                  <option key={product._id} value={product._id}>
                    {product.nombre} - {formatCurrency(product.precio)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                value={newItem.cantidad}
                onChange={(e) => setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="form-group">
              <label>Personalizaciones (opcional)</label>
              <input
                type="text"
                value={newItem.personalizaciones}
                onChange={(e) => setNewItem({ ...newItem, personalizaciones: e.target.value })}
                placeholder="Ej: sin azúcar, extra caliente..."
              />
            </div>
            <button
              onClick={handleAddItem}
              className="btn btn-primary btn-full"
              disabled={!newItem.producto_id}
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
