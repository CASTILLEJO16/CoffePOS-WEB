import { createContext, useContext, useReducer } from 'react';

/**
 * Contexto de Orden exclusivo para el Admin.
 * Completamente aislado del OrderContext del vendedor.
 */
const AdminOrderContext = createContext();

function getIVARate() {
  const val = localStorage.getItem('iva_rate');
  const num = val ? parseFloat(val) : 0.16;
  return Number.isFinite(num) ? num : 0.16;
}

function calculateTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + item.importe, 0);
  const ivaRate = getIVARate();
  const impuestos = subtotal * ivaRate;
  const total = subtotal + impuestos;
  return { subtotal, impuestos, total };
}

function calculatePriceWithDiscount(precio, descuento) {
  if (!descuento || descuento <= 0) return precio;
  return precio * (1 - descuento / 100);
}

function calculatePromotionDiscount(item, promotions, productsMap) {
  // Verificar si el producto tiene una promoción activa aplicada
  const promo = promotions.find(p => 
    p.promocion_tipo === 'BUY_X_PAY_Y' &&
    p.freeItems && 
    p.freeItems.some(fi => fi.producto_id.toString() === item.producto_id.toString())
  );
  
  if (!promo) return { precioFinal: calculatePriceWithDiscount(item.precio_base, item.descuento), descuento: 0 };
  
  // Encontrar el item gratuito correspondiente
  const freeItem = promo.freeItems.find(fi => fi.producto_id.toString() === item.producto_id.toString());
  if (!freeItem) return { precioFinal: calculatePriceWithDiscount(item.precio_base, item.descuento), descuento: 0 };
  
  // El precio final es el precio con descuento del producto base
  // El descuento es el precio del item gratuito
  const discountedBase = calculatePriceWithDiscount(item.precio_base, item.descuento || 0);
  const freePrice = freeItem.precio_unitario; // Precio original del gratis
  
  return {
    precioFinal: discountedBase, // Se cobra solo el base, el gratis se descuenta en el total
    descuento: freePrice
  };
}

const initialState = {
  items: [],
  subtotal: 0,
  impuestos: 0,
  total: 0,
  customerName: '',
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

        const { subtotal, impuestos, total } = calculateTotals(newItems);
        return { ...state, items: newItems, subtotal, impuestos, total };
      }

      // Producto normal
      // Calcular precio con descuento
      const discountedPrice = calculatePriceWithDiscount(product.precio, product.descuento);

      // Calcular descuento de promoción
      const promoDiscount = calculatePromotionDiscount(
        { producto_id: product._id, producto_nombre: product.nombre, precio_base: product.precio },
        state.promotions || [],
        state.productsMap || new Map()
      );

      // Calcular precio adicional por personalizaciones
      const customizationPrice = calculateCustomizationPrice(customization);
      const finalPrice = discountedPrice + customizationPrice;

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
            descuento: promoDiscount.descuento,
            cantidad: 1,
            importe: finalPrice,
            personalizaciones: customization || {},
            promoDescuento: promoDiscount.descuento
          }
        ];
      }

      const { subtotal, impuestos, total } = calculateTotals(newItems);

      return { ...state, items: newItems, subtotal, impuestos, total };
    }

    case 'REMOVE_ITEM': {
      const { uniqueId } = action.payload;
      const newItems = state.items.filter(item => item.uniqueId !== uniqueId);
      const { subtotal, impuestos, total } = calculateTotals(newItems);
      return { ...state, items: newItems, subtotal, impuestos, total };
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
      const { subtotal, impuestos, total } = calculateTotals(newItems);
      return { ...state, items: newItems, subtotal, impuestos, total };
    }

    case 'RECALC_TOTALS': {
      const { subtotal, impuestos, total } = calculateTotals(state.items);
      return { ...state, subtotal, impuestos, total };
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

      const { subtotal, impuestos, total } = calculateTotals(newItems);
      return { ...state, items: newItems, subtotal, impuestos, total };
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
        productsMap: mappedProducts
      };
    }

    case 'CLEAR_ORDER':
      return initialState;

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

  const value = { ...state, addItem, removeItem, updateQuantity, clearOrder, recalcTotals, setPromotions, setCustomerName, updateItem };

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

function calculateCustomizationPrice(customization) {
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
