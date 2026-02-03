/**
 * Virus Scanning Service
 *
 * Supports multiple scanning backends:
 * 1. ClamAV (local) - for self-hosted deployments
 * 2. VirusTotal API - cloud-based scanning
 * 3. Mock scanner - for development/testing
 *
 * The scanner is configured via environment variables:
 * - VIRUS_SCANNER: 'clamav' | 'virustotal' | 'mock' | 'none'
 * - CLAMAV_HOST: ClamAV daemon host (default: localhost)
 * - CLAMAV_PORT: ClamAV daemon port (default: 3310)
 * - VIRUSTOTAL_API_KEY: VirusTotal API key
 */

export interface ScanResult {
  clean: boolean;
  scanned: boolean;
  scannerType: string;
  message?: string;
  threats?: string[];
  scanDuration?: number;
}

type ScannerType = 'clamav' | 'virustotal' | 'mock' | 'none';

/**
 * Get configured scanner type
 */
function getScannerType(): ScannerType {
  const scanner = process.env.VIRUS_SCANNER?.toLowerCase() as ScannerType;
  if (['clamav', 'virustotal', 'mock', 'none'].includes(scanner)) {
    return scanner;
  }
  // Default to mock in development, none in production
  return process.env.NODE_ENV === 'development' ? 'mock' : 'none';
}

/**
 * ClamAV Scanner using clamd protocol
 */
async function scanWithClamAV(buffer: Buffer): Promise<ScanResult> {
  const host = process.env.CLAMAV_HOST || 'localhost';
  const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);

  const startTime = Date.now();

  try {
    // Dynamic import to avoid loading net in edge runtime
    const net = await import('net');

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let response = '';

      socket.setTimeout(30000); // 30 second timeout

      socket.connect(port, host, () => {
        // Send INSTREAM command
        socket.write('zINSTREAM\0');

        // Send file size as 4-byte big-endian
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(buffer.length, 0);
        socket.write(sizeBuffer);

        // Send file content
        socket.write(buffer);

        // Send end marker (zero-length chunk)
        const endBuffer = Buffer.alloc(4);
        endBuffer.writeUInt32BE(0, 0);
        socket.write(endBuffer);
      });

      socket.on('data', (data) => {
        response += data.toString();
      });

      socket.on('close', () => {
        const scanDuration = Date.now() - startTime;
        const cleanResponse = response.trim().replace(/\0/g, '');

        // ClamAV returns "stream: OK" for clean files
        // or "stream: <virus name> FOUND" for infected files
        if (cleanResponse.includes('OK')) {
          resolve({
            clean: true,
            scanned: true,
            scannerType: 'clamav',
            message: 'No threats detected',
            scanDuration,
          });
        } else if (cleanResponse.includes('FOUND')) {
          const threats = cleanResponse
            .split('\n')
            .filter((line) => line.includes('FOUND'))
            .map((line) => line.replace(/stream: |FOUND/g, '').trim());

          resolve({
            clean: false,
            scanned: true,
            scannerType: 'clamav',
            message: 'Threats detected',
            threats,
            scanDuration,
          });
        } else {
          resolve({
            clean: true,
            scanned: false,
            scannerType: 'clamav',
            message: `Scan inconclusive: ${cleanResponse}`,
            scanDuration,
          });
        }
      });

      socket.on('error', (err) => {
        console.error('ClamAV connection error:', err);
        resolve({
          clean: true,
          scanned: false,
          scannerType: 'clamav',
          message: `Scanner unavailable: ${err.message}`,
          scanDuration: Date.now() - startTime,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          clean: true,
          scanned: false,
          scannerType: 'clamav',
          message: 'Scan timeout',
          scanDuration: Date.now() - startTime,
        });
      });
    });
  } catch (error) {
    return {
      clean: true,
      scanned: false,
      scannerType: 'clamav',
      message: `Scanner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      scanDuration: Date.now() - startTime,
    };
  }
}

/**
 * VirusTotal Scanner using their API
 */
async function scanWithVirusTotal(buffer: Buffer): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    return {
      clean: true,
      scanned: false,
      scannerType: 'virustotal',
      message: 'VirusTotal API key not configured',
    };
  }

  const startTime = Date.now();

  try {
    // First, upload the file
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(buffer)]), 'upload');

    const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const analysisId = uploadResult.data?.id;

    if (!analysisId) {
      throw new Error('No analysis ID returned');
    }

    // Poll for results (with timeout)
    const maxAttempts = 12; // 1 minute max
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const analysisResponse = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: { 'x-apikey': apiKey },
        }
      );

      if (!analysisResponse.ok) continue;

      const analysisResult = await analysisResponse.json();
      const status = analysisResult.data?.attributes?.status;

      if (status === 'completed') {
        const stats = analysisResult.data?.attributes?.stats || {};
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;

        if (malicious > 0 || suspicious > 0) {
          return {
            clean: false,
            scanned: true,
            scannerType: 'virustotal',
            message: `Detected by ${malicious + suspicious} scanners`,
            threats: [`${malicious} malicious, ${suspicious} suspicious detections`],
            scanDuration: Date.now() - startTime,
          };
        }

        return {
          clean: true,
          scanned: true,
          scannerType: 'virustotal',
          message: 'No threats detected',
          scanDuration: Date.now() - startTime,
        };
      }
    }

    return {
      clean: true,
      scanned: false,
      scannerType: 'virustotal',
      message: 'Scan timeout - analysis still pending',
      scanDuration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      clean: true,
      scanned: false,
      scannerType: 'virustotal',
      message: `Scanner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      scanDuration: Date.now() - startTime,
    };
  }
}

