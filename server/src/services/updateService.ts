import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface UpdateJob {
  id: string;
  status: 'idle' | 'running' | 'success' | 'error';
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  logs: string[];
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

let activeJob: UpdateJob = {
  id: '',
  status: 'idle',
  currentStep: '',
  stepIndex: 0,
  totalSteps: 5,
  logs: []
};

export function findRepoRoot(): string {
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  // Check for package.json with client and server subfolders
  cur = __dirname;
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(cur, 'package.json')) &&
      fs.existsSync(path.join(cur, 'client')) &&
      fs.existsSync(path.join(cur, 'server'))
    ) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(__dirname, '../../..');
}

function getLogFilePath(repoRoot: string): string {
  const logDir = path.join(repoRoot, 'server', 'logs');
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
  }
  return path.join(logDir, 'update.log');
}

function getStatusFilePath(repoRoot: string): string {
  const logDir = path.join(repoRoot, 'server', 'logs');
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
  }
  return path.join(logDir, 'last_update_status.json');
}

function runCommand(cmd: string, args: string[], cwd: string, onLog: (text: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const fullCmdStr = `${cmd} ${args.join(' ')}`;
    onLog(`\n$ ${fullCmdStr}\n`);

    // On Windows npm/npx are batch files (npm.cmd)
    let actualCmd = cmd;
    if (process.platform === 'win32') {
      if (cmd === 'npm') actualCmd = 'npm.cmd';
      else if (cmd === 'npx') actualCmd = 'npx.cmd';
    }

    const child = spawn(actualCmd, args, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        ...(process.platform !== 'win32'
          ? { PATH: `${process.env.PATH || ''}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin` }
          : {})
      }
    });

    child.stdout.on('data', (chunk) => {
      onLog(chunk.toString());
    });

    child.stderr.on('data', (chunk) => {
      onLog(chunk.toString());
    });

    child.on('error', (err) => {
      onLog(`[FOUT] ${err.message}\n`);
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const err = new Error(`Commando mislukt met exit code ${code}: ${fullCmdStr}`);
        onLog(`[FOUT] ${err.message}\n`);
        reject(err);
      }
    });
  });
}

export function getUpdateJob(): UpdateJob {
  if (activeJob.status === 'idle') {
    try {
      const repoRoot = findRepoRoot();
      const statusFile = getStatusFilePath(repoRoot);
      if (fs.existsSync(statusFile)) {
        const saved = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
        // If saved within last 10 minutes, return it
        const diffMs = Date.now() - new Date(saved.finishedAt || saved.startedAt).getTime();
        if (diffMs < 10 * 60 * 1000) {
          return saved;
        }
      }
    } catch {}
  }
  return activeJob;
}

