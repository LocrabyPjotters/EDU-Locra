#!/bin/bash
set -e

echo "=== Building Locra Server & Client ==="
cd "/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/public/locra-server"
npm run build

echo "=== Preparing Release Folder ==="
rm -rf locra-release
mkdir -p locra-release
mkdir -p locra-release/server
mkdir -p locra-release/client

cp package.json package-lock.json locra-release/
cp -r server/dist locra-release/server/
cp server/package.json locra-release/server/
cp -r server/prisma locra-release/server/
cp -r client/dist locra-release/client/
cp client/package.json locra-release/client/
cp -r cli locra-release/cli

cat << 'EOF' > locra-release/README.md
# Locra
Welcome to Locra!

## Installation
1. Make sure you have Node.js installed.
2. Run `npm install` in this directory.
3. Start the server with `npm start`.
EOF

echo "=== Creating Zip Archive ==="
rm -f locra-release.zip
zip -r locra-release.zip locra-release

echo "=== Distributing to Websites ==="
cp locra-release.zip "/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/dev/website/public/locra-release.zip"
cp locra-release.zip "/Users/p.oosterling/Site/Pjotters/RowMatch 2.0/Locra/dev/edu.web/public/locra-release.zip"

echo "=== Done! ==="
