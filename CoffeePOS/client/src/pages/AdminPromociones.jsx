import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import Swal from 'sweetalert2';
import { deletePromotion as deletePromotionApi, getPromotions as getPromotionsApi, createPromotion as createPromotionApi, updatePromotion as updatePromotionApi } from '../services/promotionService.js';
import { getProducts } from '../services/productService.js';
import Button from '../components/common/Button.jsx';
import { Plus, Trash2, Package, Tag } from 'lucide-react';
import './AdminPromociones.css';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIPOS_PROMOCION = [
  { value: 'BUY_X_PAY_Y', label: '2x1 / X/Y (Comprar X, pagar Y)' },
  { value: 'PERCENTAGE_DISCOUNT', label: 'Descuento porcentaje' },
  { value: 'FIXED_DISCOUNT', label: 'Descuento fijo' },
  { value: 'COMBO', label: 'Combo personalizado' }
];

export default function AdminPromociones() {
  const { user } = useAuth();
  const { token } = user || {};
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [diasSeleccionados, setDiasSeleccionados] = useState(DIAS_SEMANA);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [productosCombo, setProductosCombo] = useState([]);
  const [activeTab, setActiveTab] = useState('promociones'); // 'promociones' o 'combos'
  const [tipoSeleccionado, setTipoSeleccionado] = useState('BUY_X_PAY_Y');

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
    try {
      const promoResp = await getPromotionsApi();
      setPromotions(promoResp || []);
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
        tipo: tipoSeleccionado,
        productosParticipantes: productosSeleccionados,
        cantidadComprar: parseInt(data.cantidadComprar) || 2,
        cantidadPagar: parseInt(data.cantidadPagar) || 1,
        descuentoPorcentaje: parseFloat(data.descuentoPorcentaje) || 0,
        descuentoFijo: parseFloat(data.descuentoFijo) || 0,
        productosCombo: productosCombo,
        precioCombo: parseFloat(data.precioCombo) || 0,
        descripcion: data.descripcion || '',
        fechaInicio: data.fechaInicio,
        fechaFinalizacion: data.fechaFinalizacion,
        horaInicio: data.horaInicio || '00:00',
        horaFinalizacion: data.horaFinalizacion || '23:59',
        diasSemana: diasSeleccionados,
        estado: data.estado || 'Activa'
      };
      if (editing) {
        await updatePromotionApi(editing._id, payload);
      } else {
        await createPromotionApi(payload);
      }
      Swal.fire('Guardado', 'Promoción guardada correctamente', 'success');
      setShowForm(false);
      setEditing(null);
      reset();
      setProductosSeleccionados([]);
      setProductosCombo([]);
      setDiasSeleccionados(DIAS_SEMANA);
      setTipoSeleccionado('BUY_X_PAY_Y');
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

  function toggleProducto(productId) {
    setProductosSeleccionados(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }

  function addProductoCombo() {
    setProductosCombo(prev => [...prev, { producto_id: '', cantidad: 1 }]);
  }

  function updateProductoCombo(index, field, value) {
    setProductosCombo(prev => {
      const newCombo = [...prev];
      newCombo[index][field] = value;
      return newCombo;
    });
  }

  function removeProductoCombo(index) {
    setProductosCombo(prev => prev.filter((_, i) => i !== index));
  }

  function openNew() {
    setEditing(null);
    reset();
    setDiasSeleccionados(DIAS_SEMANA);
    setProductosSeleccionados([]);
    setProductosCombo([]);
    setTipoSeleccionado(activeTab === 'combos' ? 'COMBO' : 'BUY_X_PAY_Y');
    setShowForm(true);
  }

  function openEdit(promo) {
    setEditing(promo);
    setDiasSeleccionados(promo.diasSemana?.length ? promo.diasSemana : DIAS_SEMANA);
    setTipoSeleccionado(promo.tipo);
    setProductosSeleccionados(promo.productosParticipantes?.map(p => p.producto_id.toString()) || []);
    setProductosCombo(promo.productosCombo?.map(pc => ({
      producto_id: pc.producto_id.toString(),
      cantidad: pc.cantidad
    })) || []);
    setShowForm(true);
  }

  const filteredPromotions = promotions.filter(promo =>
    activeTab === 'combos' ? promo.tipo === 'COMBO' : promo.tipo !== 'COMBO'
  );

  return (
    <div className="admin-promociones-page">
      <div className="admin-promociones-header">
        <div className="admin-promociones-title-wrapper">
          <h1 className="admin-promociones-title">Promociones y Combos</h1>
        </div>
        <Button onClick={openNew} icon={Plus}>
          {activeTab === 'combos' ? 'Nuevo Combo' : 'Nueva Promoción'}
        </Button>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'promociones' ? 'active' : ''}`}
          onClick={() => setActiveTab('promociones')}
        >
          <Tag size={18} />
          Promociones
        </button>
        <button
          className={`tab-button ${activeTab === 'combos' ? 'active' : ''}`}
          onClick={() => setActiveTab('combos')}
        >
          <Package size={18} />
          Combos
        </button>
      </div>

      <div className="admin-promociones-content">
        {filteredPromotions.length === 0 ? (
          <div className="empty-state">
            <p>No hay {activeTab === 'combos' ? 'combos' : 'promociones'} activas</p>
            <p>Crea tu primera {activeTab === 'combos' ? 'combo' : 'promoción'} para comenzar</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {filteredPromotions.map(promo => (
              <div key={promo._id} className="promotion-card">
                <div className="promotion-card-header">
                  <span className="promotion-type-badge">{promo.tipo}</span>
                  <span className={`promotion-status ${promo.estado === 'Activa' ? 'active' : 'inactive'}`}>
                    {promo.estado}
                  </span>
                </div>
                <div className="promotion-card-body">
                  <h3 className="promotion-nombre">{promo.nombre}</h3>
                  {promo.descripcion && <p className="promotion-desc">{promo.descripcion}</p>}
                  {promo.tipo === 'COMBO' ? (
                    <>
                      <p className="promotion-desc">
                        {promo.productosCombo?.map(pc => `${pc.nombre} (x${pc.cantidad})`).join(', ') || 'Sin productos'}
                      </p>
                      <p className="promotion-rules">
                        Precio combo: ${promo.precioCombo}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="promotion-desc">
                        {promo.productosParticipantes?.map(pp => pp.nombre).join(', ') || 'Sin productos'}
                      </p>
                      {promo.tipo === 'BUY_X_PAY_Y' && (
                        <p className="promotion-rules">
                          Comprar: {promo.cantidadComprar} | Pagar: {promo.cantidadPagar}
                        </p>
                      )}
                      {promo.tipo === 'PERCENTAGE_DISCOUNT' && (
                        <p className="promotion-rules">
                          Descuento: {promo.descuentoPorcentaje}%
                        </p>
                      )}
                      {promo.tipo === 'FIXED_DISCOUNT' && (
                        <p className="promotion-rules">
                          Descuento: ${promo.descuentoFijo}
                        </p>
                      )}
                    </>
                  )}
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
                <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)}>
                  {TIPOS_PROMOCION.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              {tipoSeleccionado === 'COMBO' ? (
                <>
                  <div className="form-group">
                    <label>Descripción</label>
                    <input {...register('descripcion')} type="text" placeholder="Ej: Desayuno completo" defaultValue={editing?.descripcion || ''} />
                  </div>

                  <div className="form-group">
                    <label>Productos del combo *</label>
                    <div className="combo-products-list">
                      {productosCombo.map((pc, index) => (
                        <div key={index} className="combo-product-row">
                          <select
                            value={pc.producto_id}
                            onChange={(e) => updateProductoCombo(index, 'producto_id', e.target.value)}
                            className="combo-product-select"
                          >
                            <option value="">Seleccionar producto</option>
                            {products.map(p => (
                              <option key={p._id} value={p._id}>{p.nombre}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={pc.cantidad}
                            onChange={(e) => updateProductoCombo(index, 'cantidad', parseInt(e.target.value))}
                            className="combo-quantity-input"
                            placeholder="Cant"
                          />
                          <button
                            type="button"
                            onClick={() => removeProductoCombo(index)}
                            className="combo-remove-btn"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addProductoCombo} className="combo-add-btn">
                        <Plus size={16} /> Agregar producto
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Precio del combo *</label>
                    <input {...register('precioCombo', { required: true })} type="number" min="0" step="0.01" defaultValue={editing?.precioCombo || ''} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Productos participantes *</label>
                    <div className="products-checkbox-list">
                      {products.map(p => (
                        <label key={p._id} className="product-checkbox-item">
                          <input
                            type="checkbox"
                            checked={productosSeleccionados.includes(p._id)}
                            onChange={() => toggleProducto(p._id)}
                          />
                          <span>{p.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {tipoSeleccionado === 'BUY_X_PAY_Y' && (
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
                  )}

                  {tipoSeleccionado === 'PERCENTAGE_DISCOUNT' && (
                    <div className="form-group">
                      <label>Descuento porcentaje *</label>
                      <input {...register('descuentoPorcentaje', { required: true })} type="number" min="0" max="100" step="0.1" defaultValue={editing?.descuentoPorcentaje || ''} />
                    </div>
                  )}

                  {tipoSeleccionado === 'FIXED_DISCOUNT' && (
                    <div className="form-group">
                      <label>Descuento fijo *</label>
                      <input {...register('descuentoFijo', { required: true })} type="number" min="0" step="0.01" defaultValue={editing?.descuentoFijo || ''} />
                    </div>
                  )}
                </>
              )}

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
