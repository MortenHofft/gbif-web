#!/usr/bin/env bash
#
# Start the gbif-org SSR server against the static mock, ready for the load
# script. Run this from the package root: packages/gbif-org.
#
#   bash scripts/loadtest/start.sh
#
# It will:
#   1. copy scripts/loadtest/env.loadtest -> .env (unless --keep-env)
#   2. build the site if dist/ is missing (or with --build to force)
#   3. start the mock API on :4000 and the SSR server on :3000
#
# Both processes are stopped together on Ctrl-C. Once it is up, in another shell:
#   npm run loadtest -- --target=http://localhost:3000 --path='/taxon/{key}' --rate=30
#
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> packages/gbif-org

KEEP_ENV=0
FORCE_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --keep-env) KEEP_ENV=1 ;;
    --build) FORCE_BUILD=1 ;;
  esac
done

if [ "$KEEP_ENV" -eq 0 ]; then
  cp scripts/loadtest/env.loadtest .env
  echo "Copied scripts/loadtest/env.loadtest -> .env"
fi

if [ "$FORCE_BUILD" -eq 1 ] || [ ! -d dist/gbif/server ]; then
  echo "Building gbif-org (this takes a few minutes)..."
  npm run build
fi

# Start the mock first so the server's startup self-fetches resolve.
PORT=4000 node scripts/mockApi.mjs &
MOCK_PID=$!

# Give the mock a moment, then start the SSR server in production mode.
sleep 1
NODE_ENV=production PORT=3000 node gbif/server.js &
SERVER_PID=$!

cleanup() {
  echo
  echo "Stopping (mock=$MOCK_PID server=$SERVER_PID)..."
  kill "$MOCK_PID" "$SERVER_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo
echo "================================================================"
echo " gbif-org (mock-backed) is starting:"
echo "   site:  http://localhost:3000/taxon/4CGXP   (Panthera leo)"
echo "   mock:  http://localhost:4000"
echo
echo " Load test it from another shell:"
echo "   npm run loadtest -- --target=http://localhost:3000 \\"
echo "       --path='/taxon/{key}' --rate=30 --search='datasetKey=7ddf754f-d193-4cc9-b351-99906754a03b'"
echo "================================================================"
echo

wait
