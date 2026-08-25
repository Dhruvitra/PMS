import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemMetricsService {
  static getCpuUsagePercent(): number {
    // Instant snapshot via load average / core count -- not a precise sampled measurement (that
    // would need two readings over an interval), but good enough for an at-a-glance dashboard
    // number, and has zero added latency on the request.
    const cores = os.cpus().length;
    const [loadAvg1min] = os.loadavg();
    return Math.min(100, Math.round((loadAvg1min / cores) * 100));
  }

  static getMemoryUsage() {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent: Math.round((usedBytes / totalBytes) * 100),
    };
  }

  /** Disk usage for the root filesystem -- shells out to `df` since Node has no built-in API for
   *  this. Only works on Linux/macOS (the VPS is Linux); returns null rather than throwing if
   *  `df` isn't available or its output doesn't parse, so one flaky reading doesn't break the
   *  whole dashboard. */
  static async getDiskUsage(): Promise<{ totalBytes: number; usedBytes: number; freeBytes: number; usedPercent: number } | null> {
    try {
      const { stdout } = await execAsync('df -k / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      // df -k output columns: Filesystem, 1K-blocks, Used, Available, Use%, Mounted-on
      const totalBytes = Number(parts[1]) * 1024;
      const usedBytes = Number(parts[2]) * 1024;
      const freeBytes = Number(parts[3]) * 1024;
      if (!totalBytes || Number.isNaN(usedBytes)) return null;
      return { totalBytes, usedBytes, freeBytes, usedPercent: Math.round((usedBytes / totalBytes) * 100) };
    } catch {
      return null;
    }
  }

  static async getSnapshot() {
    const [disk] = await Promise.all([this.getDiskUsage()]);
    return {
      cpuUsagePercent: this.getCpuUsagePercent(),
      memory: this.getMemoryUsage(),
      disk,
      uptimeSeconds: os.uptime(),
    };
  }
}
