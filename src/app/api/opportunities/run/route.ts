import { NextResponse } from 'next/server';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { listOpportunities } from '@/lib/opportunity-store';

const execFileAsync = promisify(execFile);
const OPENCLAW_SCOUT_JOB_ID = '384c3ddf-184e-4b92-8d75-703844e44700';

export async function POST() {
  const before = listOpportunities().length;

  try {
    await execFileAsync('openclaw', ['cron', 'run', OPENCLAW_SCOUT_JOB_ID, '--expect-final', '--timeout', '180000'], {
      timeout: 190000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: any) {
    const message = err?.stderr || err?.message || 'No se pudo lanzar el job de OpenClaw.';
    return NextResponse.json({ ok: false, inserted: 0, message: `Error al disparar job OpenClaw: ${message}` }, { status: 500 });
  }

  const after = listOpportunities().length;
  const inserted = Math.max(0, after - before);

  return NextResponse.json({
    ok: true,
    inserted,
    message: `Job OpenClaw ejecutado. Nuevas oportunidades insertadas: ${inserted}.`,
  });
}
