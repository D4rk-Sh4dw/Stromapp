import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

declare global {
    var prisma: PrismaClient | undefined;
}

const initPrisma = () => {
    // Create libSQL client for local SQLite file
    const libsql = createClient({
        url: 'file:./dev.db'
    });

    // Create Prisma adapter - pass the config, not the client
    const adapter = new PrismaLibSql({
        url: 'file:./dev.db'
    });

    // Initialize PrismaClient with adapter
    return new PrismaClient({
        adapter,
        log: ['query', 'error', 'warn'],
    });
};

export const prisma = globalThis.prisma || initPrisma();

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

// Force reload schema
