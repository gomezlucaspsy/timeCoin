"use client";

import { useActionState } from "react";
import { deleteListing, type DeleteListingState } from "@/lib/listings/actions";

const initialState: DeleteListingState = { error: null };

export default function DeleteListingButton({ listingId }: { listingId: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteListing.bind(null, listingId),
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm("¿Seguro que querés borrar este artículo? No se puede deshacer.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={isPending}
        className="flex h-10 items-center justify-center rounded-full border border-red-200 px-5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "Borrando..." : "Borrar"}
      </button>
      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
