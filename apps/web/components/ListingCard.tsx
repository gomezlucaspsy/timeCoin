import Link from "next/link";
import type { Listing } from "@/lib/db/schema";
import { formatHours } from "@/lib/listings/format";

export default function ListingCard({ listing }: { listing: Listing }) {
  const showArs = listing.paymentMode !== "timecoin";
  const showHours = listing.paymentMode !== "cash";
  const cover = listing.images[0];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white transition-shadow hover:shadow-md dark:border-white/[.08] dark:bg-zinc-950"
    >
      <div className="aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Sin foto
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex flex-wrap gap-1.5">
          {showArs && listing.priceArs != null && (
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">
              ${listing.priceArs.toLocaleString("es-AR")}
            </span>
          )}
          {showHours && listing.priceHours != null && (
            <span className="rounded-full border border-foreground px-2.5 py-0.5 text-xs font-medium">
              {formatHours(listing.priceHours)} h
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-sm font-medium">{listing.title}</h3>
        <span className="mt-auto text-xs uppercase tracking-wide text-zinc-500">
          {listing.category}
        </span>
      </div>
    </Link>
  );
}
