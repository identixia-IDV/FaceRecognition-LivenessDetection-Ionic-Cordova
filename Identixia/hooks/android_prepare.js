#!/usr/bin/env node
/**
 * Cordova after_prepare / before_build / before_run:
 * - Sync Identixia Android sources into plugins/ + platforms/ (Cordova does not
 *   refresh source-file copies when the local plugin changes).
 * - Disable Jetifier (huge AARs OOM Jetifier), raise heap, fix splash colors.
 */
const fs = require('fs');
const path = require('path');


function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}


function syncAndroidSources(projectRoot) {
  const identixiaAndroid = path.join(
    projectRoot,
    'Identixia',
    'src',
    'android'
  );
  if (!fs.existsSync(identixiaAndroid)) return;


  const files = ['FaceRecognitionSdkPlugin.kt', 'ImageUtils.kt'];
  const pluginDest = path.join(
    projectRoot,
    'plugins',
    'face-recognition-cordova',
    'src',
    'android'
  );
  const platformDest = path.join(
    projectRoot,
    'platforms',
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'facerecognitionsdk'
  );


  let copied = 0;
  for (const name of files) {
    const src = path.join(identixiaAndroid, name);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(path.dirname(pluginDest))) {
      copyFile(src, path.join(pluginDest, name));
      copied += 1;
    }
    if (fs.existsSync(path.dirname(platformDest))) {
      copyFile(src, path.join(platformDest, name));
      copied += 1;
    }
  }
  if (copied > 0) {
    console.log(
      `[face-recognition-cordova] Synced ${files.join(', ')} → plugins/platforms`
    );
  }
}


function syncPacks(projectRoot) {
  const packsSrc = path.join(
    projectRoot,
    'Identixia',
    'src',
    'android',
    'libs',
    'databases'
  );
  if (!fs.existsSync(packsSrc)) return;

  const names = fs
    .readdirSync(packsSrc)
    .filter((n) => n.endsWith('.xdb'));
  if (names.length === 0) return;

  const dests = [
    path.join(
      projectRoot,
      'plugins',
      'face-recognition-cordova',
      'src',
      'android',
      'libs',
      'databases'
    ),
    path.join(
      projectRoot,
      'platforms',
      'android',
      'app',
      'src',
      'main',
      'assets',
      'facerecognitionsdk'
    ),
  ];

  let copied = 0;
  for (const dest of dests) {
    if (!fs.existsSync(path.dirname(dest)) && !dest.includes('plugins')) {
      // platforms may not exist yet
      if (!fs.existsSync(path.join(projectRoot, 'platforms', 'android'))) continue;
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const name of names) {
      copyFile(path.join(packsSrc, name), path.join(dest, name));
      copied += 1;
    }
  }
  if (copied > 0) {
    console.log(
      `[face-recognition-cordova] Synced ${names.length} recognition*.xdb → plugins/platforms assets`
    );
  }
}


function prepareAndroid(projectRoot) {
  const androidDir = path.join(projectRoot, 'platforms', 'android');
  if (!fs.existsSync(androidDir)) return;


  syncAndroidSources(projectRoot);
  syncPacks(projectRoot);


  const gp = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gp)) {
    let text = fs.readFileSync(gp, 'utf8');
    const ensure = (key, value) => {
      const re = new RegExp(`^\\s*${key}=.*$`, 'm');
      if (re.test(text)) text = text.replace(re, `${key}=${value}`);
      else text += `\n${key}=${value}\n`;
    };
    ensure('android.useAndroidX', 'true');
    ensure('android.enableJetifier', 'false');
    ensure('org.gradle.jvmargs', '-Xmx4096m -Dfile.encoding=UTF-8');
    fs.writeFileSync(gp, text);
    console.log('[face-recognition-cordova] gradle.properties: Jetifier off, heap 4g');
  }


  const colors = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'colors.xml');
  if (fs.existsSync(colors)) {
    let text = fs.readFileSync(colors, 'utf8');
    const fixed = text.replace(/>0x([0-9a-fA-F]{8})</g, '>#$1<');
    if (fixed !== text) {
      fs.writeFileSync(colors, fixed);
      console.log('[face-recognition-cordova] Fixed colors.xml hex format');
    }
  }
}


module.exports = function (ctx) {
  const projectRoot =
    (ctx && ctx.opts && ctx.opts.projectRoot) ||
    process.argv[2] ||
    process.cwd();
  prepareAndroid(projectRoot);
};


if (require.main === module) {
  prepareAndroid(process.argv[2] || process.cwd());
}
