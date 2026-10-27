import './OrderSummary.css';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { useTranslation, useCurrency } from '../../utils/i18n/useTranslation.js';
import Button from '../common/Button.jsx';

export default function OrderSummary({ subtotal, impuestos, total, onCheckout, onCancel, onClear, disabled, loyaltyDiscount = 0, loyaltyFreeProduct = null }) {
  const { t, language } = useTranslation();
  const currency = useCurrency(); // Force re-render on currency change
  // 🔥 Calcular IVA en tiempo real (evita valores viejos en el state)
  const ivaRate = (() => {
    const val = localStorage.getItem('iva_rate');
    const num = val ? parseFloat(val) : 0.16;
    return Number.isFinite(num) ? num : 0.16;
  })();
  const ivaPercent = Math.round(ivaRate * 100);

  // Calcular descuento de lealtad
  const discountAmount = loyaltyDiscount > 0 ? subtotal * (loyaltyDiscount / 100) : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const impuestosCalc = subtotalAfterDiscount * ivaRate;
  const totalCalc = subtotalAfterDiscount + impuestosCalc;

  return (
    <div className="order-summary">
      <div className="order-summary-totals">
        <div className="summary-row">
          <span className="summary-label">{t('Subtotal')}</span>
          <span className="summary-value">{formatCurrency(subtotal)}</span>
        </div>
        {loyaltyDiscount > 0 && (
          <div className="summary-row" style={{ color: '#10b981' }}>
            <span className="summary-label">{t('Descuento Lealtad')} ({loyaltyDiscount}%)</span>
            <span className="summary-value">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span className="summary-label">{t('IVA')} ({ivaPercent}%)</span>
          <span className="summary-value">{formatCurrency(impuestosCalc)}</span>
        </div>
        {loyaltyFreeProduct && (
          <div className="summary-row" style={{ color: '#10b981', fontWeight: 'bold' }}>
            <span className="summary-label">{t('Producto Gratis')}</span>
            <span className="summary-value">{loyaltyFreeProduct.description}</span>
          </div>
        )}
        <div className="summary-row summary-row-total">
          <span className="summary-label summary-label-total">{t('Total')}</span>
          <span className="summary-value summary-value-total">{formatCurrency(totalCalc)}</span>
        </div>
      </div>
      <div className="order-summary-actions">
        <Button 
          variant="success" 
          size="large" 
          className="checkout-button"
          onClick={onCheckout}
          disabled={disabled || total === 0}
        >
          {t('Cobrar')}
        </Button>
        <Button 
          variant="danger" 
          size="medium" 
          onClick={onCancel}
          disabled={disabled || total === 0}
        >
          {t('Cancelar')}
        </Button>
        <Button 
          variant="secondary" 
          size="medium" 
          onClick={onClear}
          disabled={disabled || total === 0}
        >
          {t('Vaciar')}
        </Button>
      </div>
    </div>
  );
}
