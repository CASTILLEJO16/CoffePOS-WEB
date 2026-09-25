import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllCashRegisters } from '../services/cashRegisterService.js';
import { formatCurrency, formatDate } from '../utils/formatCurrency.js';
import { formatBusinessDateTime } from '../utils/dateTime.js';
import html2pdf from 'html2pdf.js';
import {
  Wallet,
  Calendar,
  Clock,
  User,
  DollarSign,
  Filter,
  Search,
  Download,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import './CortesCaja.css';

export default function CortesCaja() {
  const navigate = useNavigate();
  const [cortes, setCortes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado: 'todos',
    startDate: '',
    endDate: '',
    search: ''
  });

  useEffect(() => {
    loadCortes();
  }, [filters]);

  async function loadCortes() {
    try {
      setLoading(true);
      const params = {};
      
      if (filters.estado !== 'todos') {
        params.estado = filters.estado;
      }
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }

      const data = await getAllCashRegisters(params);
      
      // Filtrar por búsqueda de nombre de usuario
      let filteredData = data;
      if (filters.search) {
        filteredData = data.filter(corte => 
          corte.usuario_nombre?.toLowerCase().includes(filters.search.toLowerCase()) ||
          corte.nombre_caja?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      setCortes(filteredData);
    } catch (error) {
      console.error('Error al cargar cortes:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }

  function handlePrint(corte) {
    window.print();
  }

  function handleDownloadTicket(corte) {
    const totalContado = corte.total_contado || 0;
    const diferencia = (corte.total_contado || 0) - (corte.total_esperado || 0);

    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket Corte de Caja</title>
        <style>
          @page { size: 110mm 210mm; margin: 5mm; }
          body { font-family: 'Courier New', monospace; font-size: 11px; width: 100%; margin: 0 auto; background: white; }
          .ticket { width: 100%; max-width: 400px; margin: 0 auto; }
          .ticket-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
          .ticket-header h1 { font-size: 18px; margin-bottom: 2px; }
          .ticket-header p { font-size: 11px; color: #555; }
          .ticket-info { margin-bottom: 8px; font-size: 10px; }
          .ticket-info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .ticket-divider { border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
          .ticket-footer { text-align: center; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; font-size: 10px; color: #555; }
          .ticket-signature { margin-top: 20px; padding-top: 15px; border-top: 1px solid #000; }
          .ticket-signature p { margin: 3px 0; }
          .ticket-signature .line { width: 45%; border-bottom: 1px solid #000; display: inline-block; margin: 0 5%; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="ticket-header">
            <h1>Coffee POS</h1>
            <p>Corte de Caja #${corte.id}</p>
          </div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Vendedor:</strong> ${corte.usuario_nombre || '-'}
            </div>
            <div class="ticket-info-row">
              <strong>Caja:</strong> ${corte.nombre_caja || 'Sin nombre'}
            </div>
            <div class="ticket-info-row">
              <strong>Apertura:</strong> ${formatBusinessDateTime(corte.fecha_apertura)}
            </div>
            ${corte.fecha_cierre ? `<div class="ticket-info-row"><strong>Cierre:</strong> ${formatBusinessDateTime(corte.fecha_cierre)}</div>` : ''}
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Fondo Inicial:</strong> ${formatCurrency(corte.fondo_inicial)}
            </div>
            <div class="ticket-info-row">
              <strong>Ventas Efectivo:</strong> ${formatCurrency(corte.ventas_efectivo)}
            </div>
            <div class="ticket-info-row">
              <strong>Ventas Tarjeta:</strong> ${formatCurrency(corte.ventas_tarjeta)}
            </div>
            ${corte.ventas_dolar > 0 ? `<div class="ticket-info-row"><strong>Ventas USD:</strong> ${formatCurrency(corte.ventas_dolar)}</div>` : ''}
            <div class="ticket-info-row">
              <strong>Total Vendido:</strong> ${formatCurrency(corte.ventas_efectivo + corte.ventas_tarjeta)}
            </div>
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-info">
            ${corte.estado === 'cerrada' ? `
            <div class="ticket-info-row">
              <strong>Total Esperado:</strong> ${formatCurrency(corte.total_esperado)}
            </div>
            <div class="ticket-info-row">
              <strong>Total Contado:</strong> ${formatCurrency(corte.total_contado)}
            </div>
            <div class="ticket-info-row">
              <strong>Diferencia:</strong> ${formatCurrency(corte.diferencia)}
            </div>` : ''}
          </div>

          <div class="ticket-signature">
            <p>_______________________________</p>
            <p>Firma: _________________________</p>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(ticketHTML);
      printWindow.document.close();
      printWindow.onload = function() {
        printWindow.focus();
      };
    } else {
      console.error('No se pudo abrir la ventana del ticket');
    }
  }

  function handleExportPDF(corte, index) {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 24px; font-family: Arial, sans-serif; color: #111; background: #fff; width: 100%; max-width: 700px; margin: 0 auto;">
        <div style="text-align:center; margin-bottom: 10px;">
          <div style="font-size:18px; font-weight:700; letter-spacing:1px;">COFFEE POS</div>
          <div style="font-size:14px; color:#555;">Corte de Caja #${index + 1}</div>
        </div>

        <div style="border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span><strong>Vendedor:</strong></span>
            <span>${corte.usuario_nombre || '-'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span><strong>Caja:</strong></span>
            <span>${corte.nombre_caja || 'Sin nombre'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span><strong>Apertura:</strong></span>
            <span>${formatBusinessDateTime(corte.fecha_apertura)}</span>
          </div>
          ${corte.fecha_cierre ? `
          <div style="display:flex; justify-content:space-between;">
            <span><strong>Cierre:</strong></span>
            <span>${formatBusinessDateTime(corte.fecha_cierre)}</span>
          </div>` : ''}
        </div>

        <div style="border:1px solid #eee; border-radius:8px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Fondo Inicial</span>
            <span>${formatCurrency(corte.fondo_inicial)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Ventas Efectivo</span>
            <span>${formatCurrency(corte.ventas_efectivo)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Ventas Tarjeta</span>
            <span>${formatCurrency(corte.ventas_tarjeta)}</span>
          </div>
          ${corte.ventas_dolar > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Ventas USD (incluidas en efectivo)</span>
            <span>${formatCurrency(corte.ventas_dolar || 0)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Total USD recibido</span>
            <span>$${corte.total_dolar?.toFixed(2) || '0.00'} USD</span>
          </div>` : ''}
          <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid #ddd; padding-top:8px; margin-top:8px;">
            <span>Total Vendido</span>
            <span>${formatCurrency(corte.ventas_efectivo + corte.ventas_tarjeta)}</span>
          </div>
        </div>

        ${corte.estado === 'cerrada' ? `
        <div style="border:1px solid #eee; border-radius:8px; padding:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Total Esperado</span>
            <span>${formatCurrency(corte.total_esperado)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Total Contado</span>
            <span>${formatCurrency(corte.total_contado)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; color:${corte.diferencia === 0 ? '#111' : (corte.diferencia > 0 ? 'green' : 'red')};">
            <span>Diferencia</span>
            <span>${formatCurrency(corte.diferencia)}</span>
          </div>
        </div>
        ` : ''}

        <div style="text-align:center; margin-top:16px; font-size:12px; color:#777;">Generado por Coffee POS</div>
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `Corte_Caja_${corte.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  }

  return (
    <div className="admin-page cortes-caja-page">
      <div className="cortes-caja-container">
        <div className="cortes-header">
          <div className="header-left">
            <Wallet className="header-icon" size={32} />
            <div>
              <h1 className="cortes-title">Cortes de Caja</h1>
              <p className="cortes-subtitle">Historial de aperturas y cierres de caja</p>
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <div className="filter-item">
              <label className="filter-label">
                <Filter size={16} />
                Estado
              </label>
              <select
                className="filter-select"
                value={filters.estado}
                onChange={(e) => handleFilterChange('estado', e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="abierta">Abiertas</option>
                <option value="cerrada">Cerradas</option>
              </select>
            </div>

            <div className="filter-item">
              <label className="filter-label">
                <Calendar size={16} />
                Fecha Inicio
              </label>
              <input
                type="date"
                className="filter-input"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="filter-item">
              <label className="filter-label">
                <Calendar size={16} />
                Fecha Fin
              </label>
              <input
                type="date"
                className="filter-input"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            <div className="filter-item search-item">
              <label className="filter-label">
                <Search size={16} />
                Buscar
              </label>
              <input
                type="text"
                className="filter-input"
                placeholder="Vendedor o caja..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">Cargando cortes de caja...</div>
        ) : cortes.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <p>No hay cortes de caja con los filtros actuales</p>
          </div>
        ) : (
          <div className="cortes-grid">
            {cortes.map((corte, index) => {
              const corteId = corte._id || corte.id;
              const displayId = `Corte #${index + 1}`;
              return (
                <div key={corteId} className="corte-card">
                  <div className="corte-card-header">
                    <div className="corte-info">
                      <span className="corte-id">{displayId}</span>
                      <span className={`corte-status ${corte.estado}`}>
                      {corte.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                  <div className="corte-actions">
                    <button
                      className="action-icon-btn"
                      onClick={() => handleDownloadTicket(corte)}
                      title="Descargar Ticket"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => handleExportPDF(corte, index)}
                      title="Descargar PDF"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                <div className="corte-card-body">
                  <div className="corte-details">
                    <div className="detail-row">
                      <User size={16} className="detail-icon" />
                      <span className="detail-label">Vendedor:</span>
                      <span className="detail-value">{corte.usuario_nombre}</span>
                    </div>

                    <div className="detail-row">
                      <Wallet size={16} className="detail-icon" />
                      <span className="detail-label">Caja:</span>
                      <span className="detail-value">{corte.nombre_caja || 'Sin nombre'}</span>
                    </div>

                    <div className="detail-row">
                      <Calendar size={16} className="detail-icon" />
                      <span className="detail-label">Apertura:</span>
                      <span className="detail-value">
                        {formatBusinessDateTime(corte.fecha_apertura)}
                      </span>
                    </div>

                    {corte.fecha_cierre && (
                      <div className="detail-row">
                        <Clock size={16} className="detail-icon" />
                        <span className="detail-label">Cierre:</span>
                        <span className="detail-value">
                          {formatBusinessDateTime(corte.fecha_cierre)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="corte-totals">
                    <div className="total-row">
                      <span className="total-label">Fondo Inicial:</span>
                      <span className="total-value">{formatCurrency(corte.fondo_inicial)}</span>
                    </div>

                    <div className="total-row">
                      <span className="total-label">Ventas Efectivo:</span>
                      <span className="total-value">{formatCurrency(corte.ventas_efectivo)}</span>
                    </div>

                    <div className="total-row">
                      <span className="total-label">Ventas Tarjeta:</span>
                      <span className="total-value">{formatCurrency(corte.ventas_tarjeta)}</span>
                    </div>

                    {corte.ventas_dolar > 0 && (
                      <>
                        <div className="total-row">
                          <span className="total-label">Ventas USD (incluidas en efectivo):</span>
                          <span className="total-value">{formatCurrency(corte.ventas_dolar)}</span>
                        </div>

                        <div className="total-row">
                          <span className="total-label">Total USD recibido:</span>
                          <span className="total-value">${corte.total_dolar?.toFixed(2) || '0.00'} USD</span>
                        </div>
                      </>
                    )}

                    <div className="total-row">
                      <span className="total-label">Total Vendido:</span>
                      <span className="total-value highlighted">
                        {formatCurrency(
                          corte.ventas_efectivo + 
                          corte.ventas_tarjeta
                        )}
                      </span>
                    </div>

                    {corte.estado === 'cerrada' && (
                      <>
                        <div className="total-row">
                          <span className="total-label">Total Esperado:</span>
                          <span className="total-value">{formatCurrency(corte.total_esperado)}</span>
                        </div>

                        <div className="total-row">
                          <span className="total-label">Total Contado:</span>
                          <span className="total-value">{formatCurrency(corte.total_contado)}</span>
                        </div>

                        <div className={`total-row difference ${corte.diferencia !== 0 ? 'has-difference' : ''}`}>
                          <span className="total-label">Diferencia:</span>
                          <span className={`total-value ${corte.diferencia < 0 ? 'negative' : corte.diferencia > 0 ? 'positive' : ''}`}>
                            {corte.diferencia !== 0 && (
                              <>
                                {corte.diferencia < 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                              </>
                            )}
                            {formatCurrency(Math.abs(corte.diferencia))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
