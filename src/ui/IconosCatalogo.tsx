import {
  BadgeDollarSign,
  CalendarPlus,
  ChevronDown,
  Banknote,
  Briefcase,
  Car,
  CircleCheck,
  Clock,
  Coins,
  CreditCard,
  Download,
  Ellipsis,
  EllipsisVertical,
  Eye,
  EyeOff,
  Gift,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  MonitorSmartphone,
  Moon,
  Package,
  PiggyBank,
  RotateCcw,
  Scissors,
  Search,
  Share,
  Shirt,
  SlidersHorizontal,
  ShoppingCart,
  Smartphone,
  Sparkles,
  SquarePlus,
  Sun,
  Tag,
  Ticket,
  TriangleAlert,
  Tv,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { MedioPago } from '../domain/tipos.ts'
import { ICONOS_ELEGIBLES } from './iconosElegibles.ts'

/*
 * Íconos de categorías, medios de pago y avisos, del mismo trazo que los del menú (Iconos.tsx).
 * Reemplazan a los emojis, que hacían ver la app infantil (pedido del usuario, 2026-10-16).
 * Son de Lucide (lucide.dev, licencia ISC; ver public/licencias.txt): al build entran solo los
 * que se importan acá.
 */

interface Props {
  className?: string
}

// Por id de categoría. El emoji de `catalogo.ts` queda solo para la pestaña Categorias de la
// planilla; una categoría que no está acá (borrada o nueva) lleva una etiqueta.
const POR_CATEGORIA: Record<string, LucideIcon> = {
  super: ShoppingCart,
  comida: Utensils,
  casa: House,
  servicios: Lightbulb,
  transporte: Car,
  salud: HeartPulse,
  ropa: Shirt,
  suscripciones: Tv,
  ocio: Ticket,
  regalos: Gift,
  cuidado: Scissors,
  otros: Package,
  sueldo: Briefcase,
  aguinaldo: BadgeDollarSign,
  extras: Coins,
  reintegros: RotateCcw,
  otros_ingresos: Wallet,
}

const POR_MEDIO: Record<MedioPago, LucideIcon> = {
  efectivo: Banknote,
  debito: CreditCard,
  credito: CreditCard,
  transferencia: Landmark,
  mercadopago: Smartphone,
}

function dibujar(Icono: LucideIcon, className = 'size-5') {
  return <Icono className={className} strokeWidth={2} aria-hidden="true" />
}

/**
 * El de una categoría: por id las de fábrica; las propias, por la clave que eligió la familia
 * (iconosElegibles.ts). Si no hay ninguno, una etiqueta.
 */
export const IconoCategoria = (p: Props & { id: string; icono?: string }) =>
  dibujar(
    POR_CATEGORIA[p.id] ?? (p.icono ? ICONOS_ELEGIBLES[p.icono] : undefined) ?? Tag,
    p.className,
  )
/** Uno de los que se pueden elegir para una categoría propia. */
export const IconoElegible = (p: Props & { clave: string }) =>
  dibujar(ICONOS_ELEGIBLES[p.clave] ?? Tag, p.className)
export const IconoMedio = (p: Props & { id: MedioPago }) =>
  dibujar(POR_MEDIO[p.id] ?? Wallet, p.className)
export const IconoTarjeta = (p: Props) => dibujar(CreditCard, p.className)
/** Lo que todavía no llegó a la planilla. */
export const IconoPendiente = (p: Props) => dibujar(Clock, p.className)
export const IconoAlerta = (p: Props) => dibujar(TriangleAlert, p.className)
export const IconoListo = (p: Props) => dibujar(CircleCheck, p.className)
/** La sugerencia del texto rápido. */
export const IconoSugerencia = (p: Props) => dibujar(Sparkles, p.className)
export const IconoMas = (p: Props) => dibujar(Ellipsis, p.className)
/** Lo que abre una lista para elegir (en vez de la flechita ▾ de texto). */
export const IconoDesplegar = (p: Props) => dibujar(ChevronDown, p.className)
/** Agregar un recordatorio al calendario del teléfono. */
export const IconoCalendario = (p: Props) => dibujar(CalendarPlus, p.className)
/** Lista: buscar y filtrar. */
export const IconoBuscar = (p: Props) => dibujar(Search, p.className)
export const IconoFiltros = (p: Props) => dibujar(SlidersHorizontal, p.className)
/** Una categoría escondida (y volver a mostrarla). */
export const IconoEscondida = (p: Props) => dibujar(EyeOff, p.className)
export const IconoVisible = (p: Props) => dibujar(Eye, p.className)
/** Una etiqueta ("Vacaciones 2027"). */
export const IconoEtiqueta = (p: Props) => dibujar(Tag, p.className)
/** Una meta de ahorro ("Vacaciones"). */
export const IconoMeta = (p: Props) => dibujar(PiggyBank, p.className)
/** Un ahorro ("Dólares en casa"). */
export const IconoAhorro = (p: Props) => dibujar(HandCoins, p.className)
/** Ajustes → Tema. */
export const IconoClaro = (p: Props) => dibujar(Sun, p.className)
export const IconoOscuro = (p: Props) => dibujar(Moon, p.className)
export const IconoComoElTelefono = (p: Props) => dibujar(MonitorSmartphone, p.className)
/** Instalar la app en el teléfono, y los íconos que se ven al hacerlo (Compartir del iPhone,
 * "Agregar a inicio" y el menú del navegador en Android). */
export const IconoInstalar = (p: Props) => dibujar(Download, p.className)
export const IconoCompartirIphone = (p: Props) => dibujar(Share, p.className)
export const IconoAgregarAInicio = (p: Props) => dibujar(SquarePlus, p.className)
export const IconoMenuDelNavegador = (p: Props) => dibujar(EllipsisVertical, p.className)
