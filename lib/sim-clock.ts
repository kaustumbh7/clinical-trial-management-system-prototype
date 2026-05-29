import { prisma } from "./db";

export async function getSimNow(): Promise<Date> {
  const clock = await prisma.simClock.findUnique({ where: { id: "singleton" } });
  return clock?.currentDate ?? new Date();
}
