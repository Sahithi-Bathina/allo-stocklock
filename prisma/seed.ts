import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing data...');
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('Seeding warehouses...');
  const whMumbai = await prisma.warehouse.create({
    data: { name: 'Mumbai Hub', location: 'Maharashtra' },
  });
  const whBangalore = await prisma.warehouse.create({
    data: { name: 'Bangalore Fulfillment Center', location: 'Karnataka' },
  });

  console.log('Seeding products...');
  const productA = await prisma.product.create({
    data: {
      name: 'Allo Smart Watch Series 1',
      description: 'High performance fitness and productivity tracker.',
    },
  });

  const productB = await prisma.product.create({
    data: {
      name: 'Allo Wireless Earbuds Pro',
      description: 'Active noise-cancelling premium audio setup.',
    },
  });

  console.log('Seeding inventory stock allocations...');
  // Mumbai Inventory
  await prisma.inventory.createMany({
    data: [
      { productId: productA.id, warehouseId: whMumbai.id, totalUnits: 10, reservedUnits: 0 },
      { productId: productB.id, warehouseId: whMumbai.id, totalUnits: 5, reservedUnits: 0 },
    ],
  });

  // Bangalore Inventory
  await prisma.inventory.createMany({
    data: [
      { productId: productA.id, warehouseId: whBangalore.id, totalUnits: 3, reservedUnits: 0 },
      { productId: productB.id, warehouseId: whBangalore.id, totalUnits: 15, reservedUnits: 0 },
    ],
  });

  console.log('Database seeding completed successfully! 🌱');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });