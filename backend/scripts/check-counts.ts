
import prisma from "../lib/prisma";

async function main() {
  const users = await prisma.user.count();
  const stores = await prisma.store.count();
  const medicines = await prisma.medicine.count();
  const batches = await prisma.inventoryBatch.count();
  const sales = await prisma.sale.count();
  const items = await prisma.saleItem.count();
  const suppliers = await prisma.supplier.count();
  const supplierRequests = await prisma.supplierRequest.count();

  console.log("--- Database Counts ---");
  console.log(`Users: ${users}`);
  console.log(`Stores: ${stores}`);
  console.log(`Medicines: ${medicines}`);
  console.log(`Inventory Batches: ${batches}`);
  console.log(`Sales: ${sales}`);
  console.log(`Sale Items: ${items}`);
  console.log(`Suppliers: ${suppliers}`);
  console.log(`Supplier Requests: ${supplierRequests}`);
  console.log("-----------------------");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
