import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('admin', 10);
    console.log('[SEED] Generated password hash:', passwordHash);

    // Verify the hash works
    const testCompare = await bcrypt.compare('admin', passwordHash);
    console.log('[SEED] Hash verification test:', testCompare ? 'PASS' : 'FAIL');

    const admin = await prisma.user.upsert({
        where: { email: 'admin@strom.de' },
        update: {
            passwordHash: passwordHash,
        },
        create: {
            email: 'admin@strom.de',
            passwordHash: passwordHash,
            role: 'ADMIN',
            twoFactorEnabled: false,
        },
    });

    console.log('[SEED] ✅ Admin user upserted successfully');
    console.log('[SEED] User ID:', admin.id);
    console.log('[SEED] Email:', admin.email);
    console.log('[SEED] Role:', admin.role);
    console.log('[SEED] 2FA Enabled:', admin.twoFactorEnabled);
    console.log('[SEED] Password hash in DB:', admin.passwordHash);
    console.log('');
    console.log('='.repeat(50));
    console.log('Login credentials:');
    console.log('  Email: admin@strom.de');
    console.log('  Password: admin');
    console.log('='.repeat(50));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
