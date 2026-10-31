#!/usr/bin/env bash
# Deploys logina-dev with the deployer's own gcloud and firebase logins. Run from the repo root.
set -euo pipefail

PROJECT_ID=${PROJECT_ID:-logina-dev}
REGION=asia-southeast1
REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/logina
SKIP_SMOKE=${1:-}

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi
pnpm check

if [ -f .env.deploy ]; then
  set -a
  . ./.env.deploy
  set +a
fi

SHA=$(git rev-parse --short HEAD)
INVOKER=logina-tasks-invoker@$PROJECT_ID.iam.gserviceaccount.com
SHARED="GCP_PROJECT_ID=$PROJECT_ID,MATERIALS_BUCKET=$PROJECT_ID-materials,DEMO_MODE=true,DEMO_LOCALE=en"

WORKER_ENV="$SHARED,SEEDED_AI=false,LIVE_AI=false,VERTEX_LOCATION=global"
WORKER_ENV="$WORKER_ENV,READER_MODEL=gemini-4-argon,GENERATOR_MODEL=gemini-4-argon,XREASON_MODEL=gemini-4-argon,TRANSLATOR_MODEL=gemini-4-argon"
if [ -n "${RESEARCH_SHEET_ID:-}" ]; then
  WORKER_ENV="$WORKER_ENV,RESEARCH_SHEET_ID=$RESEARCH_SHEET_ID"
fi

API_ENV="$SHARED,NO_SIGN_IN=true,RESEARCH_ENABLED=true,PARTICIPANT_TYPE=judge,LIVE_UPLOADS_PER_DAY=100,TRUSTED_PROXY_HOPS=${TRUSTED_PROXY_HOPS:-2}"
API_ENV="$API_ENV,TASKS_QUEUE=logina-jobs,EXPORT_QUEUE=logina-export,TASKS_LOCATION=$REGION,TASKS_INVOKER_SA=$INVOKER"
API_ENV="$API_ENV,LIMIT_NEW_SESSIONS_ADDRESS_HOUR=300,LIMIT_API_SESSION_MINUTE=600,LIMIT_API_ADDRESS_MINUTE=5000"

gcloud builds submit --project "$PROJECT_ID" --config apps/worker/cloudbuild.yaml --substitutions=_TAG="$SHA" .
gcloud builds submit --project "$PROJECT_ID" --config apps/api/cloudbuild.yaml --substitutions=_TAG="$SHA" .

gcloud run deploy worker --project "$PROJECT_ID" --region "$REGION" --image "$REGISTRY/worker:$SHA" \
  --service-account "logina-worker@$PROJECT_ID.iam.gserviceaccount.com" \
  --no-allow-unauthenticated --timeout 1800 --set-env-vars "$WORKER_ENV"
WORKER_URL=$(gcloud run services describe worker --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')

gcloud run deploy api --project "$PROJECT_ID" --region "$REGION" --image "$REGISTRY/api:$SHA" \
  --service-account "logina-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --min-instances 1 --allow-unauthenticated --set-env-vars "$API_ENV,WORKER_URL=$WORKER_URL"

pnpm --filter @logina/web build
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage --project "$PROJECT_ID"

if [ "$SKIP_SMOKE" != "--skip-smoke" ]; then
  FIREBASE_WEB_API_KEY=$(sed -n 's/^VITE_FIREBASE_API_KEY=//p' apps/web/.env.production) pnpm smoke --base "https://$PROJECT_ID.web.app"
fi
echo "Deployed $SHA."
