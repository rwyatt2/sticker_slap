import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { uploadFile } from './storage';
import { processImageForStorage, generateThumbnail } from './image';
import { scanForViruses } from './virus-scanner';
import { validateUploadFile, sanitizeFilename } from '@/lib/image-validation';

// Redis connection for BullMQ
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  if (!redisUrl) {
    console.warn('No Redis URL configured, upload queue will use in-memory fallback');
    return null;
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Queue names
export const UPLOAD_QUEUE_NAME = 'image-upload-processing';

// Job data interface
export interface UploadJobData {
  jobId: string;
  userId: string;
  tempBuffer: string; // Base64 encoded buffer for serialization
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  metadata?: {
    name?: string;
    tags?: string[];
    categoryId?: string;
    isPublic?: boolean;
  };
}

// Job result interface
export interface UploadJobResult {
  success: boolean;
  stickerId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

// Initialize the queue
let uploadQueue: Queue<UploadJobData, UploadJobResult> | null = null;
let uploadWorker: Worker<UploadJobData, UploadJobResult> | null = null;

/**
 * Get or create the upload queue
 */
export function getUploadQueue(): Queue<UploadJobData, UploadJobResult> | null {
  if (uploadQueue) return uploadQueue;

  const connection = getRedisConnection();
  if (!connection) return null;

  uploadQueue = new Queue<UploadJobData, UploadJobResult>(UPLOAD_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 60 * 60, // Remove jobs older than 24 hours
      },
      removeOnFail: {
        count: 50, // Keep last 50 failed jobs for debugging
      },
    },
  });

  return uploadQueue;
}

/**
 * Process an upload job
 */
async function processUploadJob(
  job: Job<UploadJobData, UploadJobResult>
): Promise<UploadJobResult> {
  const { jobId, userId, tempBuffer, originalFilename, mimeType, metadata } = job.data;

  try {
    // Update job status to processing
    await db.uploadJob.update({
      where: { id: jobId },
      data: { status: 'SCANNING', progress: 10 },
    });

    // Decode buffer from base64
    const buffer = Buffer.from(tempBuffer, 'base64');

    // Step 1: Validate file
    await job.updateProgress(15);
    const validation = await validateUploadFile(buffer, originalFilename, mimeType);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Step 2: Virus scan
    await job.updateProgress(20);
    await db.uploadJob.update({
      where: { id: jobId },
      data: { status: 'SCANNING', progress: 20 },
    });

    const scanResult = await scanForViruses(buffer);
    await db.uploadJob.update({
      where: { id: jobId },
      data: {
        virusScanPassed: scanResult.clean,
        virusScanResult: JSON.stringify(scanResult),
      },
    });

    if (!scanResult.clean) {
      throw new Error(`Virus detected: ${scanResult.threats?.join(', ') || 'Unknown threat'}`);
    }

    // Step 3: Process image
    await job.updateProgress(40);
    await db.uploadJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', progress: 40 },
    });

    const processed = await processImageForStorage(buffer, mimeType);

    // Step 4: Generate thumbnail
    await job.updateProgress(60);
    const thumbnail = await generateThumbnail(buffer, {
      width: 200,
      height: 200,
      quality: 80,
    });

    // Step 5: Upload to storage
    await job.updateProgress(70);
    const sanitizedName = sanitizeFilename(originalFilename);
    const uniqueId = uuidv4();
    const extension = processed.mimeType === 'image/webp' ? 'webp' : sanitizedName.split('.').pop();

    const { key: imageKey, url: imageUrl } = await uploadFile(
      processed.buffer,
      `${uniqueId}.${extension}`,
      {
        folder: `stickers/${userId}`,
        contentType: processed.mimeType,
        isPublic: metadata?.isPublic ?? true,
      }
    );

    await job.updateProgress(85);
    const { url: thumbnailUrl } = await uploadFile(thumbnail.buffer, `${uniqueId}_thumb.webp`, {
      folder: `stickers/${userId}/thumbnails`,
      contentType: thumbnail.mimeType,
      isPublic: true,
    });

    // Step 6: Save to database
    await job.updateProgress(95);
    const sticker = await db.sticker.create({
      data: {
        userId,
        name: metadata?.name || sanitizedName,
        imageUrl,
        thumbnailUrl,
        storageKey: imageKey,
        originalFilename: sanitizedName,
        mimeType: processed.mimeType,
        fileSize: processed.buffer.length,
        width: processed.metadata.width,
        height: processed.metadata.height,
        tags: metadata?.tags || [],
        categoryId: metadata?.categoryId || null,
        isPublic: metadata?.isPublic ?? false,
      },
    });

    // Update user quota
    await db.user.update({
      where: { id: userId },
      data: {
        uploadUsedBytes: { increment: BigInt(processed.buffer.length) },
      },
    });

    // Mark job as completed
    await db.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        finalKey: imageKey,
        stickerId: sticker.id,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      stickerId: sticker.id,
      imageUrl,
      thumbnailUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Mark job as failed
    await db.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Start the upload worker
 */
