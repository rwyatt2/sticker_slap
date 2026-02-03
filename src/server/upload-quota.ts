import { db } from './db';
import { UPLOAD_CONFIG } from '@/lib/image-validation';

export interface QuotaStatus {
  hasQuota: boolean;
  usedBytes: bigint;
  totalBytes: bigint;
  remainingBytes: bigint;
  usedPercentage: number;
  canUpload: boolean;
  message?: string;
}

/**
 * Check if a user has enough quota for an upload
 */
export async function checkUploadQuota(
  userId: string,
  fileSize: number
): Promise<QuotaStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      uploadQuotaBytes: true,
      uploadUsedBytes: true,
    },
  });

  if (!user) {
    return {
      hasQuota: false,
      usedBytes: BigInt(0),
      totalBytes: BigInt(0),
      remainingBytes: BigInt(0),
      usedPercentage: 0,
      canUpload: false,
      message: 'User not found',
    };
  }

  const usedBytes = user.uploadUsedBytes;
  const totalBytes = user.uploadQuotaBytes;
  const remainingBytes = totalBytes - usedBytes;
  const usedPercentage =
    totalBytes > 0 ? Number((usedBytes * BigInt(100)) / totalBytes) : 0;

  const canUpload = remainingBytes >= BigInt(fileSize);

  return {
    hasQuota: true,
    usedBytes,
    totalBytes,
    remainingBytes,
    usedPercentage,
    canUpload,
    message: canUpload
      ? undefined
      : `Not enough storage quota. Need ${formatBytes(fileSize)}, have ${formatBytes(Number(remainingBytes))}`,
  };
}

/**
 * Get user's current quota status
 */
export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  return checkUploadQuota(userId, 0);
}

/**
 * Increment user's used storage
 */
export async function incrementUsedQuota(
  userId: string,
  bytes: number
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      uploadUsedBytes: { increment: BigInt(bytes) },
    },
  });
}

/**
 * Decrement user's used storage (when deleting files)
 */
export async function decrementUsedQuota(
  userId: string,
  bytes: number
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      uploadUsedBytes: { decrement: BigInt(bytes) },
    },
  });
}

/**
 * Reset user's quota tracking (admin function)
 */
export async function resetUserQuota(
  userId: string,
  newQuotaBytes?: number
): Promise<void> {
  // Calculate actual used space from stickers
  const stickers = await db.sticker.findMany({
    where: { userId, isDeleted: false },
    select: { fileSize: true },
  });

  const actualUsed = stickers.reduce((sum, s) => sum + s.fileSize, 0);

  await db.user.update({
    where: { id: userId },
    data: {
      uploadUsedBytes: BigInt(actualUsed),
      ...(newQuotaBytes !== undefined && {
        uploadQuotaBytes: BigInt(newQuotaBytes),
      }),
    },
  });
}

/**
 * Set user's quota limit (admin function)
 */
export async function setUserQuotaLimit(
  userId: string,
  quotaBytes: number
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      uploadQuotaBytes: BigInt(quotaBytes),
    },
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get upload limits for a user
 */
export async function getUploadLimits(userId: string) {
  const quota = await getQuotaStatus(userId);

  return {
    maxFileSize: UPLOAD_CONFIG.maxFileSize,
    maxDimensions: UPLOAD_CONFIG.maxDimensions,
    maxUploadsPerHour: UPLOAD_CONFIG.maxUploadsPerHour,
    quotaUsed: Number(quota.usedBytes),
    quotaTotal: Number(quota.totalBytes),
    quotaRemaining: Number(quota.remainingBytes),
    quotaUsedPercentage: quota.usedPercentage,
  };
}
