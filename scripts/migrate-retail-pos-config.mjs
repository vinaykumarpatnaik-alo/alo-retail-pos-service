#!/usr/bin/env node

import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";

const VALID_ENVS = new Set(["dev", "qa", "prod"]);
const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLES = [
  ["alo_pos_apps_session_data", "retail-${env}-pos-session-data"],
  ["pos_alo_access_feature_configs", "retail-${env}-pos-feature-configs"],
  ["pos_alo_access_exclusion_list", "retail-${env}-pos-exclusion-list"],
];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const env = required(args.env, "--env is required");
  if (!VALID_ENVS.has(env)) {
    throw new Error(`Unsupported --env "${env}". Expected one of: ${[...VALID_ENVS].join(", ")}`);
  }

  const config = args.config ? JSON.parse(await readFile(args.config, "utf8")) : {};
  const sourceProfile = args.sourceProfile ?? config.sourceProfile;
  const targetProfile = args.targetProfile ?? config.targetProfile;
  if (!sourceProfile || !targetProfile) {
    throw new Error("--source-profile and --target-profile are required, or set sourceProfile/targetProfile in --config");
  }

  const base = {
    env,
    sourceProfile,
    targetProfile,
    sourceRegion: args.sourceRegion ?? config.sourceRegion ?? DEFAULT_REGION,
    targetRegion: args.targetRegion ?? config.targetRegion ?? DEFAULT_REGION,
  };

  const tables = args.skipDefaultTables
    ? []
    : DEFAULT_TABLES.map(([sourceTable, targetTemplate]) => ({
        sourceTable,
        targetTable: renderTemplate(targetTemplate, {env}),
      }));
  const configuredTables = (config.tables ?? []).map((table) => ({
    sourceTable: required(table.sourceTable, "table.sourceTable is required"),
    targetTable: renderTemplate(required(table.targetTable, "table.targetTable is required"), {env}),
    sourceRegion: table.sourceRegion,
    targetRegion: table.targetRegion,
  }));
  const secrets = (config.secrets ?? []).map((secret) => ({
    sourceSecretId: required(secret.sourceSecretId, "secret.sourceSecretId is required"),
    targetSecretId: renderTemplate(required(secret.targetSecretId, "secret.targetSecretId is required"), {env}),
    sourceRegion: secret.sourceRegion,
    targetRegion: secret.targetRegion,
  }));
  const secretObjects = (config.secretObjects ?? []).map((secretObject) => ({
    targetSecretId: renderTemplate(required(secretObject.targetSecretId, "secretObject.targetSecretId is required"), {env}),
    targetRegion: secretObject.targetRegion,
    fields: required(secretObject.fields, "secretObject.fields is required").map((field) => ({
      name: required(field.name, "secretObject.field.name is required"),
      sourceSecretId: required(field.sourceSecretId, "secretObject.field.sourceSecretId is required"),
      sourceRegion: field.sourceRegion,
      optional: Boolean(field.optional),
    })),
  }));

  const selected = args.only ?? "all";
  const shouldApply = Boolean(args.apply);
  console.log(`${shouldApply ? "Applying" : "Dry run for"} retail POS ${env} migration`);

  if (selected === "all" || selected === "tables") {
    for (const table of [...tables, ...configuredTables]) {
      await copyTable({...base, ...table, apply: shouldApply});
    }
  }

  if (selected === "all" || selected === "secrets") {
    if (secrets.length === 0 && secretObjects.length === 0) {
      console.log("No secrets configured. Add explicit sourceSecretId -> targetSecretId mappings in --config.");
    }
    for (const secretObject of secretObjects) {
      await copySecretObject({...base, ...secretObject, apply: shouldApply});
    }
    for (const secret of secrets) {
      await copySecret({...base, ...secret, apply: shouldApply});
    }
  }
}

async function copyTable(options) {
  const sourceRegion = options.sourceRegion ?? DEFAULT_REGION;
  const targetRegion = options.targetRegion ?? DEFAULT_REGION;
  console.log(`Table ${options.sourceTable} -> ${options.targetTable}`);

  if (!options.apply) {
    await aws(["dynamodb", "describe-table", "--table-name", options.sourceTable], options.sourceProfile, sourceRegion);
    return;
  }

  let startKey;
  let copied = 0;
  do {
    const scanArgs = ["dynamodb", "scan", "--table-name", options.sourceTable, "--output", "json"];
    if (startKey) {
      scanArgs.push("--exclusive-start-key", JSON.stringify(startKey));
    }

    const scan = JSON.parse(await aws(scanArgs, options.sourceProfile, sourceRegion));
    const items = scan.Items ?? [];
    for (const chunk of chunkItems(items, 25)) {
      await batchWrite(options.targetTable, chunk, options.targetProfile, targetRegion);
      copied += chunk.length;
    }
    startKey = scan.LastEvaluatedKey;
  } while (startKey);

  console.log(`Copied ${copied} item(s) into ${options.targetTable}`);
}

async function copySecret(options) {
  const sourceRegion = options.sourceRegion ?? DEFAULT_REGION;
  const targetRegion = options.targetRegion ?? DEFAULT_REGION;
  console.log(`Secret ${options.sourceSecretId} -> ${options.targetSecretId}`);

  if (!options.apply) {
    await aws(["secretsmanager", "describe-secret", "--secret-id", options.sourceSecretId], options.sourceProfile, sourceRegion);
    return;
  }

  const secret = JSON.parse(
    await aws(["secretsmanager", "get-secret-value", "--secret-id", options.sourceSecretId, "--output", "json"], options.sourceProfile, sourceRegion),
  );

  const secretValue = secret.SecretString ? {SecretString: secret.SecretString} : {SecretBinary: secret.SecretBinary ?? ""};
  try {
    await writeSecretValue("put-secret-value", {SecretId: options.targetSecretId, ...secretValue}, options.targetProfile, targetRegion);
  } catch (error) {
    if (!String(error.message).includes("ResourceNotFoundException")) {
      throw error;
    }
    await writeSecretValue("create-secret", {Name: options.targetSecretId, ...secretValue}, options.targetProfile, targetRegion);
  }
  console.log(`Copied secret value into ${options.targetSecretId}`);
}

