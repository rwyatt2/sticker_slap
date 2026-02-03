import { Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// PRISMA CLIENT SETUP WITH EXTENSIONS
// ============================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

/**
 * Create base Prisma client with logging configuration
 */
function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

/**
 * Extended Prisma client with soft delete and audit logging support
 */
function createExtendedClient() {
  const prisma = createPrismaClient();

  return prisma.$extends({
    name: 'softDelete',
    query: {
      // ========================================================================
      // STICKER SOFT DELETE EXTENSIONS
      // ========================================================================
      sticker: {
        async findMany({ args, query }) {
          // Exclude soft-deleted by default unless explicitly requested
          if (args.where?.isDeleted === undefined) {
            args.where = { ...args.where, isDeleted: false };
          }
          return query(args);
        },
        async findFirst({ args, query }) {
          if (args.where?.isDeleted === undefined) {
            args.where = { ...args.where, isDeleted: false };
          }
          return query(args);
        },
        async findUnique({ args, query }) {
          // For findUnique, we need to use findFirst with soft delete filter
          // But we preserve the behavior for explicit isDeleted queries
          return query(args);
        },
        async delete({ args, query }) {
          // Convert hard delete to soft delete
          return prisma.sticker.update({
            where: args.where,
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        },
        async deleteMany({ args }) {
          // Convert hard deleteMany to soft delete
          return prisma.sticker.updateMany({
            where: args.where,
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        },
      },

      // ========================================================================
      // STICKER PLACEMENT SOFT DELETE EXTENSIONS
      // ========================================================================
      stickerPlacement: {
        async findMany({ args, query }) {
          if (args.where?.isDeleted === undefined) {
            args.where = { ...args.where, isDeleted: false };
          }
          return query(args);
        },
        async findFirst({ args, query }) {
          if (args.where?.isDeleted === undefined) {
            args.where = { ...args.where, isDeleted: false };
          }
          return query(args);
        },
        async delete({ args, query }) {
          return prisma.stickerPlacement.update({
            where: args.where,
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        },
        async deleteMany({ args }) {
          return prisma.stickerPlacement.updateMany({
            where: args.where,
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        },
      },
    },

    model: {
      // ========================================================================
      // STICKER MODEL EXTENSIONS
      // ========================================================================
      sticker: {
        /**
         * Find sticker including soft-deleted ones
         */
        async findWithDeleted(
          this: Prisma.StickerDelegate,
          args: Prisma.StickerFindManyArgs
        ) {
          return prisma.sticker.findMany({
            ...args,
            where: { ...args.where },
          });
        },

        /**
         * Hard delete a sticker (permanent)
         */
        async hardDelete(
          this: Prisma.StickerDelegate,
          where: Prisma.StickerWhereUniqueInput
        ) {
          return prisma.$executeRaw`
            DELETE FROM stickers WHERE id = ${where.id}
          `;
        },

        /**
         * Restore a soft-deleted sticker
         */
        async restore(
          this: Prisma.StickerDelegate,
          where: Prisma.StickerWhereUniqueInput
        ) {
          return prisma.sticker.update({
            where,
            data: {
              isDeleted: false,
              deletedAt: null,
            },
          });
        },

        /**
         * Permanently delete stickers that have been soft-deleted for X days
         */
        async purgeDeleted(this: Prisma.StickerDelegate, daysOld: number = 30) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - daysOld);

          return prisma.$executeRaw`
            DELETE FROM stickers 
            WHERE is_deleted = true 
            AND deleted_at < ${cutoffDate}
          `;
        },
      },

      // ========================================================================
      // STICKER PLACEMENT MODEL EXTENSIONS
      // ========================================================================
      stickerPlacement: {
        /**
         * Find placements including soft-deleted ones
         */
        async findWithDeleted(
          this: Prisma.StickerPlacementDelegate,
          args: Prisma.StickerPlacementFindManyArgs
        ) {
          return prisma.stickerPlacement.findMany({
            ...args,
            where: { ...args.where },
          });
        },

        /**
         * Restore a soft-deleted placement
         */
        async restore(
          this: Prisma.StickerPlacementDelegate,
          where: Prisma.StickerPlacementWhereUniqueInput
        ) {
          return prisma.stickerPlacement.update({
            where,
            data: {
              isDeleted: false,
              deletedAt: null,
            },
          });
        },

        /**
         * Get placements within a viewport (spatial query)
         */
        async findInViewport(
          this: Prisma.StickerPlacementDelegate,
          projectId: string,
          viewport: {
            x: number;
            y: number;
            width: number;
            height: number;
          }
        ) {
          const { x, y, width, height } = viewport;
          return prisma.stickerPlacement.findMany({
            where: {
              projectId,
              isDeleted: false,
              positionX: { gte: x - 500, lte: x + width + 500 }, // Add buffer
              positionY: { gte: y - 500, lte: y + height + 500 },
            },
            orderBy: { zIndex: 'asc' },
            include: { sticker: true },
          });
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

export const db = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// ============================================================================
// AUDIT LOGGING UTILITIES
// ============================================================================

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE',
  entityType: string,
  entityId: string,
  context: AuditContext,
  oldData?: unknown,
  newData?: unknown
) {
  // Use raw client to avoid extension interference
  const prisma = createPrismaClient();
  try {
    await prisma.auditLog.create({
      data: {
        userId: context.userId,
        action,
        entityType,
        entityId,
        oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// ROW-LEVEL SECURITY HELPERS
// ============================================================================

/**
 * Build a where clause that enforces user ownership
 * Use this for queries that should only return the user's own data
 */
export function withOwnership<T extends { userId?: string }>(
  where: T,
  userId: string
): T & { userId: string } {
  return { ...where, userId };
}

/**
 * Build a where clause for public or owned resources
 */
export function withPublicOrOwnership<T extends { userId?: string; isPublic?: boolean }>(
  where: T,
  userId?: string
): T {
  if (userId) {
    return {
      ...where,
      OR: [{ userId }, { isPublic: true }],
    } as T;
  }
  return { ...where, isPublic: true };
}

/**
 * Check if a user can access a resource
 */
export function canAccess(
  resource: { userId?: string | null; isPublic?: boolean },
  userId?: string,
  requireOwnership = false
): boolean {
  if (requireOwnership) {
    return resource.userId === userId;
  }
  return resource.isPublic === true || resource.userId === userId;
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Execute operations in a transaction with automatic retry on conflict
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  const prisma = createPrismaClient();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });
    } catch (error) {
      lastError = error as Error;
      // Only retry on serialization failures
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  throw lastError;
}
