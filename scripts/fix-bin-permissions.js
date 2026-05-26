import { execSync } from 'node:child_process';
import os from 'node:os';

if (os.platform() !== 'win32') {
  try {
    execSync('chmod -R +x node_modules/.bin', { stdio: 'inherit' });
  } catch (e) {
    process.exit(0);
  }
}
