
import prisma from "./backend/lib/prisma";

async function main() {
    const id = "d275d25a-80a6-4e12-ae24-7e8467846f22";
    console.log("Checking receipt:", id);

    const receipt = await prisma.receipt.findUnique({
        where: { id },
        include: {
            sale: {
                select: { storeId: true, id: true }
            }
        }
    });

    console.log("Receipt found:", receipt);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
