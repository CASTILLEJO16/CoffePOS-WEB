/**
 * Módulos del sistema: UNA sola lista para el menú de escritorio y el de celular/tablet.
 * Antes cada menú tenía su propia lista y el móvil se quedaba sin los módulos nuevos.
 * Al agregar un módulo, agrégalo aquí y aparece en ambos.
 *
 * mobilePrimary: se muestra directo en la barra inferior del celular;
 *                los demás quedan en "Más".
 * short:         nombre corto para la barra del celular.
 */
import {
  ShoppingCart, Package, Settings, Users, DollarSign, Wallet,
  BarChart3, Flame, QrCode, Table, SlidersHorizontal, Warehouse
} from 'lucide-react';

export const ADMIN_MENU = [
  { path: '/admin/pos',               icon: ShoppingCart,      label: 'Punto de Venta',   short: 'POS',       mobilePrimary: true },
  { path: '/admin',                   icon: Package,           label: 'Productos',        short: 'Productos', mobilePrimary: true, exact: true },
  { path: '/admin/personalizaciones', icon: SlidersHorizontal, label: 'Personalizaciones', short: 'Personaliz.' },
  { path: '/admin/promociones',       icon: Flame,             label: 'Promociones',      short: 'Promos' },
  { path: '/admin/usuarios',          icon: Users,             label: 'Usuarios',         short: 'Usuarios' },
  { path: '/admin/ventas',            icon: DollarSign,        label: 'Ventas',           short: 'Ventas',    mobilePrimary: true },
  { path: '/admin/kpis',              icon: BarChart3,         label: 'KPIs de Ventas',   short: 'KPIs' },
  { path: '/admin/almacen',           icon: Warehouse,         label: 'Almacén',          short: 'Almacén',   stockBadge: true },
  { path: '/admin/cortes-caja',       icon: Wallet,            label: 'Cortes de Caja',   short: 'Cortes' },
  { path: '/admin/lealtad',           icon: QrCode,            label: 'Tarjeta Lealtad',  short: 'Lealtad',   mobilePrimary: true },
  { path: '/admin/tickets-abiertos',  icon: Table,             label: 'Tickets Abiertos', short: 'Tickets' },
  { path: '/admin/configuracion',     icon: Settings,          label: 'Configuración',    short: 'Config' },
];

export const SELLER_MENU = [
  { path: '/',                 icon: ShoppingCart, label: 'Punto de Venta',   short: 'POS',     mobilePrimary: true, exact: true },
  { path: '/ventas',           icon: BarChart3,    label: 'Mis Ventas',       short: 'Ventas',  mobilePrimary: true },
  { path: '/lealtad',          icon: QrCode,       label: 'Tarjeta Lealtad',  short: 'Lealtad', mobilePrimary: true },
  { path: '/tickets-abiertos', icon: Table,        label: 'Tickets Abiertos', short: 'Tickets' },
  { path: '/almacen',          icon: Warehouse,    label: 'Almacén',          short: 'Almacén', stockBadge: true },
];

/** ¿La ruta actual corresponde a este módulo? */
export function isMenuItemActive(item, pathname) {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(item.path + '/');
}
