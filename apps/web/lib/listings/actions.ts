"use server";

import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { listings } from "@/lib/db/schema";
import { LISTING_CATEGORIES } from "@/lib/listings/categories";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type CreateListingState = {
  error: string | null;
};

export async function createListing(
  _prevState: CreateListingState,
  formData: FormData,
): Promise<CreateListingState> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Tenés que iniciar sesión para publicar." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const paymentMode = String(formData.get("paymentMode") ?? "").trim();
  const priceArsRaw = String(formData.get("priceArs") ?? "").trim();
  const priceHoursRaw = String(formData.get("priceHours") ?? "").trim();
  const images = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (title.length < 3 || title.length > 120) {
    return { error: "El título debe tener entre 3 y 120 caracteres." };
  }
  if (description.length < 10 || description.length > 2000) {
    return { error: "La descripción debe tener entre 10 y 2000 caracteres." };
  }
  if (!LISTING_CATEGORIES.includes(category as (typeof LISTING_CATEGORIES)[number])) {
    return { error: "Elegí una categoría válida." };
  }
  if (paymentMode !== "cash" && paymentMode !== "timecoin" && paymentMode !== "both") {
    return { error: "Elegí una forma de pago válida." };
  }

  const priceArs = paymentMode !== "timecoin" ? Number(priceArsRaw) : null;
  const priceHours = paymentMode !== "cash" ? Number(priceHoursRaw) : null;

  if (paymentMode !== "timecoin" && (!priceArs || priceArs <= 0)) {
    return { error: "Ingresá un precio en pesos válido." };
  }
  if (paymentMode !== "cash" && (!priceHours || priceHours <= 0)) {
    return { error: "Ingresá un precio en horas TimeCoin válido." };
  }

  if (images.length === 0) {
    return { error: "Subí al menos una foto del artículo." };
  }
  if (images.length > MAX_IMAGES) {
    return { error: `Podés subir como máximo ${MAX_IMAGES} fotos.` };
  }
  for (const image of images) {
    if (!image.type.startsWith("image/")) {
      return { error: "Todos los archivos deben ser imágenes." };
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return { error: "Cada foto debe pesar menos de 5MB." };
    }
  }

  const uploaded = await Promise.all(
    images.map((image) =>
      put(`listings/${userId}/${crypto.randomUUID()}-${image.name}`, image, {
        access: "public",
        addRandomSuffix: false,
      }),
    ),
  );

  const db = getDb();
  const [listing] = await db
    .insert(listings)
    .values({
      sellerId: userId,
      title,
      description,
      category,
      paymentMode,
      priceArs: priceArs ?? null,
      priceHours: priceHours !== null ? priceHours.toFixed(2) : null,
      images: uploaded.map((blob) => blob.url),
    })
    .returning({ id: listings.id });

  redirect(`/listings/${listing.id}`);
}
