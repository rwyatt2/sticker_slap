import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { withRateLimit } from '@/server/rate-limit';
import { db } from '@/server/db';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  width: z.number().min(100).max(10000).default(1920),
  height: z.number().min(100).max(10000).default(1080),
  data: z.any().default({ elements: [] }),
  isPublic: z.boolean().default(false),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

// GET - List user's projects
export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const params = querySchema.parse(Object.fromEntries(searchParams));
      const { page, pageSize } = params;

      const total = await db.project.count({
        where: { userId: session.user.id },
      });

      const projects = await db.project.findMany({
        where: { userId: session.user.id },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          thumbnail: true,
          width: true,
          height: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: projects,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      });
    } catch (error) {
      console.error('Projects fetch error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch projects' },
        { status: 500 }
      );
    }
  });
}

// POST - Create new project
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const body = await request.json();
      const data = createProjectSchema.parse(body);

      const project = await db.project.create({
        data: {
          ...data,
          userId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: project,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, message: 'Validation error', details: error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      console.error('Project create error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to create project' },
        { status: 500 }
      );
    }
  });
}
