#!/usr/bin/env node
/**
 * before_plugin_install: if the Android AAR and iOS frameworks are already
 * in this plugin, leave them. Otherwise try the v1.0.0 GitHub Release.
 * A failed download does not delete files that are already present.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const aar = path.join(root, 'src', 'android', 'facerecognitionsdk.aar');

function present(file) {
  try {
    return fs.statSync(file).size > 1024;
  } catch (e) {
    return false;
  }
}

if (present(aar)) {
  process.exit(0);
}

const url =
  'https://github.com/identixia-IDV/FaceRecognition-LivenessDetection-Android/releases/download/v1.0.0/facerecognitionsdk-android.zip';
const dest = path.join(root, 'src', 'android', 'facerecognitionsdk-android.zip');

function download(from, to) {
  return new Promise((resolve) => {
    const req = https.get(from, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location, to).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(false);
        return;
      }
      const out = fs.createWriteStream(to);
      res.pipe(out);
      out.on('finish', () => resolve(true));
      out.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

download(url, dest).then(() => process.exit(0));
