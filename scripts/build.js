const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, opts = {}) {
  console.log(`\x1b[36m> ${cmd}\x1b[0m`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function cleanupWorktree(dir) {
  if (fs.existsSync(dir)) {
    try {
      execSync(`git worktree remove --force "${dir}"`, { stdio: 'ignore' });
    } catch {}
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

const tempWorktreeDir = path.join(process.env.TEMP || '/tmp', 'esp-rc-build-tree');

try {
  // 1. Build frontend assets
  console.log('\n🔨 1. Building production frontend assets...');
  run('npm run build');

  const frontendDistDir = [
    path.resolve('frontend', 'dist'),
    path.resolve('dist')
  ].find((d) => fs.existsSync(d));

  if (!frontendDistDir) {
    throw new Error('Frontend build directory not found. Expected "frontend/dist" or "dist".');
  }

  // 2. Prepare build worktree
  console.log('\n🌿 2. Preparing build branch worktree...');
  try {
    run('git worktree prune', { stdio: 'ignore' });
  } catch {}

  cleanupWorktree(tempWorktreeDir);

  // Check if build branch exists on origin or locally
  try {
    run('git fetch origin build', { stdio: 'ignore' });
  } catch {}

  let baseRef = '';
  try {
    execSync('git rev-parse --verify origin/build', { stdio: 'ignore' });
    baseRef = 'origin/build';
  } catch {
    try {
      execSync('git rev-parse --verify build', { stdio: 'ignore' });
      baseRef = 'build';
    } catch {
      baseRef = '';
    }
  }

  const worktreeCmd = baseRef
    ? `git worktree add -B build "${tempWorktreeDir}" ${baseRef}`
    : `git worktree add -B build "${tempWorktreeDir}"`;

  run(worktreeCmd);

  // 3. Clear existing files in worktree except .git
  console.log('\n📂 3. Synchronizing production files...');
  for (const item of fs.readdirSync(tempWorktreeDir)) {
    if (item === '.git') continue;
    fs.rmSync(path.join(tempWorktreeDir, item), { recursive: true, force: true });
  }

  // 4. Copy frontend build dist -> public
  const publicDest = path.join(tempWorktreeDir, 'public');
  fs.mkdirSync(publicDest, { recursive: true });
  fs.cpSync(frontendDistDir, publicDest, { recursive: true });
  console.log(`Copied frontend build from ${frontendDistDir} to public/`);

  // 5. Copy all backend files & folders (except server.js) into app/
  const backendDir = path.resolve('backend');
  if (!fs.existsSync(backendDir)) {
    throw new Error(`Backend directory not found at ${backendDir}`);
  }

  const appDest = path.join(tempWorktreeDir, 'app');
  fs.mkdirSync(appDest, { recursive: true });

  for (const item of fs.readdirSync(backendDir)) {
    if (item === 'server.js') continue;
    const srcPath = path.join(backendDir, item);
    const destPath = path.join(appDest, item);

    fs.cpSync(srcPath, destPath, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        return base !== '.tmp' && !src.includes(path.sep + '.tmp');
      }
    });
  }
  console.log('Copied backend files and folders into app/');

  // 6. Copy server.js from backend, update backend paths to ./app/, and point mini.spa to public
  let serverJsContent = fs.readFileSync(path.join(backendDir, 'server.js'), 'utf-8');

  // Update backend requires and paths to point to app/
  serverJsContent = serverJsContent
    .replace(/require\(['"]\.\/(framework|services|controllers|middleware|routes)/g, "require('./app/$1")
    .replace(/path\.join\(__dirname,\s*['"]firmware['"]\)/g, "path.join(__dirname, 'app', 'firmware')");

  // Replace WEB_DIR logic and update mini.spa call to point to 'public' directory
  const updatedServerJs = serverJsContent.replace(
    /const WEB_DIR = [\s\S]*?app\.use\(mini\.spa\([^)]+\)\);/,
    `const API_PREFIXES = ['/firmware', '/admin/api', '/progress', '/versions', '/api'];\napp.use(mini.spa(path.join(__dirname, 'public'), { exclude: API_PREFIXES }));`
  );

  if (updatedServerJs === serverJsContent) {
    serverJsContent = serverJsContent.replace(
      /app\.use\(mini\.spa\([^)]+\)\);/,
      `app.use(mini.spa(path.join(__dirname, 'public'), { exclude: ['/firmware', '/admin/api', '/progress', '/versions', '/api'] }));`
    );
  } else {
    serverJsContent = updatedServerJs;
  }

  fs.writeFileSync(path.join(tempWorktreeDir, 'server.js'), serverJsContent);
  console.log('Copied and configured server.js to delegate to app/ and serve public/');

  // 7. Write production package.json
  let rootPkg = {};
  try {
    rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  } catch {}

  let frontendPkg = {};
  try {
    frontendPkg = JSON.parse(fs.readFileSync(path.join('frontend', 'package.json'), 'utf-8'));
  } catch {}

  const prodPkg = {
    name: rootPkg.name || 'esp-rc',
    version: frontendPkg.version || rootPkg.version || '1.0.0',
    private: true,
    main: 'server.js',
    type: 'commonjs',
    scripts: {
      start: 'node server.js'
    }
  };

  fs.writeFileSync(
    path.join(tempWorktreeDir, 'package.json'),
    JSON.stringify(prodPkg, null, 2) + '\n'
  );
  console.log('Created production package.json');

  // 8. Commit and Push
  console.log('\n🚀 4. Committing and pushing to origin/build...');
  run(`git -C "${tempWorktreeDir}" add -A`);

  const status = execSync(`git -C "${tempWorktreeDir}" status --porcelain`).toString().trim();
  if (status) {
    run(`git -C "${tempWorktreeDir}" commit -m "release: update production build [${new Date().toISOString()}]"`);
    console.log('\n✅ Successfully committed production build to "build" branch!');

    const shouldPush = !process.argv.includes('--no-push');
    if (shouldPush) {
      try {
        run(`git -C "${tempWorktreeDir}" push origin build`);
        console.log('\n🚀 Successfully pushed to origin/build!');
      } catch (pushErr) {
        console.warn('\n⚠️ Could not push to origin/build automatically. The local "build" branch has been updated.');
      }
    }
  } else {
    console.log('\nℹ️ No changes detected in build output (already up to date).');
  }

} catch (err) {
  console.error('\n❌ Build failed:', err.message);
  process.exitCode = 1;
} finally {
  console.log('\n🧹 Cleaning up build worktree...');
  cleanupWorktree(tempWorktreeDir);
}
