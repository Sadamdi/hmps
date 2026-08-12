#!/usr/bin/env node
/**
 * Template auto-deploy — salin ke /root/auto-deploy.js via ops/install-auto-deploy.sh
 * Lihat docs/ops/_auto-deploy.js (salinan lokal gitignored) untuk edit di laptop.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = '/var/www/hmps';
const BRANCH = 'main';
const CHECK_INTERVAL = 30000;
const LOCK_FILE = '/tmp/hmps-auto-deploy.lock';
const DEPLOY_SCRIPT = path.join(PROJECT_PATH, 'ops', 'deploy-server.sh');
const MEDIA_PUSH_SCRIPT = path.join(PROJECT_PATH, 'ops', 'auto-push-media.sh');
const BUILT_HEAD_FILE = path.join(PROJECT_PATH, '.deploy-built-head');

let busy = false;

function log(...args) {
	console.log(...args);
}

function childEnv() {
	const nvmBin = '/root/.nvm/versions/node/v24.15.0/bin';
	const pathEnv = `${nvmBin}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH || ''}`;
	return {
		...process.env,
		PATH: pathEnv,
		NVM_DIR: process.env.NVM_DIR || '/root/.nvm',
		NPM_CONFIG_PRODUCTION: 'false',
		NODE_ENV: 'development',
	};
}

function runCommand(command, cwd = PROJECT_PATH) {
	return new Promise((resolve, reject) => {
		log(`🔄 Running: ${command}`);
		exec(
			command,
			{ cwd, env: childEnv(), maxBuffer: 40 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (stdout) log(stdout.trimEnd());
				if (stderr) console.warn(stderr.trimEnd());
				if (error) {
					console.error(`❌ Error: ${error.message}`);
					reject(error);
					return;
				}
				log(`✅ Success`);
				resolve(stdout);
			},
		);
	});
}

function readBuiltHead() {
	try {
		return fs.readFileSync(BUILT_HEAD_FILE, 'utf8').trim();
	} catch {
		return '';
	}
}

function acquireLock() {
	try {
		const fd = fs.openSync(LOCK_FILE, 'wx');
		fs.writeFileSync(fd, String(process.pid));
		fs.closeSync(fd);
		return true;
	} catch {
		try {
			const pid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
			if (pid && !Number.isNaN(pid)) {
				try {
				 process.kill(pid, 0);
				 return false;
				} catch {
					fs.unlinkSync(LOCK_FILE);
					return acquireLock();
				}
			}
		} catch {
			/* ignore */
		}
		return false;
	}
}

function releaseLock() {
	try {
		fs.unlinkSync(LOCK_FILE);
	} catch {
		/* ignore */
	}
}

async function pushMedia() {
	if (!fs.existsSync(MEDIA_PUSH_SCRIPT)) return;
	log('📤 Check / push media production → GitHub...');
	try {
		await runCommand(`bash ${MEDIA_PUSH_SCRIPT}`, PROJECT_PATH);
	} catch (error) {
		console.error('❌ Media push failed (will retry next cycle):', error.message);
	}
}

async function deployFromGithub(reason) {
	log(`🚀 Deploy (${reason}) via ops/deploy-server.sh ...`);
	if (!fs.existsSync(DEPLOY_SCRIPT)) {
		throw new Error(`Missing ${DEPLOY_SCRIPT}`);
	}
	await runCommand(`bash ${DEPLOY_SCRIPT}`, PROJECT_PATH);
	log('✅ Deployment completed successfully!');
}

async function runtimeChangedSinceBuilt(built, head) {
	if (!built) return true;
	if (head === built) return false;
	try {
		const diff = String(
			await runCommand(
				`git diff --name-only ${built} ${head} -- client/ server/ shared/ db/ public/ package-lock.json vite.config.ts tailwind.config.js postcss.config.js tsconfig.json index.html`,
			),
		).trim();
		return diff.length > 0;
	} catch {
		return true;
	}
}

async function shouldDeploy(commitsBehind) {
	if (commitsBehind > 0) {
		return { needed: true, reason: `origin/${BRANCH} ahead by ${commitsBehind}` };
	}
	const head = String(await runCommand('git rev-parse HEAD')).trim();
	const built = readBuiltHead();
	if (!built) return { needed: true, reason: 'missing .deploy-built-head marker' };
	if (head === built) return { needed: false, reason: 'code + dist in sync' };
	if (await runtimeChangedSinceBuilt(built, head)) {
		return {
			needed: true,
			reason: `dist stale (runtime changed ${built.slice(0, 7)} → ${head.slice(0, 7)})`,
		};
	}
	return {
		needed: true,
		reason: `sync ops/docs (${built.slice(0, 7)} → ${head.slice(0, 7)}, no runtime diff)`,
	};
}

async function tick() {
	if (busy) return;
	if (!acquireLock()) return;
	busy = true;
	try {
		await pushMedia();
		await runCommand('git fetch origin');
		const result = await runCommand(`git rev-list HEAD..origin/${BRANCH} --count`);
		const commitsBehind = parseInt(String(result || '0').trim(), 10) || 0;
		if (commitsBehind > 0) log(`🆕 origin/${BRANCH} ahead by ${commitsBehind}`);
		const { needed, reason } = await shouldDeploy(commitsBehind);
		if (needed) await deployFromGithub(reason);
		else log(`✅ ${reason}`);
	} catch (error) {
		console.error('❌ Tick failed (will retry next cycle):', error.message);
	} finally {
		busy = false;
		releaseLock();
	}
}

log('🚀 Auto-Deploy Started (media push + pull/deploy + stale dist retry)');
tick();
setInterval(tick, CHECK_INTERVAL);
