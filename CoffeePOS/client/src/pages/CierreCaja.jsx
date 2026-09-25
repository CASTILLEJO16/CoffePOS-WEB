import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getCashRegisterSummary, closeCashRegister } from '../services/cashRegisterService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatBusinessDate, formatBusinessTime, formatBusinessDateTime } from '../utils/dateTime.js';
import html2pdf from 'html2pdf.js';
import {
  Wallet,
  Clock,
  Calendar,
  User,
  DollarSign,
  FileText,
  Printer,
  Download,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import './CierreCaja.css';

export default function CierreCaja() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    total_contado: '',
    observaciones: ''
  });

  useEffect(() => {
    loadSummary();
  }, [id]);

  async function loadSummary() {
    if (!id) {
      setError('ID de caja no proporcionado');
      setLoading(false);
      return;
    }

    try {
      const data = await getCashRegisterSummary(id);
      setSummary(data);
      
      // Pre-llenar el total contado con el esperado
      setFormData(prev => ({
        ...prev,
        total_contado: data.total_esperado?.toString() || '0'
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el resumen');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setClosing(true);

    try {
      const totalContado = parseFloat(formData.total_contado) || 0;

      await closeCashRegister(id, {
        total_contado: totalContado,
        observaciones: formData.observaciones
      });

      // Redirigir a la página de cortes de caja
      navigate('/admin/cortes-caja');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cerrar la caja');
      setClosing(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadTicket() {
    if (!summary) return;

    const totalContado = parseFloat(formData.total_contado) || 0;
    const diferencia = totalContado - (summary.total_esperado || 0);

    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket Cierre de Caja</title>
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
          .ticket-item { margin-bottom: 4px; }
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
            <p>Cierre de Caja - Turno #${summary.id}</p>
          </div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Vendedor:</strong> ${summary.usuario_nombre}
            </div>
            <div class="ticket-info-row">
              <strong>Caja:</strong> ${summary.nombre_caja || 'Sin nombre'}
            </div>
            <div class="ticket-info-row">
              <strong>Apertura:</strong> ${formatBusinessDateTime(summary.fecha_apertura)}
            </div>
            ${summary.fecha_cierre ? `<div class="ticket-info-row"><strong>Cierre:</strong> ${formatBusinessDateTime(summary.fecha_cierre)}</div>` : ''}
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Fondo Inicial:</strong> ${formatCurrency(summary.fondo_inicial)}
            </div>
            <div class="ticket-info-row">
              <strong>Ventas Efectivo:</strong> ${formatCurrency(summary.ventas_efectivo)}
            </div>
            <div class="ticket-info-row">
              <strong>Ventas Tarjeta:</strong> ${formatCurrency(summary.ventas_tarjeta)}
            </div>
            ${summary.ventas_dolar > 0 ? `<div class="ticket-info-row"><strong>Ventas USD:</strong> ${formatCurrency(summary.ventas_dolar)}</div>` : ''}
            <div class="ticket-info-row">
              <strong>Total Vendido:</strong> ${formatCurrency(summary.ventas_efectivo + summary.ventas_tarjeta)}
            </div>
          </div>

          <div class="ticket-divider"></div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Total Esperado:</strong> ${formatCurrency(summary.total_esperado)}
            </div>
            <div class="ticket-info-row">
              <strong>Total Contado:</strong> ${formatCurrency(totalContado)}
            </div>
            <div class="ticket-info-row">
              <strong>Diferencia:</strong> ${formatCurrency(diferencia)}
            </div>
          </div>

          <div class="ticket-info">
            <div class="ticket-info-row">
              <strong>Observaciones:</strong> ${formData.observaciones || 'Ninguna'}
            </div>
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

  function handleExportPDF() {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; color: black; background: white; width: 100%; max-width: 600px; margin: 0 auto;">
        <h1 style="text-align: center; margin-bottom: 5px;">Coffee POS</h1>
        <h2 style="text-align: center; margin-top: 0; color: #555;">Cierre de Caja - Turno #${summary.id}</h2>
        <hr style="margin: 20px 0;" />
        <p><strong>Vendedor:</strong> ${summary.usuario_nombre}</p>
        <p><strong>Caja:</strong> ${summary.nombre_caja || 'Sin nombre'}</p>
        <p><strong>Apertura:</strong> ${formatBusinessDateTime(summary.fecha_apertura)}</p>
        ${summary.fecha_cierre ? `<p><strong>Cierre:</strong> ${formatBusinessDateTime(summary.fecha_cierre)}</p>` : ''}
        <hr style="margin: 20px 0;" />
        <p><strong>Fondo Inicial:</strong> ${formatCurrency(summary.fondo_inicial)}</p>
        <p><strong>Ventas Efectivo:</strong> ${formatCurrency(summary.ventas_efectivo)}</p>
        <p><strong>Ventas Tarjeta:</strong> ${formatCurrency(summary.ventas_tarjeta)}</p>
        ${summary.ventas_dolar > 0 ? `
        <p><strong>Ventas USD (incluidas en efectivo):</strong> ${formatCurrency(summary.ventas_dolar)}</p>
        <p><strong>Total USD recibido:</strong> $${summary.total_dolar?.toFixed(2) || '0.00'} USD</p>` : ''}
        <p><strong>Total Descuentos:</strong> ${formatCurrency(summary.total_descuentos)}</p>
        <p><strong>Total Devoluciones:</strong> ${formatCurrency(summary.total_devoluciones)}</p>
        <p style="font-size: 1.2em; margin-top: 15px;"><strong>Total Vendido:</strong> ${formatCurrency(summary.ventas_efectivo + summary.ventas_tarjeta)}</p>
        <hr style="margin: 20px 0;" />
        <p><strong>Total Esperado:</strong> ${formatCurrency(summary.total_esperado)}</p>
        <p><strong>Total Contado:</strong> ${formatCurrency(formData.total_contado || 0)}</p>
        <p><strong>Diferencia:</strong> ${formatCurrency(calculateDifference())}</p>
        <p><strong>Observaciones:</strong> ${formData.observaciones || 'Ninguna'}</p>
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `Cierre_Caja_${summary.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  }

  function calculateDifference() {
    if (!summary || !formData.total_contado) return 0;
    const totalContado = parseFloat(formData.total_contado) || 0;
    return totalContado - (summary.total_esperado || 0);
  }

  const diferencia = calculateDifference();
  const isFaltante = diferencia < 0;
  const isSobrante = diferencia > 0;

  if (loading) {
    return (
      <div className="cierre-caja-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando resumen de caja...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="cierre-caja-page">
        <div className="error-container">
          <AlertTriangle size={48} />
          <p>{error || 'No se encontró la caja'}</p>
          <button onClick={() => navigate('/admin/cortes-caja')} className="back-button">
            Volver a Cortes de Caja
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cierre-caja-page">
      <div className="cierre-caja-container">
        <div className="cierre-caja-header">
          <div className="header-icon">
            <Wallet size={48} />
          </div>
          <h1 className="cierre-title">Cierre de Caja</h1>
          <p className="cierre-subtitle">Resumen del turno #{summary.id}</p>
        </div>

        <div className="cierre-info-grid">
          <div className="info-card">
            <Calendar className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Fecha Apertura</span>
              <span className="info-value">
                {formatBusinessDate(summary.fecha_apertura)}
              </span>
            </div>
          </div>

          <div className="info-card">
            <Clock className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Hora Apertura</span>
              <span className="info-value">
                {formatBusinessTime(summary.fecha_apertura, false)}
              </span>
            </div>
          </div>

          <div className="info-card">
            <User className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Vendedor</span>
              <span className="info-value">{summary.usuario_nombre}</span>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <h2 className="section-title">Resumen de Ventas</h2>
          
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Fondo Inicial</span>
              <span className="summary-value">{formatCurrency(summary.fondo_inicial)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Ventas Efectivo</span>
              <span className="summary-value">{formatCurrency(summary.ventas_efectivo)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Ventas Tarjeta</span>
              <span className="summary-value">{formatCurrency(summary.ventas_tarjeta)}</span>
            </div>

            {summary.ventas_dolar > 0 && (
              <>
                <div className="summary-item">
                  <span className="summary-label">Ventas USD (incluidas en efectivo)</span>
                  <span className="summary-value">{formatCurrency(summary.ventas_dolar)}</span>
                </div>

                <div className="summary-item">
                  <span className="summary-label">Total USD recibido</span>
                  <span className="summary-value">${summary.total_dolar?.toFixed(2) || '0.00'} USD</span>
                </div>
              </>
            )}

            <div className="summary-item">
              <span className="summary-label">Total Descuentos</span>
              <span className="summary-value negative">{formatCurrency(summary.total_descuentos)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Total Devoluciones</span>
              <span className="summary-value negative">{formatCurrency(summary.total_devoluciones)}</span>
            </div>

            <div className="summary-item highlighted">
              <span className="summary-label">Total Esperado</span>
              <span className="summary-value">{formatCurrency(summary.total_esperado)}</span>
            </div>
          </div>
        </div>

        <form className="cierre-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <DollarSign size={18} />
              Efectivo Contado
            </label>
            <div className="currency-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                name="total_contado"
                className="form-input currency-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.total_contado}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {diferencia !== 0 && (
            <div className={`difference-card ${isFaltante ? 'faltante' : 'sobrante'}`}>
              {isFaltante ? (
                <ArrowDown className="difference-icon" size={24} />
              ) : (
                <ArrowUp className="difference-icon" size={24} />
              )}
              <div className="difference-content">
                <span className="difference-label">
                  {isFaltante ? 'Faltante' : 'Sobrante'}
                </span>
                <span className="difference-value">
                  {formatCurrency(Math.abs(diferencia))}
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              <FileText size={18} />
              Observaciones
            </label>
            <textarea
              name="observaciones"
              className="form-textarea"
              placeholder="Notas sobre el cierre de caja..."
              rows="3"
              value={formData.observaciones}
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="action-buttons">
            <button
              type="button"
              className="action-button secondary"
              onClick={handlePrint}
            >
              <Printer size={18} />
              Imprimir
            </button>

            <button
              type="button"
              className="action-button secondary"
              onClick={handleDownloadTicket}
            >
              <Download size={18} />
              Descargar Ticket
            </button>

            <button
              type="button"
              className="action-button secondary"
              onClick={handleExportPDF}
            >
              <Download size={18} />
              Exportar PDF
            </button>

            <button
              type="submit"
              className="action-button primary"
              disabled={closing}
            >
              <CheckCircle size={18} />
              {closing ? 'Cerrando caja...' : 'Confirmar Cierre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