export function startUploadWorker(): Worker<UploadJobData, UploadJobResult> | null {
  if (uploadWorker) return uploadWorker;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('Cannot start upload worker: No Redis connection');
    return null;
  }

  uploadWorker = new Worker<UploadJobData, UploadJobResult>(
    UPLOAD_QUEUE_NAME,
    processUploadJob,
    {
      connection,
      concurrency: 5, // Process up to 5 uploads concurrently
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );

  uploadWorker.on('completed', (job, result) => {
    console.log(`Upload job ${job.id} completed:`, result.success ? 'success' : 'failed');
  });

  uploadWorker.on('failed', (job, error) => {
    console.error(`Upload job ${job?.id} failed:`, error.message);
  });

  uploadWorker.on('error', (error) => {
    console.error('Upload worker error:', error);
  });

  return uploadWorker;
}

/**
 * Add an upload job to the queue
 */
export async function queueUpload(
  userId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata?: UploadJobData['metadata']
): Promise<{ jobId: string; queued: boolean }> {
  // Create job record in database
  const job = await db.uploadJob.create({
    data: {
      userId,
      status: 'PENDING',
      originalName: sanitizeFilename(filename),
      fileSize: buffer.length,
      mimeType,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });

  const queue = getUploadQueue();

  if (queue) {
    // Add to queue for background processing
    await queue.add(
      'process-upload',
      {
        jobId: job.id,
        userId,
        tempBuffer: buffer.toString('base64'),
        originalFilename: filename,
        mimeType,
        fileSize: buffer.length,
        metadata,
      },
      {
        jobId: job.id,
      }
    );

    return { jobId: job.id, queued: true };
  } else {
    // No queue available, process synchronously
    await processUploadJob({
      data: {
        jobId: job.id,
        userId,
        tempBuffer: buffer.toString('base64'),
        originalFilename: filename,
        mimeType,
        fileSize: buffer.length,
        metadata,
      },
      updateProgress: async () => {},
    } as unknown as Job<UploadJobData, UploadJobResult>);

    return { jobId: job.id, queued: false };
  }
}

/**
 * Get upload job status
 */
export async function getUploadJobStatus(jobId: string) {
  return db.uploadJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      progress: true,
      errorMessage: true,
      stickerId: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

/**
 * Clean up old jobs
 */
export async function cleanupOldJobs(olderThanDays = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  return db.uploadJob.deleteMany({
    where: {
      completedAt: { lt: cutoffDate },
      status: { in: ['COMPLETED', 'FAILED'] },
    },
  });
}

/**
 * Process upload synchronously (fallback when queue is not available)
 */
export async function processUploadSync(
  userId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata?: UploadJobData['metadata']
): Promise<UploadJobResult> {
  // Validate file
  const validation = await validateUploadFile(buffer, filename, mimeType);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Virus scan
  const scanResult = await scanForViruses(buffer);
  if (!scanResult.clean) {
    return {
      success: false,
      error: `Security threat detected: ${scanResult.threats?.join(', ')}`,
    };
  }

  // Process image
  const processed = await processImageForStorage(buffer, mimeType);

  // Generate thumbnail
  const thumbnail = await generateThumbnail(buffer, {
    width: 200,
    height: 200,
    quality: 80,
  });

  // Upload to storage
  const sanitizedName = sanitizeFilename(filename);
  const uniqueId = uuidv4();
  const extension = processed.mimeType === 'image/webp' ? 'webp' : sanitizedName.split('.').pop();

  const { key: imageKey, url: imageUrl } = await uploadFile(
    processed.buffer,
    `${uniqueId}.${extension}`,
    {
      folder: `stickers/${userId}`,
      contentType: processed.mimeType,
      isPublic: metadata?.isPublic ?? true,
    }
  );

  const { url: thumbnailUrl } = await uploadFile(thumbnail.buffer, `${uniqueId}_thumb.webp`, {
    folder: `stickers/${userId}/thumbnails`,
    contentType: thumbnail.mimeType,
    isPublic: true,
  });

  // Save to database
  const sticker = await db.sticker.create({
    data: {
      userId,
      name: metadata?.name || sanitizedName,
      imageUrl,
      thumbnailUrl,
      storageKey: imageKey,
      originalFilename: sanitizedName,
      mimeType: processed.mimeType,
      fileSize: processed.buffer.length,
      width: processed.metadata.width,
      height: processed.metadata.height,
      tags: metadata?.tags || [],
      categoryId: metadata?.categoryId || null,
      isPublic: metadata?.isPublic ?? false,
    },
  });

  // Update user quota
  await db.user.update({
    where: { id: userId },
    data: {
      uploadUsedBytes: { increment: BigInt(processed.buffer.length) },
    },
  });

  return {
    success: true,
    stickerId: sticker.id,
    imageUrl,
    thumbnailUrl,
  };
}
