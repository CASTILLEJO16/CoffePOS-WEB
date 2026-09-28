import { useState, useEffect } from 'react';
import { useParams, useRouteMatch, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { LoadingButton } from '../components/common/LoadingButton.jsx';
import Swal from 'sweetalert2';
import { useOrder } from '../../context/OrderContext.jsx';
import { deletePromotion as deletePromotionApi, getPromotions as getPromotionsApi } from '../services/promotionService.js';
import Button from '../components/common/Button.jsx';
import './AdminPromociones.css';

const usePromotionForm = (initialData = null) => {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmiting } } = useForm({
    resolver: yupResolver(yup.object({
      nombre: yup.string().required('Nombre es obligatorio').min(3, 'Mínimo 3 caracteres'),
      tipo: yup.string().required('Tipo es obligatorio').oneOf(['BUY_X_PAY_Y', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT']),
      productosParticipantes: yup.array().min(1, 'Debe seleccionar al menos un producto'),
      cantidadComprar: yup.number().integer().min(1, 'Cantidad a comprar debe ser ≥ 1'),
      cantidadPagar: yup.number().integer().min(1, 'Cantidad a pagar debe ser ≥ 1'),
      fechaInicio: yup.date().required('Fecha de inicio es obligatoria'),
      fechaFinalizacion: yup.date().required('Fecha de finalización es obligatoria').min(yup.ref('fechaInicio'), 'Must be after start date'),
      horaInicio: yup.string().required('Hora de inicio es obligatoria'),
      horaFinalizacion: yup.string().required('Hora de finalización es obligatoria'),
      diasSemana: yup.array().of(yup.string().oneOf(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])),
      estado: yup.string().oneOf(['Activa', 'Inactiva'])
    }))
  });

  const [productos, setProductos] = useState([]);
  const [promoTypes] = useState(['BUY_X_PAY_Y', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT']);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [promoData, setPromoData] = useState({
    nombre: '',
    tipo: 'BUY_X_PAY_Y',
    productosParticipantes: [],
    cantidadComprar: 2,
    cantidadPagar: 1,
    fechaInicio: new Date(),
    fechaFinalizacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    horaInicio: '00:00',
    horaFinalizacion: '23:59',
    diasSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    estado: 'Activa'
  });

  useEffect(() => {
    if (initialData) {
      setPromoData({
        nombre: initialData.nombre || '',
        tipo: initialData.tipo || 'BUY_X_PAY_Y',
        productosParticipantes: initialData.productosParticipantes || [],
        cantidadComprar: initialData.cantidadComprar || 2,
        cantidadPagar: initialData.cantidadPagar || 1,
        fechaInicio: initialData.fechaInicio ? new Date(initialData.fechaInicio) : new Date(),
        fechaFinalizacion: initialData.fechaFinalizacion ? new Date(initialData.fechaFinalizacion) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        horaInicio: initialData.horaInicio || '00:00',
        horaFinalizacion: initialData.horaFinalizacion || '23:59',
        diasSemana: initialData.diasSemana || ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
        estado: initialData.estado || 'Activa'
      });
    }
  }, [initialData]);

  const onSubmit = async (data) => {
    console.log('Form submitted:', data);
  };

  return { register, handleSubmit, reset, watch, errors, isSubmiting, promoData, setPromoData, onSubmit };
};

