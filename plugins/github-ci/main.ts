// GitHub CI Agent installer.
//
// This configures the code-review agent against an *already-created* GitHub App
// AND an *already-created* agent + workspace (both created in the dashboard). The
// frontend owns agent/workspace creation; this plugin only:
//   - stores the GitHub App credentials as secrets,
//   - builds the review workflow and attaches it to the given agent, and
//   - optionally seeds review guidelines into the agent's workspace.
//
// The App's installation ID is NOT collected: the workflow reads it from each
// webhook payload at runtime (`{{ body "installation.id" }}`), so one install
// serves every repository/installation of the App.

import { installer, secrets, workflows, agents, workspaces, files } from "servflow:sdk";

// Secret name suffixes, prefixed with the install's instanceName. The App ID is
// not sensitive (it is the JWT issuer, visible in the App's settings), so it is
// inlined into the workflow rather than stored as a secret.
const SUFFIX_APP_PEM = "_app_pem";
const SUFFIX_WEBHOOK_SECRET = "_webhook_secret";

// Where guidelines land in the agent's workspace.
const GUIDELINES_PATH = "review-guidelines.md";

console.error("GitHub CI Agent — reading install inputs...");

const {
  agentId,
  workspaceId,
  guidelines,
  appId,
  privateKey,
  webhookSecret,
  webhookPath,
  integrationId,
  instanceName,
} = await installer.inputs();

// Validate inputs.
if (!agentId || agentId.trim() === "") {
  throw new Error("Agent ID is required");
}
const workspaceIdNum = Number(workspaceId);
if (!workspaceId || !Number.isInteger(workspaceIdNum) || workspaceIdNum <= 0) {
  throw new Error("Workspace ID is required and must be a positive integer");
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
  throw new Error("AI Integration ID is required");
}
if (!instanceName || instanceName.trim() === "") {
  throw new Error("Instance Name is required");
}

if (!(await agents.exists(agentId.trim()))) {
  throw new Error(`Agent ${agentId} does not exist — create it in the dashboard first`);
}

const prefix = instanceName.trim();
const appPemSecretName = prefix + SUFFIX_APP_PEM;
const webhookSecretName = prefix + SUFFIX_WEBHOOK_SECRET;

// Store credentials as secrets from their input references — the host reads the
// content (the PEM file's bytes, the webhook secret's value) and stores it
// encrypted; the plaintext never enters this plugin. There is no secrets.update
// yet, so an existing secret is reused as-is (a warning is logged); pick a
// different instanceName to install a second agent or rotate credentials.
async function ensureSecret(name: string, ref: string, description: string): Promise<void> {
  if (await secrets.exists(name)) {
    console.error(`Secret ${name} already exists — keeping its current value.`);
    return;
  }
  await secrets.create(name, ref, description);
  console.error(`Stored secret ${name}.`);
}

console.error("Storing GitHub App credentials...");
await ensureSecret(appPemSecretName, privateKey, `GitHub App private key (PEM) for ${prefix}`);
await ensureSecret(webhookSecretName, webhookSecret, `GitHub App webhook secret for ${prefix}`);

// Optionally seed review guidelines into the agent's workspace. `guidelines` is
// a file-field reference; the host opens the file and writes its bytes — the
// plugin never handles the bytes itself.
if (guidelines) {
  console.error(`Writing review guidelines to workspace ${workspaceIdNum}...`);
  await workspaces.createEntry(workspaceIdNum, GUIDELINES_PATH, guidelines);
  console.error(`Wrote ${GUIDELINES_PATH}.`);
}

// Stamp the workflow template with this install's values.
console.error("Building workflow from template...");
let workflowYaml = await files.read("workflows/github-ci.yaml");
workflowYaml = workflowYaml
  .replace(/<< \.WebhookPath >>/g, webhookPath)
  .replace(/<< \.IntegrationID >>/g, integrationId)
  .replace(/<< \.AppID >>/g, appId.trim())
  .replace(/<< \.AppPEMSecret >>/g, appPemSecretName)
  .replace(/<< \.WebhookSecretName >>/g, webhookSecretName);

const workflowId = await workflows.create("GitHub CI Agent", workflowYaml, true);
console.error(`Workflow created: ${workflowId}`);

// Attach the workflow to the existing agent as its webhook entrypoint.
await agents.addConfig(agentId.trim(), workflowId, "webhook");

console.error("");
console.error("=".repeat(50));
console.error("GitHub CI Agent installed successfully!");
console.error("=".repeat(50));
console.error(`  Agent ID:    ${agentId}`);
console.error(`  Workflow ID: ${workflowId}`);
console.error(`  Webhook URL: <your-host>${webhookPath}`);
console.error("");
console.error("Next steps:");
console.error("  1. Restart ServFlow Pro to load the new configuration.");
console.error(`  2. Ensure the GitHub App's webhook points at <your-host>${webhookPath}.`);
console.error("  3. Open a pull request to trigger a review.");
console.error("");
