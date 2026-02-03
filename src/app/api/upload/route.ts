import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { rateLimitUpload } from '@/server/rate-limit';
import { checkUploadQuota, getUploadLimits } from '@/server/upload-quota';
import { queueUpload, processUploadSync, getUploadJobStatus } from '@/server/upload-queue';
import { validateUploadFile, sanitizeFilename, UPLOAD_CONFIG, ALLOWED_IMAGE_TYPES, formatFileSize } from '@/lib/image-validation';
import { validateDimensions } from '@/server/image';
import { isScanningEnabled } from '@/server/virus-scanner';

// Export runtime config for streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload - Upload one or more images
 *
 * Supports both single and multiple file uploads.
 * Files are validated, scanned, processed, and stored asynchronously when queue is available.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check rate limit (10 uploads per hour)
    const rateLimit = await rateLimitUpload(userId);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload rate limit exceeded. You can upload ${UPLOAD_CONFIG.maxUploadsPerHour} files per hour.`,
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: new Date(rateLimit.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const file = formData.get('file') as File | null;

    // Support both single 'file' and multiple 'files' field names
    const uploadFiles = files.length > 0 ? files : file ? [file] : [];

    if (uploadFiles.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No files provided' },
        { status: 400 }
      );
    }

    // Check if uploading too many files at once
    if (uploadFiles.length > 10) {
      return NextResponse.json(
        { success: false, message: 'Maximum 10 files per upload request' },
        { status: 400 }
      );
    }

    // Get optional metadata
    const name = formData.get('name') as string | null;
    const categoryId = formData.get('categoryId') as string | null;
    const tags = formData.get('tags') as string | null;
    const isPublic = formData.get('isPublic') === 'true';
    const useQueue = formData.get('async') === 'true';

    const metadata = {
      name: name || undefined,
      categoryId: categoryId || undefined,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      isPublic,
    };

    const results: Array<{
      filename: string;
      success: boolean;
      message?: string;
      jobId?: string;
      stickerId?: string;
      imageUrl?: string;
      thumbnailUrl?: string;
    }> = [];

    // Process each file
    for (const uploadFile of uploadFiles) {
      const sanitizedName = sanitizeFilename(uploadFile.name);

      try {
        // Validate file type (client-declared)
        const allowedTypes = Object.keys(ALLOWED_IMAGE_TYPES);
        if (!allowedTypes.includes(uploadFile.type)) {
          results.push({
            filename: sanitizedName,
            success: false,
            message: `Invalid file type: ${uploadFile.type}. Allowed: JPEG, PNG, WebP, GIF, SVG`,
          });
          continue;
        }

        // Validate file size
        if (uploadFile.size > UPLOAD_CONFIG.maxFileSize) {
          results.push({
            filename: sanitizedName,
            success: false,
            message: `File too large: ${formatFileSize(uploadFile.size)}. Maximum: ${formatFileSize(UPLOAD_CONFIG.maxFileSize)}`,
          });
          continue;
        }

        // Check quota
        const quota = await checkUploadQuota(userId, uploadFile.size);
        if (!quota.canUpload) {
          results.push({
            filename: sanitizedName,
            success: false,
            message: quota.message || 'Storage quota exceeded',
          });
          continue;
        }

        // Convert to buffer
        const buffer = Buffer.from(await uploadFile.arrayBuffer());

        // Validate MIME type matches actual content
        const validation = await validateUploadFile(
          buffer,
          uploadFile.name,
          uploadFile.type
        );

        if (!validation.valid) {
          results.push({
            filename: sanitizedName,
            success: false,
            message: validation.error,
          });
          continue;
        }

        // Validate dimensions (for non-SVG)
        if (uploadFile.type !== 'image/svg+xml') {
          const dimensions = await validateDimensions(buffer);
          if (!dimensions.valid) {
            results.push({
              filename: sanitizedName,
              success: false,
              message: dimensions.error,
            });
            continue;
          }
        }

        // Process upload
        if (useQueue) {
          // Queue for background processing
          const { jobId, queued } = await queueUpload(
            userId,
            buffer,
            uploadFile.name,
            uploadFile.type,
            metadata
          );

          results.push({
            filename: sanitizedName,
            success: true,
            message: queued
              ? 'Upload queued for processing'
              : 'Upload processed synchronously',
            jobId,
          });
        } else {
          // Process synchronously
          const result = await processUploadSync(
            userId,
            buffer,
            uploadFile.name,
            uploadFile.type,
            metadata
          );

          if (result.success) {
            results.push({
              filename: sanitizedName,
              success: true,
              stickerId: result.stickerId,
              imageUrl: result.imageUrl,
              thumbnailUrl: result.thumbnailUrl,
            });
          } else {
            results.push({
              filename: sanitizedName,
              success: false,
              message: result.error,
            });
          }
        }
      } catch (error) {
        console.error(`Upload error for ${sanitizedName}:`, error);
        results.push({
          filename: sanitizedName,
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to process upload',
        });
      }
    }

    // Calculate overall success
    const successCount = results.filter((r) => r.success).length;
    const allSuccess = successCount === results.length;

    return NextResponse.json(
      {
        success: allSuccess,
        message: allSuccess
          ? `Successfully uploaded ${successCount} file(s)`
          : `Uploaded ${successCount}/${results.length} file(s)`,
        results,
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining - 1,
          resetAt: new Date(rateLimit.reset).toISOString(),
        },
      },
      {
        status: allSuccess ? 200 : 207, // Multi-Status for partial success
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': (rateLimit.remaining - 1).toString(),
          'X-RateLimit-Reset': rateLimit.reset.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to upload files',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload - Get upload status or limits
 *
 * Query params:
 * - jobId: Get status of a specific upload job
 * - limits: Get current upload limits and quota
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    // Get job status
    if (jobId) {
      const status = await getUploadJobStatus(jobId);
      if (!status) {
        return NextResponse.json(
          { success: false, message: 'Job not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: status });
    }

    // Get upload limits and quota
    const limits = await getUploadLimits(session.user.id);
    const scanningEnabled = isScanningEnabled();

    return NextResponse.json({
      success: true,
      data: {
        ...limits,
        allowedTypes: Object.keys(ALLOWED_IMAGE_TYPES),
        virusScanningEnabled: scanningEnabled,
      },
    });
  } catch (error) {
    console.error('Get upload info error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get upload info' },
      { status: 500 }
    );
  }
}
