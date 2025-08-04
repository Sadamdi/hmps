import { spawn } from 'child_process';

console.log('Menjalankan Performance Audit...');

const child = spawn('npx', ['tsx', 'scripts/performance-audit.ts'], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  console.log(`Script selesai dengan kode: ${code}`);
}); 