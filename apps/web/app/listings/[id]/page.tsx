import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import NavTabs from "@/components/NavTabs";
import DeleteListingButton from "@/components/DeleteListingButton";
import { getListingById } from "@/lib/listings/queries";
import { formatHours } from "@/lib/listings/format";

export default async function ListingPage(
  props: PageProps<"/listings/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { userId } = await auth();
  const listing = await getListingById(id);
  if (!listing) notFound();

  const justCreated = searchParams?.created === "1";
  const justUpdated = searchParams?.updated === "1";
  const isOwner = userId === listing.sellerId;
  const showArs = listing.paymentMode !== "timecoin";
  const showHours = listing.paymentMode !== "cash";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {justCreated && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            ¡Tu artículo ya está publicado!
          </p>
        )}
        {justUpdated && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Los cambios se guardaron.
          </p>
        )}

        {listing.images.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {listing.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={listing.title}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {listing.category}
        </span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {listing.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-3">
          {showArs && listing.priceArs != null && (
            <span className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background">
              ${listing.priceArs.toLocaleString("es-AR")}
            </span>
          )}
          {showHours && listing.priceHours != null && (
            <span className="rounded-full border border-foreground px-4 py-1.5 text-sm font-medium">
              {formatHours(listing.priceHours)} h TimeCoin
            </span>
          )}
        </div>

        <p className="mt-6 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {listing.description}
        </p>

        {isOwner ? (
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={`/listings/${listing.id}/edit`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Editar artículo
            </Link>
            <DeleteListingButton listingId={listing.id} />
          </div>
        ) : (
          <Link
            href="/sell"
            className="mt-10 inline-flex h-11 items-center justify-center rounded-full border border-black/[.08] px-6 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Publicar otro artículo
          </Link>
        )}
      </main>
    </div>
  );
}
