// Formatea un priceHours numeric (string, hasta 8 decimales) para mostrar,
// sin notación científica y sin ceros de más (evita el "1e-8" de Number()).
export function formatHours(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}
