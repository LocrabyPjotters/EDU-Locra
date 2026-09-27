const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.orgSettings.updateMany({
    data: { licenseTier: 'enterprise', enableWatermark: true }
  });
  console.log("Updated licenseTier to enterprise");
}
main().finally(() => prisma.$disconnect());
