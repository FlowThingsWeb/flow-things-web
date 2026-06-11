#!/bin/bash
# Flow Things — deploy helper
# Uso: ./deploy.sh "mensaje del commit"

set -e

REPO="/Users/lucasbarman/Desktop/Flow Things/flow-things-web"
cd "$REPO"

# 1. Limpiar lock files si existen
for lock in .git/index.lock .git/HEAD.lock .git/COMMIT_EDITMSG.lock; do
  [ -f "$lock" ] && rm -f "$lock" && echo "🔓 Borré $lock"
done

# 2. Stage todos los archivos del proyecto (forzado para pasar .gitignore)
git add -f \
  app/ \
  components/ \
  lib/ \
  types/ \
  public/ \
  *.js *.ts *.json *.css *.mjs 2>/dev/null || true

# 3. Commit solo si hay cambios
MSG="${1:-deploy}"
if git diff --cached --quiet; then
  echo "⚪ Sin cambios para commitear"
else
  git commit -m "$MSG"
  echo "✅ Commit: $MSG"
fi

# 4. Push
git push origin main
echo "🚀 Deploy listo"
