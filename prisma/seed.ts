import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();

const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || 'file:./dev.db'
});
const prisma = new PrismaClient({ adapter });

async function main() {
    const passwordHash = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@strom.de' },
        update: {},
        create: {
            email: 'admin@strom.de',
            passwordHash: passwordHash,
            role: 'ADMIN',
            twoFactorEnabled: false,
        },
    });

    console.log('Seed completed: Admin user created');
    console.log('Email: admin@strom.de');
    console.log('Password: admin123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
