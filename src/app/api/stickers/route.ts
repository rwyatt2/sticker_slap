import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { withRateLimit } from '@/server/rate-limit';
import { db } from '@/server/db';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  userId: z.string().optional(),
  isPublic: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const session = await auth();
      const { searchParams } = new URL(request.url);

      // Parse and validate query params
      const params = querySchema.parse(Object.fromEntries(searchParams));
      const { page, pageSize, category, search, tags, userId, isPublic } = params;

      // Build where clause
      const where: Parameters<typeof db.sticker.findMany>[0]['where'] = {};

      // Filter by category
      if (category) {
        const categoryRecord = await db.stickerCategory.findUnique({
          where: { slug: category },
        });
        if (categoryRecord) {
          where.categoryId = categoryRecord.id;
        }
      }

      // Filter by search term
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { tags: { has: search.toLowerCase() } },
        ];
      }

      // Filter by tags
      if (tags) {
        const tagList = tags.split(',').map((t) => t.trim().toLowerCase());
        where.tags = { hasSome: tagList };
      }

      // Filter by user
      if (userId) {
        where.userId = userId;
      }

      // Filter by public/private
      if (isPublic !== undefined) {
        where.isPublic = isPublic === 'true';
      } else {
        // By default, show public stickers and user's own stickers
        if (session?.user?.id) {
          where.OR = [{ isPublic: true }, { userId: session.user.id }];
        } else {
          where.isPublic = true;
        }
      }

      // Get total count
      const total = await db.sticker.count({ where });

      // Get stickers with pagination
      const stickers = await db.sticker.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { name: true, slug: true },
          },
          user: {
            select: { name: true, image: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: stickers,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      });
    } catch (error) {
      console.error('Stickers fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch stickers' },
        { status: 500 }
      );
    }
  });
}
