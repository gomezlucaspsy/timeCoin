export const LISTING_CATEGORIES = [
  "Electrónica",
  "Hogar",
  "Ropa y accesorios",
  "Deportes",
  "Muebles",
  "Servicios",
  "Vehículos",
  "Otros",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
