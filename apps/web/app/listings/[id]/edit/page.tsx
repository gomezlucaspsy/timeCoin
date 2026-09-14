import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import NavTabs from "@/components/NavTabs";
import { getListingById } from "@/lib/listings/queries";
import EditListingForm from "./EditListingForm";

export const metadata = {
  title: "Editar artículo — TimeCoin",
};

export default async function EditListingPage(
  props: PageProps<"/listings/[id]/edit">,
) {
  const { id } = await props.params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const listing = await getListingById(id);
  if (!listing) notFound();
  if (listing.sellerId !== userId) redirect(`/listings/${id}`);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          Editá tu artículo
        </h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          Actualizá los datos, cambiá las fotos o el precio.
        </p>
        <EditListingForm listing={listing} />
      </main>
    </div>
  );
}
