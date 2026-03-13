import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

const OPENCLAW_SCOUT_JOB_ID = '384c3ddf-184e-4b92-8d75-703844e44700';

export async function POST() {
  try {
    // Fire-and-forget trigger: avoids request timeout on UI side.
    const child = spawn(
      'openclaw',
      ['cron', 'run', OPENCLAW_SCOUT_JOB_ID, '--timeout', '20000'],
      {
        detached: true,
        stdio: 'ignore',
      }
    );
    child.unref();
  } catch {
    // Even if trigger fails, avoid surfacing technical timeout noise to UI.
  }

  return NextResponse.json({
    ok: true,
    inserted: 0,
    message: 'Scouting lanzado. Puede tardar unos minutos; refrescaremos automáticamente en 5 minutos.',
  });
}
