// GitHub PR Reviewer installer.
//
// Configures the PR review agent against an *already-created* GitHub App AND an
// *already-created* agent (created in the dashboard). The frontend owns agent
// creation; this plugin only:
//   - stores the GitHub App credentials as secrets, and
//   - builds the four review workflows and attaches them to the given agent.
//
// The bot is HTTP-only: it reviews the PR diff + conversation via the GitHub
// API and never clones the repo, so it needs no workspace and no shell access.
//
// Signature verification happens in the `github_webhook` entry handler (host
// middleware) — the webhook workflow's plan only runs for authentic deliveries.
// This requires a ServFlow Pro build that ships the handler.
//
// The App's installation ID is NOT collected: the workflows read it from each
// webhook payload at runtime (`{{ body "installation.id" }}`), so one install
// serves every repository/installation of the App.

import { installer, secrets, workflows, agents, files } from "servflow:sdk";

// Secret name suffixes, prefixed with the install's instanceName. The App ID is
// not sensitive (it is the JWT issuer, visible in the App's settings), so it is
// inlined into the workflows rather than stored as a secret.
const SUFFIX_APP_PEM = "_app_pem";
const SUFFIX_WEBHOOK_SECRET = "_webhook_secret";

console.error("GitHub PR Reviewer — reading install inputs...");

const {
  agentId,
  appId,
  privateKey,
  webhookSecret,
  webhookPath,
  instanceName,
} = installer.inputs();

// The AI integration is a first-class resource the caller resolved before this
// plugin ran (an existing one or a freshly created one); we receive only its id,
// keyed by the manifest's `integrations` requirement key. We never see the AI
// credentials.
const { ai: integrationId } = installer.integrations();

// Validate inputs.
if (!agentId || agentId.trim() === "") {
  throw new Error("Agent ID is required");
}
if (!appId || !/^\d+$/.test(appId.trim())) {
  throw new Error("GitHub App ID is required and must be numeric");
}
// privateKey is a file field: the plugin receives only a reference, never the PEM
// bytes, so it can only check that a file was supplied — the host reads and
// stores the contents.
if (!privateKey) {
  throw new Error("Private Key (PEM) file is required");
}
if (!webhookSecret || webhookSecret.trim() === "") {
  throw new Error("Webhook Secret is required");
}
if (!webhookPath || !webhookPath.startsWith("/")) {
  throw new Error("Webhook Path must start with '/'");
}
if (!integrationId || integrationId.trim() === "") {
  throw new Error("An AI integration is required");
}
if (!instanceName || instanceName.trim() === "") {
  throw new Error("Instance Name is required");
}

if (!agents.exists(agentId.trim())) {
  throw new Error(`Agent ${agentId} does not exist — create it in the dashboard first`);
}

// The instance name prefixes the secrets AND the four workflow config_ids, so a
// second install needs a different instanceName (a duplicate config_id is
// rejected by the store's unique index — that collision is the guard).
const prefix = instanceName.trim();
const appPemSecretName = prefix + SUFFIX_APP_PEM;
const webhookSecretName = prefix + SUFFIX_WEBHOOK_SECRET;

// Store credentials as secrets from their input references — the host reads the
// content (the PEM file's bytes, the webhook secret's value) and stores it
// encrypted; the plaintext never enters this plugin. There is no secrets.update
// yet, so an existing secret is reused as-is (a warning is logged); pick a
// different instanceName to install a second agent or rotate credentials.
function ensureSecret(name: string, ref: string, description: string): void {
  if (secrets.exists(name)) {
    console.error(`Secret ${name} already exists — keeping its current value.`);
    return;
  }
  secrets.create(name, ref, description);
  console.error(`Stored secret ${name}.`);
}

console.error("Storing GitHub App credentials...");
ensureSecret(appPemSecretName, privateKey, `GitHub App private key (PEM) for ${prefix}`);
ensureSecret(webhookSecretName, webhookSecret, `GitHub App webhook secret for ${prefix}`);

// Stamp a workflow template with this install's values.
const stamps: Record<string, string> = {
  "<< .Prefix >>": prefix,
  "<< .WebhookPath >>": webhookPath,
  "<< .WebhookSecretName >>": webhookSecretName,
  "<< .AppID >>": appId.trim(),
  "<< .AppPEMSecret >>": appPemSecretName,
  "<< .IntegrationID >>": integrationId.trim(),
};

function stamp(templatePath: string): string {
  let yaml = files.read(templatePath);
  for (const [placeholder, value] of Object.entries(stamps)) {
    yaml = yaml.split(placeholder).join(value);
  }
  return yaml;
}

// Create the four workflows: the three trigger callees first, then the webhook
// that dispatches into them. callworkflow targets are resolved at runtime, so
// order is cosmetic, but this reads in dependency order.
console.error("Creating workflows...");
const fetchContextId = workflows.create(`${prefix}-fetch-context`, stamp("workflows/fetch-context.yaml"), true);
console.error(`  ${prefix}-fetch-context created (${fetchContextId})`);
const reviewId = workflows.create(`${prefix}-review`, stamp("workflows/review.yaml"), true);
console.error(`  ${prefix}-review created (${reviewId})`);
const respondId = workflows.create(`${prefix}-respond`, stamp("workflows/respond.yaml"), true);
console.error(`  ${prefix}-respond created (${respondId})`);
const webhookId = workflows.create(`${prefix}-webhook`, stamp("workflows/webhook.yaml"), true);
console.error(`  ${prefix}-webhook created (${webhookId})`);

// Attach everything to the agent: the webhook as its HTTP entrypoint, the three
// trigger workflows as tasks (they have no cron, so they are never scheduled —
// task attachment just makes the agent own them).
console.error("Attaching workflows to agent...");
agents.addConfig(agentId.trim(), webhookId, "webhook");
agents.addConfig(agentId.trim(), reviewId, "task");
agents.addConfig(agentId.trim(), respondId, "task");
agents.addConfig(agentId.trim(), fetchContextId, "task");

console.error("");
console.error("=".repeat(50));
console.error("GitHub PR Reviewer installed successfully!");
console.error("=".repeat(50));
console.error(`  Agent ID:     ${agentId}`);
console.error(`  Workflows:    ${prefix}-webhook, ${prefix}-review, ${prefix}-respond, ${prefix}-fetch-context`);
console.error(`  Webhook URL:  <your-host>${webhookPath}`);
console.error("");
console.error("Next steps:");
console.error("  1. Restart ServFlow Pro to load the new configuration.");
console.error(`  2. Point the GitHub App's webhook at <your-host>${webhookPath}.`);
console.error("     Required App permissions: Pull requests (read/write),");
console.error("     Issues (read/write), Contents (read), Metadata (read).");
console.error("     Required webhook events: Pull request, Issue comment.");
console.error("  3. Open a pull request to trigger a review, or mention");
console.error("     @servflow in a PR comment to get a reply.");
console.error("");
