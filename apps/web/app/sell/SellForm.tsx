"use client";

import { useActionState, useState } from "react";
import { createListing, type CreateListingState } from "@/lib/listings/actions";
import { LISTING_CATEGORIES } from "@/lib/listings/categories";

const initialState: CreateListingState = { error: null };

type PaymentMode = "cash" | "timecoin" | "both";

export default function SellForm() {
  const [state, formAction, isPending] = useActionState(
    createListing,
    initialState,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [previews, setPreviews] = useState<string[]>([]);

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
          placeholder="Ej: Bicicleta rodado 26 en buen estado"
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
          placeholder="Contá el estado, detalles y por qué lo vendés"
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
          defaultValue=""
          className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        >
          <option value="" disabled>
            Elegí una categoría
          </option>
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
              placeholder="15000"
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
              min={0.00000001}
              step={0.00000001}
              required
              placeholder="3"
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Podés usar fracciones muy chicas (como los satoshis en
              Bitcoin), no hace falta redondear a medias horas.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="images" className="text-sm font-medium">
          Fotos (hasta 6, 5MB cada una)
        </label>
        <input
          id="images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          required
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
        {isPending ? "Publicando..." : "Publicar artículo"}
      </button>
    </form>
  );
}
