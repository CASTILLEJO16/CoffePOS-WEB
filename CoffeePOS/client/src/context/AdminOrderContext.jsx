import { createContext, useContext, useReducer } from 'react';
import { getCustomerByPhone } from '../services/customerService.js';
import { calculateCartTotals, getIVARate as getCartIVARate } from '../utils/cartTotals.js';
import { computeRewardDiscount, round2 as round2Loyalty } from '../utils/loyaltyRewards.js';

/**
 * Contexto de Orden exclusivo para el Admin.
 * Completamente aislado del OrderContext del vendedor.
 */
const AdminOrderContext = createContext();

const getIVARate = getCartIVARate;

// Totales con la misma regla del servidor (incluye 2x1 / Compra X paga Y)
function calculateTotals(items, promotions = []) {
  return calculateCartTotals(items, promotions);
}

function calculatePriceWithDiscount(precio, descuento) {
  if (!descuento || descuento <= 0) return precio;
  return precio * (1 - descuento / 100);
}




const initialState = {
  items: [],
  subtotal: 0,
  impuestos: 0,
  total: 0,
  promoDiscount: 0,
  promoDetails: [],
  customerName: '',
  customerPhone: '',
  loyaltyCard: null,
  loyaltyDiscount: 0,
  loyaltyFreeProduct: null,
  loyaltyReward: null,
  promotions: [],
  productsMap: new Map()
};

function orderReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, customization } = action.payload;

      // Crear un ID único basado en producto + personalizaciones
      const customizationKey = JSON.stringify(customization || {});
      const productId = product._id || product.id;
      const uniqueId = `${productId}_${customizationKey}`;

      const existingItem = state.items.find(item => item.uniqueId === uniqueId);

      // Si es un combo, usar el precio del combo directamente
      if (customization?.isCombo) {
        const finalPrice = product.precio;

        let newItems;
        if (existingItem) {
          newItems = state.items.map(item =>
            item.uniqueId === uniqueId
              ? { ...item, cantidad: item.cantidad + 1, importe: (item.cantidad + 1) * item.precio_final }
              : item
          );
        } else {
          newItems = [
            ...state.items,
            {
              uniqueId: uniqueId,
              producto_id: product._id || product.id,
              producto_nombre: product.nombre,
              precio_base: product.precio,
              precio_final: finalPrice,
              descuento: 0,
              cantidad: 1,
              importe: finalPrice,
              personalizaciones: customization || {},
              categoria: product.categoria || 'Combos',
              promoDescuento: 0,
              isCombo: true,
              comboProducts: customization.comboProducts || []
            }
          ];
        }

        const totals = calculateTotals(newItems, state.promotions);
        return { ...state, items: newItems, ...totals };
      }

      // Producto normal (con o sin promoción pre-calculada desde handlePromotionClick)
      // Si el producto tiene promoAplicada, product.precio ya es el precio con descuento.
      // product.precioOriginal guarda el precio sin descuento para mostrarlo tachado en el carrito.
      const discountedPrice = calculatePriceWithDiscount(product.precio, product.descuento);

      // Calcular precio adicional por personalizaciones
      const customizationPrice = calculateCustomizationPrice(customization);
      const finalPrice = discountedPrice + customizationPrice;

      // Precio original para mostrar tachado si hay promo
      const precioOriginal = product.precioOriginal ?? product.precio;
      // promoDescuento = ahorro por unidad (para badge visual en OrderItem)
      const promoDescuento = product.promoAplicada
        ? Math.max(0, precioOriginal - discountedPrice)
        : 0;

      let newItems;
      if (existingItem) {
        newItems = state.items.map(item =>
          item.uniqueId === uniqueId
            ? { ...item, cantidad: item.cantidad + 1, importe: (item.cantidad + 1) * item.precio_final }
            : item
        );
      } else {
        newItems = [
          ...state.items,
          {
            uniqueId: uniqueId,
            producto_id: product._id || product.id,
            producto_nombre: product.nombre,
            precio_base: precioOriginal,
            precio_final: finalPrice,
            descuento: product.descuento || 0,
            cantidad: 1,
            importe: finalPrice,
            personalizaciones: customization || {},
            promoDescuento,
            promoAplicada: product.promoAplicada || null
          }
        ];
      }

      const totals = calculateTotals(newItems, state.promotions);

      return { ...state, items: newItems, ...totals };
    }


    case 'REMOVE_ITEM': {
      const { uniqueId } = action.payload;
      const newItems = state.items.filter(item => item.uniqueId !== uniqueId);
      const totals = calculateTotals(newItems, state.promotions);
      return { ...state, items: newItems, ...totals };
    }

    case 'UPDATE_QUANTITY': {
      const { uniqueId, cantidad } = action.payload;
      if (cantidad <= 0) {
        return orderReducer(state, { type: 'REMOVE_ITEM', payload: { uniqueId } });
      }
      const newItems = state.items.map(item =>
        item.uniqueId === uniqueId
          ? { ...item, cantidad, importe: cantidad * item.precio_final }
          : item
      );
      const totals = calculateTotals(newItems, state.promotions);
      return { ...state, items: newItems, ...totals };
    }

    case 'RECALC_TOTALS': {
      const totals = calculateTotals(state.items, state.promotions);
      return { ...state, ...totals };
    }

    case 'SET_CUSTOMER_NAME': {
      return {
        ...state,
        customerName: action.payload
      };
    }

    case 'UPDATE_ITEM': {
      const { uniqueId, customization } = action.payload;
      const item = state.items.find(item => item.uniqueId === uniqueId);
      if (!item) return state;

      // Recalcular precio con nuevas personalizaciones
      const customizationPrice = calculateCustomizationPrice(customization);
      const discountedPrice = calculatePriceWithDiscount(item.precio_base, item.descuento);
      const finalPrice = discountedPrice + customizationPrice;

      const newItems = state.items.map(item =>
        item.uniqueId === uniqueId
          ? {
              ...item,
              personalizaciones: customization,
              precio_final: finalPrice,
              importe: item.cantidad * finalPrice
            }
          : item
      );

      const totals = calculateTotals(newItems, state.promotions);
      return { ...state, items: newItems, ...totals };
    }

    case 'SET_PROMOTIONS': {
      // Recibir promociones del servidor y aplicarlas al estado
      const { promotions, productsMap } = action.payload;
      // Validar que promotions sea un array
      const validPromotions = Array.isArray(promotions) ? promotions : [];
      // Mapear productos para búsqueda rápida
      const mappedProducts = new Map();
      if (productsMap && productsMap.size) {
        productsMap.forEach((p, key) => mappedProducts.set(key.toString(), p));
      }

      return {
        ...state,
        promotions: validPromotions,
        productsMap: mappedProducts,
        // Recalcular: las promociones cambian el total
        ...calculateTotals(state.items, validPromotions)
      };
    }

    case 'SET_CUSTOMER_PHONE': {
      return {
        ...state,
        customerPhone: action.payload
      };
    }

    case 'SET_LOYALTY_CARD': {
      return {
        ...state,
        loyaltyCard: action.payload,
        loyaltyReward: action.payload ? state.loyaltyReward : null
      };
    }

    case 'SET_LOYALTY_REWARD': {
      return {
        ...state,
        loyaltyReward: action.payload || null
      };
    }

    case 'SET_LOYALTY_DISCOUNT': {
      return {
        ...state,
        loyaltyDiscount: action.payload
      };
    }

    case 'SET_LOYALTY_FREE_PRODUCT': {
      return {
        ...state,
        loyaltyFreeProduct: action.payload
      };
    }

    case 'CLEAR_ORDER':
      // Conservar las promociones cargadas (si no, el 2x1 deja de calcularse tras la 1a venta)
      return { ...initialState, promotions: state.promotions, productsMap: state.productsMap };

    default:
      return state;
  }
}

