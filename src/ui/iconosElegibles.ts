import {
  Baby,
  Beer,
  BookOpen,
  Briefcase,
  Car,
  Cat,
  Coffee,
  CreditCard,
  Dog,
  Droplets,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  House,
  Luggage,
  Music,
  PiggyBank,
  Pill,
  Plane,
  Shirt,
  Smartphone,
  Stethoscope,
  Tag,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Los íconos que se pueden elegir para una categoría propia (Ajustes → Categorías). En la planilla
 * se guarda la clave ("perro"), no el dibujo: si un día cambia el ícono, la categoría no se rompe.
 * Una clave que no está acá se dibuja como etiqueta.
 */
export const ICONOS_ELEGIBLES: Record<string, LucideIcon> = {
  etiqueta: Tag,
  casa: House,
  auto: Car,
  nafta: Fuel,
  luz: Zap,
  agua: Droplets,
  internet: Wifi,
  celular: Smartphone,
  herramientas: Wrench,
  ropa: Shirt,
  salud: Stethoscope,
  farmacia: Pill,
  bebe: Baby,
  escuela: GraduationCap,
  libros: BookOpen,
  perro: Dog,
  gato: Cat,
  cafe: Coffee,
  salidas: Beer,
  deporte: Dumbbell,
  musica: Music,
  juegos: Gamepad2,
  regalos: Gift,
  viajes: Plane,
  vacaciones: Luggage,
  trabajo: Briefcase,
  ahorro: PiggyBank,
  tarjeta: CreditCard,
}

export const CLAVES_DE_ICONOS = Object.keys(ICONOS_ELEGIBLES)

/** Cómo se lee cada clave (para el lector de pantalla): con sus acentos. */
const CON_ACENTO: Record<string, string> = {
  bebe: 'bebé',
  cafe: 'café',
  musica: 'música',
}
export const nombreDelIcono = (clave: string) => CON_ACENTO[clave] ?? clave