/**
 * Mock scanner for development/testing
 */
async function scanMock(buffer: Buffer): Promise<ScanResult> {
  // Simulate scan delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Check for EICAR test string (standard antivirus test pattern)
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
  if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
    return {
      clean: false,
      scanned: true,
      scannerType: 'mock',
      message: 'Test threat detected',
      threats: ['EICAR-Test-File'],
      scanDuration: 100,
    };
  }

  return {
    clean: true,
    scanned: true,
    scannerType: 'mock',
    message: 'Mock scan passed',
    scanDuration: 100,
  };
}

/**
 * No-op scanner (scanning disabled)
 */
async function scanNone(): Promise<ScanResult> {
  return {
    clean: true,
    scanned: false,
    scannerType: 'none',
    message: 'Virus scanning is disabled',
    scanDuration: 0,
  };
}

/**
 * Main virus scan function - routes to appropriate scanner
 */
export async function scanForViruses(buffer: Buffer): Promise<ScanResult> {
  const scannerType = getScannerType();

  switch (scannerType) {
    case 'clamav':
      return scanWithClamAV(buffer);
    case 'virustotal':
      return scanWithVirusTotal(buffer);
    case 'mock':
      return scanMock(buffer);
    case 'none':
    default:
      return scanNone();
  }
}

/**
 * Check if virus scanning is enabled
 */
export function isScanningEnabled(): boolean {
  const scannerType = getScannerType();
  return scannerType !== 'none';
}

/**
 * Get scanner status/health check
 */
export async function getScannerHealth(): Promise<{
  available: boolean;
  scannerType: string;
  message: string;
}> {
  const scannerType = getScannerType();

  switch (scannerType) {
    case 'clamav': {
      // Try to ping ClamAV
      try {
        const host = process.env.CLAMAV_HOST || 'localhost';
        const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);
        const net = await import('net');

        return new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(5000);

          socket.connect(port, host, () => {
            socket.write('zPING\0');
          });

          socket.on('data', (data) => {
            const response = data.toString().trim();
            socket.destroy();
            resolve({
              available: response.includes('PONG'),
              scannerType: 'clamav',
              message: response.includes('PONG') ? 'ClamAV daemon is running' : 'Unexpected response',
            });
          });

          socket.on('error', () => {
            resolve({
              available: false,
              scannerType: 'clamav',
              message: 'Cannot connect to ClamAV daemon',
            });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({
              available: false,
              scannerType: 'clamav',
              message: 'Connection timeout',
            });
          });
        });
      } catch {
        return {
          available: false,
          scannerType: 'clamav',
          message: 'ClamAV not available',
        };
      }
    }

    case 'virustotal':
      return {
        available: Boolean(process.env.VIRUSTOTAL_API_KEY),
        scannerType: 'virustotal',
        message: process.env.VIRUSTOTAL_API_KEY
          ? 'VirusTotal API configured'
          : 'VirusTotal API key not set',
      };

    case 'mock':
      return {
        available: true,
        scannerType: 'mock',
        message: 'Mock scanner active (development mode)',
      };

    case 'none':
    default:
      return {
        available: false,
        scannerType: 'none',
        message: 'Virus scanning is disabled',
      };
  }
}
