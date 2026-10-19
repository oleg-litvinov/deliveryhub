STACK ?= doorcheck
REGION ?= us-east-2
PROFILE ?= couchlink
export AWS_PROFILE := $(PROFILE)

.PHONY: test build deploy outputs web deploy-web

test:        ## Backend unit tests (address matching, decisions, box policy, webhook signing, barcodes)
	cd backend && npm test

build:       ## Bundle Lambda handlers into backend/dist
	cd backend && npm run build

deploy: build ## Deploy backend + CloudFront (pass PARAMS="RingWebhookSecret=... ...")
	sam deploy -t infra/template.yaml --stack-name $(STACK) --region $(REGION) --resolve-s3 \
	  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
	  $(if $(PARAMS),--parameter-overrides $(PARAMS))

outputs:     ## Show stack outputs (AppUrl, RingWebhookUrl, ...)
	aws cloudformation describe-stacks --stack-name $(STACK) --region $(REGION) \
	  --query "Stacks[0].Outputs" --output table

web:         ## Web app dev server on http://localhost:5173 (proxies /api to the deployed stack)
	cd web && npm run dev

deploy-web:  ## Build the web app, upload to S3, invalidate CloudFront
	STACK=$(STACK) REGION=$(REGION) scripts/deploy_web.sh
