#!/usr/bin/env bash
# Build the web app, upload it to the stack's web bucket, and invalidate CloudFront.
set -euo pipefail
STACK="${STACK:-doorcheck}"; REGION="${REGION:-us-east-2}"
out() { aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" --output text \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue"; }
BUCKET="$(out WebBucketName)"; DIST="$(out DistributionId)"; APP="$(out AppUrl)"
cd "$(dirname "$0")/../web"
npm run build
aws s3 sync dist "s3://$BUCKET/" --delete --region "$REGION" \
  --cache-control "public,max-age=31536000,immutable" --exclude index.html
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --region "$REGION" --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/index.html" "/" >/dev/null
echo "Web app: $APP"