export async function startUpdate(): Promise<{ started: boolean; message: string }> {
  if (activeJob.status === 'running') {
    return {
      started: false,
      message: 'Er is al een updateproces actief op de server. Volg de voortgang in het updatepaneel.'
    };
  }

  const repoRoot = findRepoRoot();
  const logFile = getLogFilePath(repoRoot);
  const statusFile = getStatusFilePath(repoRoot);
  const jobId = `upd_${Date.now()}`;

  activeJob = {
    id: jobId,
    status: 'running',
    currentStep: 'Initialiseren en repository controleren...',
    stepIndex: 1,
    totalSteps: 5,
    logs: [`[${new Date().toLocaleTimeString()}] Start Locra Systeem Update (Job ID: ${jobId})\nLocatie: ${repoRoot}\n`],
    startedAt: new Date().toISOString()
  };

  const appendLog = (text: string) => {
    const lines = text.split('\n');
    for (const l of lines) {
      if (l.trim().length > 0) {
        activeJob.logs.push(l);
      }
    }
    if (activeJob.logs.length > 1500) {
      activeJob.logs = activeJob.logs.slice(-1500);
    }
    try {
      fs.appendFileSync(logFile, text);
    } catch {}
  };

  const saveStatus = () => {
    try {
      fs.writeFileSync(statusFile, JSON.stringify(activeJob, null, 2), 'utf-8');
    } catch {}
  };

  // Run in background asynchronously
  (async () => {
    try {
      // ════════════════════════════════════════════════════════════════
      // STAP 1: CODE & GIT SYNCHRONISATIE
      // ════════════════════════════════════════════════════════════════
      activeJob.stepIndex = 1;
      activeJob.currentStep = 'Stap 1/5: Nieuwste code ophalen van GitHub repository...';
      saveStatus();
      appendLog(`\n=== STAP 1/5: CODE SYNCHRONISATIE ===\n`);

      const hasGit = fs.existsSync(path.join(repoRoot, '.git'));
      if (hasGit) {
        appendLog(`Git repository gedetecteerd. Updates ophalen van origin/main...\n`);
        try {
          await runCommand('git', ['remote', 'set-url', 'origin', 'https://github.com/LocrabyPjotters/EDU-Locra.git'], repoRoot, appendLog);
          await runCommand('git', ['fetch', 'origin', 'main'], repoRoot, appendLog);
          await runCommand('git', ['reset', '--hard', 'origin/main'], repoRoot, appendLog);
        } catch (gitErr: any) {
          appendLog(`Waarschuwing bij git reset: ${gitErr.message}. Poging tot opschonen...\n`);
          await runCommand('git', ['clean', '-fd', '-e', '.env', '-e', 'server/prisma/dev.db'], repoRoot, appendLog);
          await runCommand('git', ['reset', '--hard', 'origin/main'], repoRoot, appendLog);
        }
      } else {
        appendLog(`Geen .git map gevonden. Git repository initialiseren...\n`);
        await runCommand('git', ['init'], repoRoot, appendLog);
        await runCommand('git', ['remote', 'add', 'origin', 'https://github.com/LocrabyPjotters/EDU-Locra.git'], repoRoot, appendLog);
        await runCommand('git', ['fetch', 'origin', 'main'], repoRoot, appendLog);
        await runCommand('git', ['reset', '--hard', 'origin/main'], repoRoot, appendLog);
      }

      // Also ensure git submodule or inner directories are synchronized if present
      if (fs.existsSync(path.join(repoRoot, 'apps', 'locra-core', '.git'))) {
        try {
          appendLog(`Synchroniseren van apps/locra-core...\n`);
          await runCommand('git', ['fetch', 'origin', 'main'], path.join(repoRoot, 'apps', 'locra-core'), appendLog);
          await runCommand('git', ['reset', '--hard', 'origin/main'], path.join(repoRoot, 'apps', 'locra-core'), appendLog);
        } catch {}
      }

      // ════════════════════════════════════════════════════════════════
      // STAP 2: DEPENDENCIES INSTALLEREN
      // ════════════════════════════════════════════════════════════════
      activeJob.stepIndex = 2;
      activeJob.currentStep = 'Stap 2/5: Dependencies en packages bijwerken...';
      saveStatus();
      appendLog(`\n=== STAP 2/5: DEPENDENCIES INSTALLEREN ===\n`);

      const serverDir = path.join(repoRoot, 'server');
      const clientDir = path.join(repoRoot, 'client');

      appendLog(`Root dependencies installeren...\n`);
      await runCommand('npm', ['install', '--no-audit', '--no-fund'], repoRoot, appendLog);

      if (fs.existsSync(serverDir)) {
        appendLog(`Server dependencies installeren...\n`);
        await runCommand('npm', ['install', '--no-audit', '--no-fund'], serverDir, appendLog);
      }

      if (fs.existsSync(clientDir)) {
        appendLog(`Client dependencies installeren...\n`);
        await runCommand('npm', ['install', '--no-audit', '--no-fund'], clientDir, appendLog);
      }

      // ════════════════════════════════════════════════════════════════
      // STAP 3: DATABASE SCHEMA & PRISMA SYNCHRONISEREN
      // ════════════════════════════════════════════════════════════════
      activeJob.stepIndex = 3;
      activeJob.currentStep = 'Stap 3/5: Database schema controleren en migreren (Prisma)...';
      saveStatus();
      appendLog(`\n=== STAP 3/5: PRISMA & DATABASE MIGRATIE ===\n`);

      if (fs.existsSync(serverDir)) {
        await runCommand('npx', ['prisma', 'generate'], serverDir, appendLog);
        await runCommand('npx', ['prisma', 'db', 'push', '--accept-data-loss'], serverDir, appendLog);
      }

      // ════════════════════════════════════════════════════════════════
      // STAP 4: CLIENT & SERVER COMPILEREN (BUILD)
      // ════════════════════════════════════════════════════════════════
      activeJob.stepIndex = 4;
      activeJob.currentStep = 'Stap 4/5: Server en client bunder compileren...';
      saveStatus();
      appendLog(`\n=== STAP 4/5: COMPILATIE (BUILD) ===\n`);

      if (fs.existsSync(serverDir)) {
        appendLog(`Server compileren (tsc)...\n`);
        await runCommand('npm', ['run', 'build'], serverDir, appendLog);
      }

      if (fs.existsSync(clientDir)) {
        appendLog(`Client compileren (vite build)...\n`);
        await runCommand('npm', ['run', 'build'], clientDir, appendLog);
      }

      // Verify that client/dist has index.html
      const distIndex = path.join(clientDir, 'dist', 'index.html');
      if (fs.existsSync(distIndex)) {
        appendLog(`✓ Client build geverifieerd: ${distIndex} succesvol gegenereerd.\n`);
      } else {
        appendLog(`⚠️ Waarschuwing: client/dist/index.html niet direct gevonden, controleer build.\n`);
      }

      // ════════════════════════════════════════════════════════════════
      // STAP 5: HERSTARTEN VAN DE TOEPASSING
      // ════════════════════════════════════════════════════════════════
      activeJob.stepIndex = 5;
      activeJob.status = 'success';
      activeJob.finishedAt = new Date().toISOString();
      activeJob.currentStep = 'Update succesvol voltooid! Server wordt herstart.';
      saveStatus();

      appendLog(`\n=== STAP 5/5: HERSTARTEN VAN DE SERVER ===\n`);
      appendLog(`🎉 Locra compilatie is 100% geslaagd! Server wordt nu herstart...\n`);

      // Attempt PM2 restart first if available
      try {
        await runCommand('pm2', ['restart', 'all'], repoRoot, appendLog);
        appendLog(`PM2 service herstart uitgevoerd.\n`);
      } catch {
        appendLog(`Geen actieve PM2 processen gevonden of pm2 herstart overgeslagen.\n`);
      }

      // If running on Windows without supervisor, attempt to spawn restart script
      if (process.platform === 'win32') {
        try {
          const restartCmd = 'timeout /t 3 /nobreak >nul && npm run dev';
          spawn('cmd.exe', ['/c', restartCmd], {
            cwd: repoRoot,
            detached: true,
            stdio: 'ignore'
          }).unref();
          appendLog(`Windows achtergrondherstart klaargezet.\n`);
        } catch {}
      }

      appendLog(`Server sluit af om nieuwe code te laden (herstart binnen 2 seconden)...\n`);
      saveStatus();

      setTimeout(() => {
        process.exit(0);
      }, 2500);

    } catch (err: any) {
      activeJob.status = 'error';
      activeJob.error = err.message || 'Onbekende fout tijdens updateproces';
      activeJob.finishedAt = new Date().toISOString();
      activeJob.currentStep = `Fout: ${activeJob.error}`;
      appendLog(`\n❌ [UPDATE GEFAALD]: ${activeJob.error}\n`);
      saveStatus();
    }
  })();

  return {
    started: true,
    message: 'Locra update is succesvol gestart op de server. Volg de live voortgang in het paneel.'
  };
}
