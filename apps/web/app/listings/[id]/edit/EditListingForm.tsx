"use client";

import { useActionState, useState } from "react";
import type { Listing } from "@/lib/db/schema";
import { updateListing, type UpdateListingState } from "@/lib/listings/actions";
import { LISTING_CATEGORIES } from "@/lib/listings/categories";

const initialState: UpdateListingState = { error: null };

type PaymentMode = "cash" | "timecoin" | "both";

export default function EditListingForm({ listing }: { listing: Listing }) {
  const [state, formAction, isPending] = useActionState(
    updateListing.bind(null, listing.id),
    initialState,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(listing.paymentMode);
  const [keptImages, setKeptImages] = useState<string[]>(listing.images);
  const [previews, setPreviews] = useState<string[]>([]);

  function toggleKeptImage(url: string) {
    setKeptImages((current) =>
      current.includes(url) ? current.filter((entry) => entry !== url) : [...current, url],
    );
  }

  function handleImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Título
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={listing.title}
          className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          defaultValue={listing.description}
          className="resize-y rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue={listing.category}
          className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        >
          {LISTING_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Forma de pago</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "cash", label: "Solo pesos" },
              { value: "timecoin", label: "Solo horas TimeCoin" },
              { value: "both", label: "Pesos u horas" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${
                paymentMode === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              }`}
            >
              <input
                type="radio"
                name="paymentMode"
                value={option.value}
                checked={paymentMode === option.value}
                onChange={() => setPaymentMode(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {paymentMode !== "timecoin" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="priceArs" className="text-sm font-medium">
              Precio en pesos (ARS)
            </label>
            <input
              id="priceArs"
              name="priceArs"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={listing.priceArs ?? undefined}
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
            />
          </div>
        )}
        {paymentMode !== "cash" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="priceHours" className="text-sm font-medium">
              Precio en horas TimeCoin
            </label>
            <input
              id="priceHours"
              name="priceHours"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              required
              defaultValue={listing.priceHours ?? undefined}
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Fotos actuales</span>
        {listing.images.length === 0 ? (
          <p className="text-xs text-zinc-500">Este artículo no tiene fotos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {listing.images.map((src) => {
              const kept = keptImages.includes(src);
              return (
                <label key={src} className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    name="keepImages"
                    value={src}
                    checked={kept}
                    onChange={() => toggleKeptImage(src)}
                    className="peer sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className={`aspect-square w-full rounded-lg object-cover transition-opacity ${
                      kept ? "opacity-100" : "opacity-30"
                    }`}
                  />
                  <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    {kept ? "Se mantiene" : "Se borra"}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="images" className="text-sm font-medium">
          Agregar fotos nuevas (hasta {6 - keptImages.length} más, 5MB cada una)
        </label>
        <input
          id="images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImagesChange}
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
        />
        {previews.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`Vista previa ${i + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
