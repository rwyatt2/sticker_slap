import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// SEED DATA
// ============================================================================

const categories = [
  { name: 'Emojis', slug: 'emojis', description: 'Fun emoji stickers', icon: 'smile', sortOrder: 1 },
  { name: 'Animals', slug: 'animals', description: 'Cute animal stickers', icon: 'paw-print', sortOrder: 2 },
  { name: 'Food', slug: 'food', description: 'Delicious food stickers', icon: 'utensils', sortOrder: 3 },
  { name: 'Nature', slug: 'nature', description: 'Beautiful nature stickers', icon: 'leaf', sortOrder: 4 },
  { name: 'Decorations', slug: 'decorations', description: 'Decorative elements', icon: 'sparkles', sortOrder: 5 },
  { name: 'Text', slug: 'text', description: 'Text and typography stickers', icon: 'type', sortOrder: 6 },
  { name: 'Shapes', slug: 'shapes', description: 'Basic shapes and patterns', icon: 'shapes', sortOrder: 7 },
  { name: 'Seasonal', slug: 'seasonal', description: 'Holiday and seasonal stickers', icon: 'calendar', sortOrder: 8 },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Seeding database...\n');

  // --------------------------------------------------------------------------
  // Seed Categories
  // --------------------------------------------------------------------------
  console.log('📁 Seeding sticker categories...');
  for (const category of categories) {
    await prisma.stickerCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
      },
      create: category,
    });
  }
  console.log(`   ✓ Created ${categories.length} categories\n`);

  // --------------------------------------------------------------------------
  // Seed Admin User (Development Only)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    console.log('👤 Seeding development admin user...');
    const adminEmail = 'admin@example.com';
    const adminPassword = await hash('admin123', 12);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        name: 'Admin User',
        password: adminPassword,
        role: UserRole.ADMIN,
        emailVerified: new Date(),
      },
    });
    console.log(`   ✓ Admin user created: ${admin.email}\n`);

    // Create a sample project for the admin
    console.log('🎨 Seeding sample project...');
    const project = await prisma.project.upsert({
      where: { id: 'sample-project-001' },
      update: {},
      create: {
        id: 'sample-project-001',
        name: 'My First Canvas',
        description: 'A sample sticker canvas to get you started',
        userId: admin.id,
        width: 1920,
        height: 1080,
        isPublic: true,
        data: {
          version: 1,
          settings: {
            backgroundColor: '#ffffff',
            gridEnabled: false,
            snapToGrid: false,
          },
        },
      },
    });
    console.log(`   ✓ Sample project created: ${project.name}\n`);
  }

  console.log('✅ Database seeded successfully!');
}

// ============================================================================
// RUN SEED
// ============================================================================

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
