// GitHub CI Agent installer.
//
// This installs the code-review agent against an *already-created* GitHub App.
// The user supplies the App's credentials (App ID, private key, webhook secret);
// we store them as secrets and stamp them into the workflow template. There is
// no GitHub App manifest / OAuth callback flow — the host's interactive callback
// machinery is intentionally not used here.
//
// The App's installation ID is NOT collected: the workflow reads it from each
// webhook payload at runtime (`{{ body "installation.id" }}`), so one install
// serves every repository/installation of the App.

import { installer, secrets, workflows, agents, files } from "servflow:sdk";

// Secret name suffixes, prefixed with the install's instanceName.
const SUFFIX_APP_ID = "_app_id";
const SUFFIX_APP_PEM = "_app_pem";
const SUFFIX_WEBHOOK_SECRET = "_webhook_secret";

console.error("GitHub CI Agent — collecting GitHub App credentials...");

const { appId, privateKey, webhookSecret, webhookPath, integrationId, instanceName } =
  await installer.requestInput([
    { name: "appId", label: "GitHub App ID", type: "text", required: true },
    { name: "privateKey", label: "Private Key (PEM)", type: "password", required: true },
    { name: "webhookSecret", label: "Webhook Secret", type: "password", required: true },
    { name: "webhookPath", label: "Webhook Path", type: "text", required: true, default: "/webhooks/github-ci" },
    { name: "integrationId", label: "AI Integration ID", type: "text", required: true },
    { name: "instanceName", label: "Instance Name", type: "text", required: true, default: "github-ci" },
  ]);

// Validate inputs.
if (!appId || !/^\d+$/.test(appId.trim())) {
  throw new Error("GitHub App ID is required and must be numeric");
}
if (!privateKey || !privateKey.includes("-----BEGIN")) {
  throw new Error("Private Key must be a PEM-encoded key (load it from a file with @path, e.g. @your-app.private-key.pem)");
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

const prefix = instanceName.trim();
const appIdSecretName = prefix + SUFFIX_APP_ID;
const appPemSecretName = prefix + SUFFIX_APP_PEM;
const webhookSecretName = prefix + SUFFIX_WEBHOOK_SECRET;

// Store credentials as secrets. There is no secrets.update yet, so an existing
// secret is reused as-is (a warning is logged); pick a different instanceName to
// install a second agent or to rotate credentials cleanly.
async function ensureSecret(name: string, value: string, description: string): Promise<void> {
  if (await secrets.exists(name)) {
    console.error(`Secret ${name} already exists — keeping its current value.`);
    return;
  }
  await secrets.create(name, value, description);
  console.error(`Stored secret ${name}.`);
}

console.error("Storing GitHub App credentials...");
await ensureSecret(appIdSecretName, appId.trim(), `GitHub App ID for ${prefix}`);
await ensureSecret(appPemSecretName, privateKey, `GitHub App private key (PEM) for ${prefix}`);
await ensureSecret(webhookSecretName, webhookSecret, `GitHub App webhook secret for ${prefix}`);

// Stamp the workflow template with this install's values.
console.error("Building workflow from template...");
let workflowYaml = await files.read("workflows/github-ci.yaml");
workflowYaml = workflowYaml
  .replace(/<< \.WebhookPath >>/g, webhookPath)
  .replace(/<< \.IntegrationID >>/g, integrationId)
  .replace(/<< \.AppIDSecret >>/g, appIdSecretName)
  .replace(/<< \.AppPEMSecret >>/g, appPemSecretName)
  .replace(/<< \.WebhookSecretName >>/g, webhookSecretName);

const workflowId = await workflows.create("GitHub CI Agent", workflowYaml, true);
console.error(`Workflow created: ${workflowId}`);

// Create the agent and attach the workflow as its webhook entrypoint.
const agentId = await agents.create(
  "GitHub CI Agent",
  "AI-powered code review agent for GitHub pull requests",
  "default",
);
await agents.addConfig(agentId, workflowId, "webhook");

console.error("");
console.error("=".repeat(50));
console.error("GitHub CI Agent installed successfully!");
console.error("=".repeat(50));
console.error(`  Workflow ID: ${workflowId}`);
console.error(`  Agent ID:    ${agentId}`);
console.error(`  Webhook URL: <your-host>${webhookPath}`);
console.error("");
console.error("Next steps:");
console.error("  1. Restart ServFlow Pro to load the new configuration.");
console.error(`  2. Ensure the GitHub App's webhook points at <your-host>${webhookPath}.`);
console.error("  3. Open a pull request to trigger a review.");
console.error("");
