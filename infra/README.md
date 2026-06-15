# Infrastructure

Terraform for this service lives in the central `alo-terraform` repo:

```text
retail/roles/alo-retail-pos-service
```

This app repo owns deployable code and CI/CD. The Terraform repo owns AWS state, domains, CDN, IAM, Lambda, API Gateway, SQS, DynamoDB, and Secrets Manager declarations.

Expected Terraform projects:

- `alo-retail-pos-service-dev`
- `alo-retail-pos-service-qa`
- `alo-retail-pos-service-prod`

Runtime infrastructure:

- Lambda-service runtime in `us-east-1` and `us-west-2` behind API Gateway and CloudFront.
- DynamoDB global tables for Shopify sessions, POS feature configs, and POS exclusion lists. HRIS owns employee-order history and spend state.
- Regional SQS queues and DLQs for employee-order events.
- Regional worker Lambdas consuming regional employee-order queues.

No ECS service is required. The full Shopify order processor is not migrated, but retail employee discount order tracking is handled by EventBridge, SQS, the POS worker, and existing HRIS employee-order APIs.
