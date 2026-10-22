const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Migrated + freshly seeded test database (employee_mgmt_test) before the suite runs.
// The seed wipes and recreates demo data, so each run starts from the same state.
module.exports = () => {
  const testEnv = dotenv.config({ path: path.join(__dirname, '../.env.test'), quiet: true }).parsed;
  const opts = { cwd: path.join(__dirname, '..'), env: { ...process.env, ...testEnv }, stdio: 'pipe' };
  execSync('npx prisma migrate deploy', opts);
  execSync('node prisma/seed.js', opts);
};
