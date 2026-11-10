import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = (input.tool_input?.file_path ?? '').replaceAll('\\', '/');

const isFrontendSource =
  filePath.includes('/frontend/src/') && /\.(ts|html|scss|json)$/.test(filePath);

if (isFrontendSource) {
  try {
    execFileSync('npx', ['--no-install', 'prettier', '--write', filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR + '/frontend',
      stdio: 'ignore',
      shell: true,
    });
  } catch {
    // Prettier not installed yet or formatting failed: never block the edit.
  }
}

process.exit(0);