export default function AdminPromociones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmiting } } = usePromotionForm();
  const [promotions, setPromotions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { addItem, items, subtotal, impuestos, total } = useOrder();

  // Cargar promociones al montar
  useEffect(() => {
    const loadPromotions = async () => {
      try {
        const response = await fetch('/api/promociones', {
          headers: {
            'Authorization': `Bearer ${user?.token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setPromotions(data.data || []);
        }
      } catch (error) {
        console.error('Error cargando promociones:', error);
      }
    };
    loadPromotions();
  }, [user]);

  // Cargar productos disponibles
  useEffect(() => {
    const loadProducts = async () => {
      try {
        // Obtener productos del cliente actual
        const token = user?.token;
        if (!token) return;
        
        // Usar la endpoint existente o consultar products
        const response = await fetch('/api/productos', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setProductos(data.data || []);
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
      }
    };
    loadProducts();
  }, [user]);

  const onSubmitForm = async (data) => {
    try {
      setShowForm(false);
      
      if (editing) {
        // Actualizar promoción existente
        await fetch(`/api/promociones/${editing._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nombre: data.nombre,
            tipo: data.tipo,
            productosParticipantes: data.productosParticipantes.map(pp => ({
              producto_id: pp.producto_id,
              nombre: pp.nombre
            })),
            cantidadComprar: data.cantidadComprar,
            cantidadPagar: data.cantidadPagar,
            fechaInicio: data.fechaInicio,
            fechaFinalizacion: data.fechaFinalizacion,
            horaInicio: data.horaInicio,
            horaFinalizacion: data.horaFinalizacion,
            diasSemana: data.diasSemana,
            estado: data.estado
          })
        });
        Swal.fire({
          title: '¡Actualizado!',
          text: 'Promoción actualizada correctamente',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        // Crear nueva promoción
        await fetch('/api/promociones', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nombre: data.nombre,
            tipo: data.tipo,
            productosParticipantes: data.productosParticipantes.map(pp => ({
              producto_id: pp.producto_id,
              nombre: pp.nombre
            })),
            cantidadComprar: data.cantidadComprar,
            cantidadPagar: data.cantidadPagar,
            fechaInicio: data.fechaInicio,
            fechaFinalizacion: data.fechaFinalizacion,
            horaInicio: data.horaInicio,
            horaFinalizacion: data.horaFinalizacion,
            diasSemana: data.diasSemana,
            estado: data.estado
          })
        });
        Swal.fire({
          title: '¡Creado!',
          text: 'Promoción creada correctamente',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
      
      await loadPromotions();
    } catch (error) {
      console.error('Error al guardar promoción:', error);
      const msg = error.response?.data?.error || error.message || 'Error al guardar promoción';
      Swal.fire('Error', msg, 'error');
    }
  };

  async function handleDelete(id) {
    if (!id || id === 'undefined') {
      Swal.fire('Error', 'ID no válido: recarga la página', 'error');
      return;
    }
    const result = await Swal.fire({
      title: '¿Eliminar promoción?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      await deletePromotionApi(id);
      await loadPromotions();
      Swal.fire('Eliminado', 'Promoción eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error al eliminar promoción:', error);
      const msg = error.response?.data?.error || error.message || 'Error al eliminar promoción';
      Swal.fire('Error', msg, 'error');
    }
  }

  function formatTipo(tipo) {
    const map = {
      'BUY_X_PAY_Y': '2x1 / X/Y',
      'PERCENTAGE_DISCOUNT': 'Descuento %',
      'FIXED_DISCOUNT': 'Descuento fijo'
    };
    return map[tipo] || tipo;
  }

  return (
    <div className="admin-promociones-page">
      <div className="admin-promociones-header">
        <div className="admin-promociones-header-left">
          <div className="admin-promociones-title-wrapper">
            <package className="admin-promociones-title-icon" size={28} />
            <h1 className="admin-promociones-title">Promociones</h1>
          </div>
          <Button onClick={() => setShowForm(true)} icon={Plus} variant="primary">
            Nueva Promoción
          </Button>
        </div>
      </div>

      <div className="admin-promociones-content">
        {promotions.length === 0 ? (
          <div className="empty-state">
            <p>No hay promociones activas</p>
            <p>Crea tu primera promoción para comenzar</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {promotions.map((promo, index) => (
              <div key={promo._id} className="promotion-card">
                <div className="promotion-card-header">
                  <span className="promotion-type-badge">
                    {formatTipo(promo.tipo)}
                  </span>
                  <span className={`promotion-status ${promo.estado === 'Activa' ? 'active' : 'inactive'}`}>
                    {promo.estado}
                  </span>
                </div>
                <div className="promotion-card-body">
                  <h3 className="promotion-nombre">{promo.nombre}</h3>
                  <p className="promotion-desc">
                    {promo.productosParticipantes.map(pp => `${pp.nombre}`).join(', ')}
                  </p>
                  <p className="promotion-rules">
                    {promo.tipo === 'BUY_X_PAY_Y' && `
                      Comprar: ${promo.cantidadComprar}
                      Pagar: ${promo.cantidadPagar}
                      ${promo.diasSemana && promo.diasSemana.length > 0 ? `Días: ${promo.diasSemana.join(', ')}` : ''}
                      ${promo.horaInicio && promo.horaFinalizacion ? `Horario: ${promo.horaInicio} - ${promo.horaFinalizacion}` : ''}
                    `}
                    ${promo.tipo === 'PERCENTAGE_DISCOUNT' && '- Descuento porcentual en productos seleccionados'}
                    ${promo.tipo === 'FIXED_DISCOUNT' && `- Descuento fijo de $${promo.cantidadPagar} en productos seleccionados`}
                  </p>
                </div>
                <div className="promotion-card-footer">
                  <Button 
                    variant="secondary" 
                    size="small"
                    onClick={() => setEditing(promo)}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="danger" 
                    size="small"
                    onClick={() => handleDelete(promo._id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="promotion-form-overlay">
            <div className="promotion-form-card">
              <h2>
                {editing ? 'Editar Promoción' : 'Nueva Promoción'}
              </h2>
              <Button variant="secondary" onClick={() => setShowForm(false)}>&times; Cerrar</Button>
              
              <form onSubmit={handleSubmit(e => {
                e.preventDefault();
                onSubmitForm(watch();
              })} className="promotion-form">
                
                <div className="form-group">
                  <label>Nombre *</label>
                  <input 
                    type="text" 
                    name="nombre" 
                    ref={register} 
                    required 
                    value={promoData.nombre}
                    onChange={(e) => setPromoData({ ...promoData, nombre: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tipo *</label>
                  <select 
                    name="tipo" 
                    ref={register} 
                    required 
                    value={promoData.tipo}
                    onChange={(e) => setPromoData({ ...promoData, tipo: e.target.value })}
                  >
                    <option value="BUY_X_PAY_Y">2x1 / X/Y (Comprar X, pagar Y)</option>
                    <option value="PERCENTAGE_DISCOUNT">Descuento porcentual</option>
                    <option value="FIXED_DISCOUNT">Descuento fijo</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Productos participantes *</label>
                  <select 
                    name="productosParticipantes" 
                    multiple 
                    ref={register} 
                    style={{ width: '100%', minHeight: '100px' }}
                  >
                    {productos.map(producto => (
                      <option 
                        key={producto._id} 
                        value={{ producto_id: producto._id, nombre: producto.nombre }}
                      >
                        {producto.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>Comprar *</label>
                    <input 
                      type="number" 
                      name="cantidadComprar" 
                      ref={register} 
                      required 
                      min="1" 
                      value={promoData.cantidadComprar}
                      onChange={(e) => setPromoData({ ...promoData, cantidadComprar: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="form-group half">
                    <label>Pagar *</label>
                    <input 
                      type="number" 
                      name="cantidadPagar" 
                      ref={register} 
                      required 
                      min="1" 
                      value={promoData.cantidadPagar}
                      onChange={(e) => setPromoData({ ...promoData, cantidadPagar: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Fecha de inicio *</label>
                  <input 
                    type="date" 
                    name="fechaInicio" 
                    ref={register} 
                    required 
                    value={promoData.fechaInicio.toISOString().split('T')[0]}
                    onChange={(e) => setPromoData({ ...promoData, fechaInicio: new Date(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de finalización *</label>
                  <input 
                    type="date" 
                    name="fechaFinalizacion" 
                    ref={register} 
                    required 
                    min={promoData.fechaInicio.toISOString().split('T')[0]}
                    value={promoData.fechaFinalizacion.toISOString().split('T')[0]}
                    onChange={(e) => setPromoData({ ...promoData, fechaFinalizacion: new Date(e.target.value) })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>Hora de inicio</label>
                    <input 
                      type="time" 
                      name="horaInicio" 
                      ref={register} 
                      value={promoData.horaInicio}
                      onChange={(e) => setPromoData({ ...promoData, horaInicio: e.target.value })}
                    />
                  </div>
                  <div className="form-group half">
                    <label>Hora de finalización</label>
                    <input 
                      type="time" 
                      name="horaFinalizacion" 
                      ref={register} 
                      value={promoData.horaFinalizacion}
                      onChange={(e) => setPromoData({ ...promoData, horaFinalizacion: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Días de la semana</label>
                  <select 
                    name="diasSemana" 
                    multiple 
                    ref={register} 
                    style={{ width: '100%', minHeight: '100px' }}
                  >
                    <option value="Lunes">Lunes</option>
                    <option value="Martes">Martes</option>
                    <option value="Miércoles">Miércoles</option>
                    <option value="Jueves">Jueves</option>
                    <option value="Viernes">Viernes</option>
                    <option value="Sábado">Sábado</option>
                    <option value="Domingo">Domingo</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select 
                    name="estado" 
                    ref={register} 
                    value={promoData.estado}
                    onChange={(e) => setPromoData({ ...promoData, estado: e.target.value })}
                  >
                    <option value="Activa">Activa</option>
                    <option value="Inactiva">Inactiva</option>
                  </select>
                </div>

                <div className="form-actions">
                  <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editing ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function onCancel() {
  setShowForm(false);
}