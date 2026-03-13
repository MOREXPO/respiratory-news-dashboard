import { NextResponse } from 'next/server';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { listOpportunities } from '@/lib/opportunity-store';

const execFileAsync = promisify(execFile);
const OPENCLAW_SCOUT_JOB_ID = '384c3ddf-184e-4b92-8d75-703844e44700';

export async function POST() {
  try {
    // Trigger without waiting for full agent completion to avoid HTTP timeouts.
    await execFileAsync('openclaw', ['cron', 'run', OPENCLAW_SCOUT_JOB_ID, '--timeout', '20000'], {
      timeout: 25000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: any) {
    const message = err?.stderr || err?.message || 'No se pudo lanzar el job de OpenClaw.';
    return NextResponse.json({ ok: false, inserted: 0, message: `Error al disparar job OpenClaw: ${message}` }, { status: 500 });
  }

  const currentCount = listOpportunities().length;
  return NextResponse.json({
    ok: true,
    inserted: 0,
    message: `Job OpenClaw disparado correctamente. Revisa la lista en unos segundos. Total actual: ${currentCount}.`,
  });
}
