import { existsSync, readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = (input.tool_input?.file_path ?? '').replaceAll('\\', '/');

const isExistingMigration =
  /db\/migration\/V\d+__.+\.sql$/.test(filePath) && existsSync(filePath);
const isEnvFile = /(^|\/)\.env(\..+)?$/.test(filePath);

if (isExistingMigration) {
  console.error(
    `Blocked: ${filePath} is an existing Flyway migration. ` +
    'Create a new migration instead (see the add-flyway-migration skill).'
  );
  process.exit(2);
}

if (isEnvFile) {
  console.error(`Blocked: ${filePath} may contain secrets and must not be edited by Claude.`);
  process.exit(2);
}

process.exit(0);