async function copySecretObject(options) {
  const targetRegion = options.targetRegion ?? DEFAULT_REGION;
  const sourceNames = options.fields.map((field) => field.sourceSecretId).join(", ");
  console.log(`Secret object [${sourceNames}] -> ${options.targetSecretId}`);

  if (!options.apply) {
    for (const field of options.fields) {
      await describeSecretField(field, options);
    }
    return;
  }

  const values = {};
  for (const field of options.fields) {
    const value = await readSecretField(field, options);
    if (value !== undefined) values[field.name] = value;
  }

  const secretValue = {SecretString: JSON.stringify(values)};
  try {
    await writeSecretValue("put-secret-value", {SecretId: options.targetSecretId, ...secretValue}, options.targetProfile, targetRegion);
  } catch (error) {
    if (!String(error.message).includes("ResourceNotFoundException")) {
      throw error;
    }
    await writeSecretValue("create-secret", {Name: options.targetSecretId, ...secretValue}, options.targetProfile, targetRegion);
  }
  console.log(`Copied secret object into ${options.targetSecretId}`);
}

async function describeSecretField(field, options) {
  try {
    await aws(["secretsmanager", "describe-secret", "--secret-id", field.sourceSecretId], options.sourceProfile, field.sourceRegion ?? options.sourceRegion ?? DEFAULT_REGION);
  } catch (error) {
    if (!field.optional) throw error;
    console.log(`Optional source secret not found, skipping dry-run check: ${field.sourceSecretId}`);
  }
}

async function readSecretField(field, options) {
  try {
    return await readSecretString(field.sourceSecretId, options.sourceProfile, field.sourceRegion ?? options.sourceRegion ?? DEFAULT_REGION);
  } catch (error) {
    if (!field.optional) throw error;
    console.log(`Optional source secret not found, skipping field ${field.name}: ${field.sourceSecretId}`);
    return undefined;
  }
}

async function readSecretString(secretId, profile, region) {
  const secret = JSON.parse(await aws(["secretsmanager", "get-secret-value", "--secret-id", secretId, "--output", "json"], profile, region));
  if (secret.SecretString) return secret.SecretString;
  return Buffer.from(secret.SecretBinary ?? "", "base64").toString("utf8");
}

async function writeSecretValue(command, payload, profile, region) {
  const directory = await mkdtemp(join(tmpdir(), "retail-pos-secret-"));
  const requestFile = join(directory, "secret.json");
  try {
    await writeFile(requestFile, JSON.stringify(payload));
    await aws(["secretsmanager", command, "--cli-input-json", `file://${requestFile}`], profile, region, {hideOutput: true});
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

async function batchWrite(tableName, items, profile, region) {
  const directory = await mkdtemp(join(tmpdir(), "retail-pos-migration-"));
  const requestFile = join(directory, "batch-write.json");
  try {
    await writeFile(requestFile, JSON.stringify({[tableName]: items.map((Item) => ({PutRequest: {Item}}))}));
    let response = JSON.parse(
      await aws(["dynamodb", "batch-write-item", "--request-items", `file://${requestFile}`, "--output", "json"], profile, region),
    );

    while (Object.keys(response.UnprocessedItems ?? {}).length > 0) {
      await writeFile(requestFile, JSON.stringify(response.UnprocessedItems));
      response = JSON.parse(
        await aws(["dynamodb", "batch-write-item", "--request-items", `file://${requestFile}`, "--output", "json"], profile, region),
      );
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

function aws(args, profile, region, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("aws", [...args, "--profile", profile, "--region", region], {stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(options.hideOutput ? "" : stdout);
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `aws ${args.join(" ")} failed with ${code}`));
      }
    });
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--skip-default-tables") args.skipDefaultTables = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--env") args.env = argv[++index];
    else if (arg === "--config") args.config = argv[++index];
    else if (arg === "--source-profile") args.sourceProfile = argv[++index];
    else if (arg === "--target-profile") args.targetProfile = argv[++index];
    else if (arg === "--source-region") args.sourceRegion = argv[++index];
    else if (arg === "--target-region") args.targetRegion = argv[++index];
    else if (arg === "--only") args.only = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.only && !["all", "tables", "secrets"].includes(args.only)) {
    throw new Error("--only must be one of: all, tables, secrets");
  }
  return args;
}

function renderTemplate(value, context) {
  return value.replaceAll("${env}", context.env);
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function printHelp() {
  console.log(`Usage:
  bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev --config docs/migration-config.example.json
  bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev --apply

Defaults:
  Dry-run mode is default. Add --apply to copy data.
  Default table copies:
    alo_pos_apps_session_data -> retail-\${env}-pos-session-data
    pos_alo_access_feature_configs -> retail-\${env}-pos-feature-configs
    pos_alo_access_exclusion_list -> retail-\${env}-pos-exclusion-list

Options:
  --only tables|secrets|all
  --skip-default-tables
  --source-region us-east-1
  --target-region us-east-1

Secret config:
  secrets[] copies one source secret to one target secret.
  secretObjects[] composes one JSON target secret from multiple source secrets.
`);
}
