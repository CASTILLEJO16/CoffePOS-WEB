import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { deletePromotion as deletePromotionApi, getPromotions as getPromotionsApi } from '../services/promotionService.js';
import { getProducts } from '../services/productService.js';
import Button from '../components/common/Button.jsx';
import { Plus } from 'lucide-react';
import './AdminPromociones.css';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function AdminPromociones() {
  const { user } = useAuth();
  const { token } = user || {};
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [diasSeleccionados, setDiasSeleccionados] = useState(DIAS_SEMANA);

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
    try {
      const promoResp = await getPromotionsApi();
      setPromotions(promoResp.data || []);
    } catch (e) { console.error('Error promo:', e); }
    try {
      const prodResp = await getProducts();
      setProducts(prodResp || []);
    } catch (e) { console.error('Error productos:', e); }
  }

  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data) => {
    try {
      const payload = {
        nombre: data.nombre,
        tipo: data.tipo,
        productosParticipantes: data.productosParticipantes || [],
        cantidadComprar: parseInt(data.cantidadComprar) || 2,
        cantidadPagar: parseInt(data.cantidadPagar) || 1,
        fechaInicio: data.fechaInicio,
        fechaFinalizacion: data.fechaFinalizacion,
        horaInicio: data.horaInicio || '00:00',
        horaFinalizacion: data.horaFinalizacion || '23:59',
        diasSemana: diasSeleccionados,
        estado: data.estado || 'Activa'
      };
      if (editing) {
        await fetch(`/api/promociones/${editing._id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/promociones', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      Swal.fire('Guardado', 'Promoción guardada correctamente', 'success');
      setShowForm(false);
      setEditing(null);
      reset();
      loadData();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.response?.data?.error || 'Error al guardar', 'error');
    }
  };

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: '¿Eliminar?', text: 'No se puede deshacer', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      await deletePromotionApi(id);
      Swal.fire('Eliminado', 'Promoción eliminada', 'success');
      loadData();
    } catch (e) { Swal.fire('Error', 'No se pudo eliminar', 'error'); }
  }

  function toggleDia(dia) {
    setDiasSeleccionados(prev =>
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    );
  }

  function openNew() {
    setEditing(null);
    reset();
    setDiasSeleccionados(DIAS_SEMANA);
    setShowForm(true);
  }

  function openEdit(promo) {
    setEditing(promo);
    setDiasSeleccionados(promo.diasSemana?.length ? promo.diasSemana : DIAS_SEMANA);
    setShowForm(true);
  }

  return (
    <div className="admin-promociones-page">
      <div className="admin-promociones-header">
        <div className="admin-promociones-title-wrapper">
          <h1 className="admin-promociones-title">Promociones</h1>
        </div>
        <Button onClick={openNew} icon={Plus}>Nueva Promoción</Button>
      </div>

      <div className="admin-promociones-content">
        {promotions.length === 0 ? (
          <div className="empty-state">
            <p>No hay promociones activas</p>
            <p>Crea tu primera promoción para comenzar</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {promotions.map(promo => (
              <div key={promo._id} className="promotion-card">
                <div className="promotion-card-header">
                  <span className="promotion-type-badge">{promo.tipo}</span>
                  <span className={`promotion-status ${promo.estado === 'Activa' ? 'active' : 'inactive'}`}>
                    {promo.estado}
                  </span>
                </div>
                <div className="promotion-card-body">
                  <h3 className="promotion-nombre">{promo.nombre}</h3>
                  <p className="promotion-desc">
                    {promo.productosParticipantes?.map(pp => pp.nombre).join(', ') || 'Sin productos'}
                  </p>
                  <p className="promotion-rules">
                    Comprar: {promo.cantidadComprar} | Pagar: {promo.cantidadPagar}
                  </p>
                </div>
                <div className="promotion-card-footer">
                  <Button variant="secondary" size="small" onClick={() => openEdit(promo)}>Editar</Button>
                  <Button variant="danger" size="small" onClick={() => handleDelete(promo._id)}>Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="promo-form-overlay" onClick={() => setShowForm(false)}>
          <div className="promo-form-card" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="promotion-form">
              <div className="form-group">
                <label>Nombre *</label>
                <input {...register('nombre', { required: true })} type="text" placeholder="Ej: 2x1 Café Americano" defaultValue={editing?.nombre || ''} />
              </div>

              <div className="form-group">
                <label>Tipo *</label>
                <select {...register('tipo')} defaultValue={editing?.tipo || 'BUY_X_PAY_Y'}>
                  <option value="BUY_X_PAY_Y">2x1 / X/Y (Comprar X, pagar Y)</option>
                  <option value="PERCENTAGE_DISCOUNT">Descuento %</option>
                  <option value="FIXED_DISCOUNT">Descuento fijo</option>
                  <option value="COMBO">Combo</option>
                </select>
              </div>

              <div className="form-group">
                <label>Productos participantes *</label>
                <select {...register('productosParticipantes')} multiple style={{ minHeight: '120px' }}>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.nombre}</option>
                  ))}
                </select>
                <small className="form-hint">Mantén Ctrl/Cmd para seleccionar varios</small>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Cantidad a comprar *</label>
                  <input {...register('cantidadComprar', { required: true })} type="number" min="1" defaultValue={editing?.cantidadComprar || 2} />
                </div>
                <div className="form-group half">
                  <label>Cantidad a pagar *</label>
                  <input {...register('cantidadPagar', { required: true })} type="number" min="1" defaultValue={editing?.cantidadPagar || 1} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Fecha inicio *</label>
                  <input {...register('fechaInicio', { required: true })} type="date" defaultValue={editing?.fechaInicio?.split('T')[0] || new Date().toISOString().split('T')[0]} />
                </div>
                <div className="form-group half">
                  <label>Fecha fin *</label>
                  <input {...register('fechaFinalizacion', { required: true })} type="date" defaultValue={editing?.fechaFinalizacion?.split('T')[0] || ''} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>Hora inicio</label>
                  <input {...register('horaInicio')} type="time" defaultValue={editing?.horaInicio || '00:00'} />
                </div>
                <div className="form-group half">
                  <label>Hora fin</label>
                  <input {...register('horaFinalizacion')} type="time" defaultValue={editing?.horaFinalizacion || '23:59'} />
                </div>
              </div>

              <div className="form-group">
                <label>Días de la semana</label>
                <div className="days-checklist">
                  {DIAS_SEMANA.map(dia => (
                    <label key={dia} className="day-check-item">
                      <input
                        type="checkbox"
                        checked={diasSeleccionados.includes(dia)}
                        onChange={() => toggleDia(dia)}
                      />
                      <span>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Estado</label>
                <select {...register('estado')} defaultValue={editing?.estado || 'Activa'}>
                  <option value="Activa">Activa</option>
                  <option value="Inactiva">Inactiva</option>
                </select>
              </div>

              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit">{editing ? 'Actualizar' : 'Crear'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
