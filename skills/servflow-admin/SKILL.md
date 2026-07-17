---
name: servflow-admin
description: Create or update workflow configs and agents on a running ServFlow
  instance, and wire configs to agents, using the instance's management MCP
  server or the servflow-pro resource CLI. Use when the user asks to manage,
  administer, or operate a ServFlow server, create or update a ServFlow
  workflow config or agent, attach a workflow to an agent, or deploy a
  workflow to a running instance.
license: Apache-2.0
compatibility: Requires either a connection to the instance's management MCP
  endpoint (/api/mcp) or the servflow-pro CLI with access to the instance's
  config.toml.
metadata:
  author: servflow
  version: "1.0"
---

# Administering a ServFlow instance

A running ServFlow instance is managed through one resource surface exposed two
ways. Both are the same operations over the same store — pick whichever you
have access to:

- **Management MCP server** (preferred for remote instances): streamable-HTTP
  MCP at `<host>/api/mcp` (under unified dashboard hosting:
  `<host>/dashboard/api/mcp`). Connect with
  `claude mcp add --transport http servflow <url>`. Tools appear as
  `mcp__servflow__*`.
- **`servflow-pro resource` CLI** (same machine as the store): every MCP tool
  is a subcommand, e.g. `servflow-pro resource config list -c <config.toml>`.
  See [references/tool-map.md](references/tool-map.md) for the full 1:1 map.

The procedures below are written against the MCP tool names; substitute the CLI
subcommand from the tool map when working through the CLI.

**Every mutation is live.** The server hot-reloads on create/update/delete —
a saved config serves traffic immediately. There is no staging step, so
validate before you write and never save a config you haven't validated.

## Ground rules

- **Orient before you touch.** Start any session with `list_configs` and
  `list_agents`; `get_*` the specific resource before mutating it. Updates
  REPLACE the whole resource (full body, not a patch) — always fetch, modify,
  and send back the complete document.
- **Two ids per config.** The numeric store `id` (from `list_configs`) is what
  `get_config`/`update_config`/`delete_config` take. The `config_id` slug is
  the portable identity everything *references*: agent attachments and
  `callworkflow` targets. Set `id` in the config body to a stable
  human-readable slug (e.g. `order-sync`); it becomes the `config_id`.
- **Discover, don't guess.** The instance self-describes: `config_example` and
  `config_schema` give the authoritative body shape; `list_actions` /
  `describe_action` give each action's fields; `list_template_functions` gives
  the `{{ }}` functions. Field sets change between versions — trust the
  running instance over any memorized example.
- **Secrets are write-only.** No tool ever returns a secret value; reference
  them from configs as `{{ secret "name" }}`. Never echo a value the user
  gives you back into chat.
- **The MCP endpoint is currently unauthenticated.** Anyone who can reach
  `/api/mcp` can administer the instance. Do not expose it publicly without
  network-level protection, and warn the user if they are about to.

## Create or update a workflow config

A config body is "engine-shaped": one flat document with an entry
(`http` or `trigger`), plus `actions`, `conditionals`, and `responses` maps
whose steps connect by reference strings (`action.<key>`,
`conditional.<key>`, `response.<key>`). Read
[references/config-authoring.md](references/config-authoring.md) before
writing your first config of the session.

1. **Start from the instance's own example**: call `config_example`, and
   `config_schema` when unsure of a field. If a similar config already exists
   on the instance, `get_config` it and adapt — a working config is the best
   template.
2. **Read the fields of every action you use**: `describe_action` with the
   action types. Fill every `required` field; do not add fields it doesn't
   list. Actions with `integrationGroups` need an integration id — check
   `list_integrations`, create one with `create_integration` if needed
   (`describe_integration_type` gives its config fields).
3. **Validate**: `validate_config` with the body. On failure it returns one
   specific, humanized error — fix that one thing and re-validate. Loop until
   valid. This costs nothing; `create_config` on an unvalidated body risks a
   bad write going straight to live traffic.
4. **Create**: `create_config` with the same body. Via MCP, configs are
   created **enabled by default** (set `"enabled": false` in the body for a
   draft). Via the CLI, `enabled` must be set explicitly or the config is
   stored disabled — the defaults differ.
5. **Update**: `get_config <numeric id>` → modify the full body →
   `update_config <numeric id>`. The stored config is replaced wholesale.

To take a workflow out of service without losing it, prefer
`set_config_enabled` (id, `enabled: false`) over `delete_config`. Before any
delete, check nothing references the config: agent `webhooks`/`tasks` arrays
and other configs' `callworkflow` steps (they reference it by `config_id`).

## Create or update an agent

An agent is a named bundle of configs with an optional workspace. Its
`webhooks` and `tasks` arrays hold the `config_id`s of the configs it owns.

1. **Create**: `create_agent` with body `{name}` (required), plus optional
   `description`, `workspace_id` (must reference an existing workspace — see
   `list_workspaces`), `webhooks`, `tasks`.
2. **Attach configs**: `add_config_to_agent` with `agent_id`, `config_id`, and
   `config_type`:
   - `webhook` — the config with the `http` entry (the inbound endpoint).
   - `task` — every `trigger`-entry config, including `callworkflow` helpers
     with no cron (an empty-cron task is never scheduled; attaching it just
     makes the agent own it). Prefer `task` for anything that isn't a real
     HTTP endpoint, and don't leave helper configs unattached.
3. **Verify**: `get_agent` and confirm `webhooks`/`tasks` hold the expected
   `config_id`s.
4. **Update**: `get_agent` → modify → `update_agent` with the full body
   (wholesale replace, like configs). For attachment changes prefer
   `add_config_to_agent`/`remove_config_from_agent` over hand-editing the
   arrays.
5. **Delete**: `delete_agent` removes the agent only; `with_configs: true`
   also deletes every config in its `webhooks`/`tasks`. Confirm with the user
   before using `with_configs` — it is irreversible and takes endpoints out
   of service.

## Composition gotchas (multi-workflow builds)

- A `callworkflow` action's `workflowID` is the callee's **`config_id`**, and
  the callee must be a `trigger` entry with `"enabled": true` — a disabled
  trigger is silently never registered and the call fails at runtime with no
  target.
- Inputs flow caller `inputs: {name: template}` → callee `{{ input "name" }}`;
  names must match on both sides. `validate_config` checks each config alone,
  not cross-config wiring — sanity-check the pair yourself.
- Attach all workflows of one system to the same agent so they share its
  workspace and show up together.
