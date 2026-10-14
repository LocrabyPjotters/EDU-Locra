#!/bin/bash
echo "===================================="
echo "    🚀 Start Locra System Update    "
echo "===================================="

# If run from parent directory that has apps/locra-core
if [ -d "apps/locra-core" ]; then
  cd apps/locra-core
fi

# Run update workflow
npm run update

echo "===================================="
echo "    ✅ Locra Update Voltooid!       "
echo "===================================="
