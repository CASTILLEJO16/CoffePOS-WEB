import './OrderSummary.css';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { useTranslation, useCurrency } from '../../utils/i18n/useTranslation.js';
import Button from '../common/Button.jsx';

export default function OrderSummary({ subtotal, impuestos, total, onCheckout, onCancel, onClear, disabled, promoDiscount = 0, loyaltyDiscountAmount = 0, loyaltyRewardLabel = null }) {
  const { t, language } = useTranslation();
  const currency = useCurrency(); // Force re-render on currency change
  // 🔥 Calcular IVA en tiempo real (evita valores viejos en el state)
  const ivaRate = (() => {
    const val = localStorage.getItem('iva_rate');
    const num = val ? parseFloat(val) : 0.16;
    return Number.isFinite(num) ? num : 0.16;
  })();
  const ivaPercent = Math.round(ivaRate * 100);

  // subtotal/impuestos/total ya vienen con promociones y lealtad aplicadas (mismo cálculo que el servidor)
  const loyaltyAmount = Number(loyaltyDiscountAmount) || 0;

  return (
    <div className="order-summary">
      <div className="order-summary-totals">
        <div className="summary-row">
          <span className="summary-label">{t('Subtotal')}</span>
          {/* subtotal ya viene con el descuento de promociones: mostrar el bruto */}
          <span className="summary-value">{formatCurrency(subtotal + (promoDiscount || 0) + loyaltyAmount)}</span>
        </div>
        {promoDiscount > 0 && (
          <div className="summary-row" style={{ color: '#10b981' }}>
            <span className="summary-label">{t('Promociones')}</span>
            <span className="summary-value">-{formatCurrency(promoDiscount)}</span>
          </div>
        )}
        {loyaltyAmount > 0 && (
          <div className="summary-row" style={{ color: '#10b981' }}>
            <span className="summary-label">{t('Lealtad')}{loyaltyRewardLabel ? ` (${loyaltyRewardLabel})` : ''}</span>
            <span className="summary-value">-{formatCurrency(loyaltyAmount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span className="summary-label">{t('IVA')} ({ivaPercent}%)</span>
          <span className="summary-value">{formatCurrency(impuestos)}</span>
        </div>
        <div className="summary-row summary-row-total">
          <span className="summary-label summary-label-total">{t('Total')}</span>
          <span className="summary-value summary-value-total">{formatCurrency(total)}</span>
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
