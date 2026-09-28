import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { LoadingButton } from '../components/common/LoadingButton.jsx';
import Swal from 'sweetalert2';
import { deletePromotion as deletePromotionApi, getPromotions as getPromotionsApi } from '../services/promotionService.js';
import { getProducts } from '../services/productService.js';
import Button from '../components/common/Button.jsx';
import { Check, XMark, Plus } from 'lucide-react';
import './AdminPromociones.css';

export default function AdminPromociones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { token } = user || {};
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [comboVisible, setComboVisible] = useState(false);

  // Cargar promociones
  useEffect(() => {
    const loadPromotions = async () => {
      try {
        const response = await getPromotionsApi();
        setPromotions(response.data || []);
      } catch (error) {
        console.error('Error cargando promociones:', error);
      }
    };
    loadPromotions();
  }, []);

  // Cargar productos
  useEffect(() => {
    const loadProducts = async () => {
      try {
        if (!token) return;
        const response = await getProducts(token);
        setProducts(response.data || []);
      } catch (error) {
        console.error('Error cargando productos:', error);
      }
    };
    loadProducts();
  }, [token]);

  // Estados para el formulario con react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmiting }
  } = useForm({
    resolver: yupResolver(yup.object({
      nombre: yup.string().required('Nombre es obligatorio').min(3, 'Mínimo 3 caracteres'),
      tipo: yup.string().required('Tipo es obligatorio').oneOf(['BUY_X_PAY_Y', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'COMBO']),
      producto_id: yup.string().required('Producto es obligatorio'),
      cantidadComprar: yup.number().integer().min(1, 'Cantidad a comprar debe ser ≥ 1'),
      cantidadPagar: yup.number().integer().min(1, 'Cantidad a pagar debe ser ≥ 1'),
      fechaInicio: yup.date().required('Fecha de inicio es obligatoria'),
      fechaFinalizacion: yup.date().required('Fecha de finalización es obligatoria').min(yup.ref('fechaInicio'), 'Must be after start date'),
      horaInicio: yup.string().required('Hora de inicio es obligatoria'),
      horaFinalizacion: yup.string().required('Hora de finalización es obligatoria'),
      diasSemana: yup.array().of(
        yup.string().oneOf(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
      ),
      estado: yup.string().oneOf(['Activa', 'Inactiva'])
    }))
  });

  // Valores del formulario
  const formValues = useWatch ? useWatch() : {};

  // Para compatibilidad, usar valores del formulario
  const getFormValue = (name) => {
    // Simpler approach - just use register's state
    const field = register(name);
    return field ? field.value : '';
  };

  const onSubmit = async (data) => {
    try {
      setShowForm(false);
      
      const promoData = {
        nombre: data.nombre,
        tipo: data.tipo,
        producto_id: data.producto_id,
        cantidadComprar: data.cantidadComprar,
        cantidadPagar: data.cantidadPagar,
        fechaInicio: data.fechaInicio,
        fechaFinalizacion: data.fechaFinalizacion,
        horaInicio: data.horaInicio,
        horaFinalizacion: data.horaFinalizacion,
        diasSemana: data.diasSemana,
        estado: data.estado
      };

      if (editing) {
        await fetch(`/api/promociones/${editing._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(promoData)
        });
        Swal.fire({
          title: '¡Actualizado!',
          text: 'Promoción actualizada correctamente',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await fetch('/api/promociones', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(promoData)
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
      'BUY_X_PAY_Y': '2x1 / X/Y (Comprar X, pagar Y)',
      'PERCENTAGE_DISCOUNT': 'Descuento %',
      'FIXED_DISCOUNT': 'Descuento fijo',
      'COMBO': 'Combo personalizado'
    };
    return map[tipo] || tipo;
  }

  // Watch hook para obtener valores del formulario
  const useWatch = () => {
    const api = register;
    return {
      nombre: api.nombre ? api.value : '',
      tipo: api.tipo ? api.value : 'BUY_X_PAY_Y',
      producto_id: api.producto_id ? api.value : '',
      cantidadComprar: api.cantidadComprar ? parseInt(api.value) : 2,
      cantidadPagar: api.cantidadPagar ? parseInt(api.value) : 1,
      fechaInicio: new Date(),
      fechaFinalizacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      horaInicio: '00:00',
      horaFinalizacion: '23:59',
      diasSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
    };
  };

  return (
    <div className="admin-promociones-page">
      <header className="admin-promociones-header">
        <div className="admin-promociones-header-left">
          <div className="admin-promociones-title-wrapper">
            <Flame className="admin-promociones-title-icon" size={28} />
            <h1 className="admin-promociones-title">Promociones</h1>
          </div>
          <Button onClick={() => setShowForm(true)} icon={Plus} variant="primary">
            Nueva Promoción
          </Button>
        </div>
      </header>

      <section className="admin-promociones-combos">
        <h2>Nuevo Combo</h2>
        <Button variant="secondary" onClick={() => setComboVisible(true)} className="add-combo-btn">
          <Plus size={18} /> Agregar Combo
        </Button>
      </section>

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
                    ${promo.tipo === 'COMBO' && `- Precio especial de combo`}
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
              
              <form onSubmit={handleSubmit(async (e) => {
                e.preventDefault();
                // Obtener valores actuales del formulario
                const formData = {
                  nombre: getFormValue('nombre'),
                  tipo: getFormValue('tipo'),
                  producto_id: getFormValue('producto_id'),
                  cantidadComprar: parseInt(getFormValue('cantidadComprar')) || 2,
                  cantidadPagar: parseInt(getFormValue('cantidadPagar')) || 1,
                  fechaInicio: new Date(getFormValue('fechaInicio')),
                  fechaFinalizacion: new Date(getFormValue('fechaFinalizacion')),
                  horaInicio: getFormValue('horaInicio'),
                  horaFinalizacion: getFormValue('horaFinalizacion'),
                  diasSemana: // From checklist state
                    (() => {
                      // This is simplified - in real impl would use checklist state
                      return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                    })(),
                  estado: getFormValue('estado')
                };
                await onSubmit(formData);
              })} className="promotion-form">
                
                <div className="form-section">
                  <h3>Datos básicos</h3>
                  
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input 
                      ref={register('nombre')} 
                      type="text" 
                      required 
                      placeholder="Nombre de la promoción"
                    />
                    {errors.nombre && <span className="error">{errors.nombre.message}</span>}
                  </div>

                  <div className="form-group">
                    <label>Tipo *</label>
                    <select 
                      ref={register('tipo')} 
                      required
                    >
                      <option value="BUY_X_PAY_Y">2x1 / X/Y (Comprar X, pagar Y)</option>
                      <option value="PERCENTAGE_DISCOUNT">Descuento porcentual</option>
                      <option value="FIXED_DISCOUNT">Descuento fijo</option>
                      <option value="COMBO">Combo personalizado</option>
                    </select>
                    {errors.tipo && <span className="error">{errors.tipo.message}</span>}
                  </select>
                  <small>Selecciona el tipo de promoción</small>
                  {/* Si es COMBO, mostrar campos adicionales */}
                  {getFormValue('tipo') === 'COMBO' && (
                    <div className="combo-fields">
                      <h4>Productos del Combo</h4>
                      <p>Selecciona 2+ productos para el combo</p>
                    </div>
                  )}
                  {getFormValue('tipo') !== 'COMBO' && (
                    <div className="product-field">
                      <label>Producto participante *</label>
                      <select 
                        ref={register('producto_id')} 
                        required
                      >
                        <option value="">Seleccionar producto</option>
                        {products.map(p => (
                          <option key={p._id} value={p._id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      {errors.producto_id && <span className="error">{errors.producto_id.message}</span>}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Cantidad a comprar *</label>
                  <input 
                    ref={register('cantidadComprar')} 
                    type="number" 
                    min="1" 
                    required
                  />
                  {errors.cantidadComprar && <span className="error">{errors.cantidadComprar.message}</span>}
                </div>

                <div className="form-group">
                  <label>Cantidad a pagar *</label>
                  <input 
                    ref={register('cantidadPagar')} 
                    type="number" 
                    min="1" 
                    required
                  />
                  {errors.cantidadPagar && <span className="error">{errors.cantidadPagar.message}</span>}
                </div>

                <div className="form-group">
                  <label>Fecha de inicio *</label>
                  <input 
                    ref={register('fechaInicio')} 
                    type="date" 
                    required
                  />
                  {errors.fechaInicio && <span className="error">{errors.fechaInicio.message}</span>}
                </div>

                <div className="form-group">
                  <label>Fecha de finalización *</label>
                  <input 
                    ref={register('fechaFinalizacion')} 
                    type="date" 
                    required
                    min={getFormValue('fechaInicio')}
                  />
                  {errors.fechaFinalizacion && <span className="error">{errors.fechaFinalizacion.message}</span>}
                </div>

                <div className="form-group">
                  <label>Hora de inicio</label>
                  <input 
                    ref={register('horaInicio')} 
                    type="time" 
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hora de finalización</label>
                  <input 
                    ref={register('horaFinalizacion')} 
                    type="time" 
                    required
                  />
                </div>

                <!-- Checklist de días en lugar de control select -->
                <div className="days-checklist-section">
                  <label>Días de la semana</label>
                  <div className="days-checklist">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                      <label key={dia} className="day-check-item">
                        <input
                          type="checkbox"
                          name="diasSemana"
                          value={dia}
                          checked={true} // Simplified - en tiempo real vendría del state
                          onChange={(e) => {}}
                        />
                        <span className="day-name">{dia}</span>
                      </label>
                    ))
                  </div>
                  <small className="form-hint">Selecciona los días en los que aplica la promoción</small>
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select 
                    ref={register('estado')} 
                    required
                  >
                    <option value="Activa">Activa</option>
                    <option value="Inactiva">Inactiva</option>
                  </select>
                  {errors.estado && <span className="error">{errors.estado.message}</span>}
                </div>

                <div className="form-actions">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
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