export function AdminOrderProvider({ children }) {
  const [state, dispatch] = useReducer(orderReducer, initialState);

  const addItem = (product, customization) => dispatch({ type: 'ADD_ITEM', payload: { product, customization } });
  const removeItem = (uniqueId) => dispatch({ type: 'REMOVE_ITEM', payload: { uniqueId } });
  const updateQuantity = (uniqueId, cantidad) => dispatch({ type: 'UPDATE_QUANTITY', payload: { uniqueId, cantidad } });
  const clearOrder = () => dispatch({ type: 'CLEAR_ORDER' });
  const recalcTotals = () => dispatch({ type: 'RECALC_TOTALS' });
  const setPromotions = (promotions, productsMap) => dispatch({ type: 'SET_PROMOTIONS', payload: { promotions, productsMap } });
  const setCustomerName = (name) => dispatch({ type: 'SET_CUSTOMER_NAME', payload: name });
  const updateItem = (uniqueId, customization) => dispatch({ type: 'UPDATE_ITEM', payload: { uniqueId, customization } });

  const setCustomerPhone = (phone) => dispatch({ type: 'SET_CUSTOMER_PHONE', payload: phone });
  const setLoyaltyCard = (card) => dispatch({ type: 'SET_LOYALTY_CARD', payload: card });
  const setLoyaltyReward = (reward) => dispatch({ type: 'SET_LOYALTY_REWARD', payload: reward });
  const setLoyaltyDiscount = (discount) => dispatch({ type: 'SET_LOYALTY_DISCOUNT', payload: discount });
  const setLoyaltyFreeProduct = (product) => dispatch({ type: 'SET_LOYALTY_FREE_PRODUCT', payload: product });

  // Función para buscar cliente por teléfono y cargar su tarjeta de lealtad
  const loadCustomerLoyalty = async (phone) => {
    if (!phone || phone.length < 10) return null;

    try {
      const customerResponse = await getCustomerByPhone(phone);
      if (customerResponse.success && customerResponse.data) {
        const customer = customerResponse.data;
        dispatch({ type: 'SET_CUSTOMER_NAME', payload: customer.nombre });
        dispatch({ type: 'SET_CUSTOMER_PHONE', payload: phone });

        // La tarjeta de lealtad ya viene populated en el customer
        if (customer.loyaltyCardId) {
          dispatch({ type: 'SET_LOYALTY_CARD', payload: customer.loyaltyCardId });
          return customer.loyaltyCardId;
        }
      }
    } catch (error) {
      console.error('Error loading customer loyalty:', error);
    }
    return null;
  };

  // Función para calcular descuento de lealtad basado en sellos
  const calculateLoyaltyDiscount = (card, config) => {
    if (!card || !config || !config.rewards) return { discount: 0, freeProduct: null };

    const currentStamps = card.sellos_actuales;
    
    // Buscar recompensa aplicable
    const applicableReward = config.rewards
      .filter(r => r.stamps <= currentStamps)
      .sort((a, b) => b.stamps - a.stamps)[0];

    if (applicableReward) {
      if (applicableReward.type === 'discount') {
        return { discount: applicableReward.value, freeProduct: null };
      } else if (applicableReward.type === 'free') {
        return { discount: 0, freeProduct: applicableReward };
      }
    }

    return { discount: 0, freeProduct: null };
  };

  // Recompensa de lealtad aplicada a esta orden: descuento REAL (el servidor cobra exactamente esto,
  // con la misma función computeRewardDiscount). Se aplica después de promociones y antes del IVA.
  const loyaltyCalc = state.loyaltyReward
    ? computeRewardDiscount(
        state.loyaltyReward,
        (state.items || []).map(i => ({
          producto_id: String(i.producto_id),
          precio: Number(i.precio_final) || 0,
          isCombo: !!(i.isCombo || i.personalizaciones?.isCombo)
        })),
        state.subtotal
      )
    : { amount: 0, reason: null };
  const loyaltyDiscountAmount = loyaltyCalc.amount || 0;
  const finalSubtotal = loyaltyDiscountAmount > 0 ? round2Loyalty(state.subtotal - loyaltyDiscountAmount) : state.subtotal;
  const finalImpuestos = loyaltyDiscountAmount > 0 ? round2Loyalty(finalSubtotal * getCartIVARate()) : state.impuestos;
  const finalTotal = loyaltyDiscountAmount > 0 ? round2Loyalty(finalSubtotal + finalImpuestos) : state.total;

  const value = {
    ...state,
    subtotal: finalSubtotal,
    impuestos: finalImpuestos,
    total: finalTotal,
    loyaltyDiscountAmount,
    loyaltyRewardNote: state.loyaltyReward ? loyaltyCalc.reason : null,
    setLoyaltyReward,
    addItem, 
    removeItem, 
    updateQuantity, 
    clearOrder, 
    recalcTotals, 
    setPromotions, 
    setCustomerName, 
    setCustomerPhone,
    setLoyaltyCard,
    setLoyaltyDiscount,
    setLoyaltyFreeProduct,
    loadCustomerLoyalty,
    calculateLoyaltyDiscount,
    updateItem 
  };

  return (
    <AdminOrderContext.Provider value={value}>
      {children}
    </AdminOrderContext.Provider>
  );
}

export function useAdminOrder() {
  const context = useContext(AdminOrderContext);
  if (!context) {
    throw new Error('useAdminOrder must be used within an AdminOrderProvider');
  }
  return context;
}

export function calculateCustomizationPrice(customization) {
  if (!customization) return 0;
  
  let total = 0;
  
  // Iterar sobre todas las claves de personalización
  Object.values(customization).forEach(selections => {
    if (Array.isArray(selections)) {
      selections.forEach(option => {
        total += option.price || 0;
      });
    } else if (selections && selections.price) {
      total += selections.price;
    }
  });
  
  return total;
}
