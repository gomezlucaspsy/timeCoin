import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import NavTabs from "@/components/NavTabs";
import DeleteListingButton from "@/components/DeleteListingButton";
import { formatHours } from "@/lib/listings/format";
import { getListingsBySeller } from "@/lib/listings/queries";

export const metadata = {
  title: "Mis artículos — TimeCoin",
};

export default async function MyListingsPage(
  props: PageProps<"/listings/mine">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const searchParams = await props.searchParams;
  const justDeleted = searchParams?.deleted === "1";
  const listings = await getListingsBySeller(userId);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {justDeleted && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            El artículo fue borrado.
          </p>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Mis artículos
          </h1>
          <Link
            href="/sell"
            className="hidden h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] sm:flex dark:hover:bg-[#ccc]"
          >
            Publicar un artículo
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/[.08] py-24 text-center dark:border-white/[.145]">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Todavía no publicaste ningún artículo.
            </p>
            <Link
              href="/sell"
              className="text-sm font-medium underline underline-offset-4"
            >
              Publicá el primero
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((listing) => {
              const showArs = listing.paymentMode !== "timecoin";
              const showHours = listing.paymentMode !== "cash";
              const cover = listing.images[0];
              return (
                <li
                  key={listing.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-3 sm:flex-row sm:items-center dark:border-white/[.08] dark:bg-zinc-950"
                >
                  <Link
                    href={`/listings/${listing.id}`}
                    className="flex flex-1 items-center gap-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-medium">{listing.title}</h3>
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
                        <span className="rounded-full border border-black/[.08] px-2.5 py-0.5 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.145]">
                          {listing.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex h-10 items-center justify-center rounded-full border border-black/[.08] px-5 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                    >
                      Editar
                    </Link>
                    <DeleteListingButton listingId={listing.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
