import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import NavTabs from "@/components/NavTabs";
import ListingCard from "@/components/ListingCard";
import { getActiveListings } from "@/lib/listings/queries";

export const metadata = {
  title: "Explorar — TimeCoin",
};

export default async function ListingsPage() {
  const listings = await getActiveListings();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.08]">
                Ingresar
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]">
                Crear cuenta
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Artículos publicados
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
              Todavía no hay artículos publicados.
            </p>
            <Link
              href="/sell"
              className="text-sm font-medium underline underline-offset-4"
            >
              Sé el primero en publicar uno
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
