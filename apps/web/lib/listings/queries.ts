import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listings } from "@/lib/db/schema";

export async function getListingById(id: string) {
  const db = getDb();
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return listing ?? null;
}
