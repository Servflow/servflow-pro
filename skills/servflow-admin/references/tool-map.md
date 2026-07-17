# Management MCP tools ↔ `resource` CLI subcommands

The management MCP server (`/api/mcp`) and the `servflow-pro resource` CLI
expose the same operations over the same store. Every CLI command takes
`-c <config.toml>` (defaults to `~/.servflow/config.toml`) and `-o json|yaml`.
CLI create/update commands read the body from a file (`-f body.json`) or
stdin (`-f -`).

One behavioral difference: via MCP, `create_config`/`update_config` default
`enabled` to **true** when the key is absent; the CLI stores the zero value
(**disabled**) unless the body sets `"enabled": true` explicitly.

## Workflow configs

| MCP tool | CLI |
| --- | --- |
| `list_configs` | `resource config list` |
| `get_config` | `resource config get <id>` |
| `validate_config` | `resource config create -f - --dry-run` |
| `create_config` | `resource config create -f -` |
| `update_config` | `resource config update <id> -f -` |
| `delete_config` | `resource config delete <id>` |
| `set_config_enabled` | `resource config enable <id>` / `resource config disable <id>` |

`get`/`update`/`delete`/`set_config_enabled` take the numeric store `id` from
`list_configs`, not the `config_id` slug.

## Agents

| MCP tool | CLI |
| --- | --- |
| `list_agents` | `resource agent list` |
| `get_agent` | `resource agent get <id>` |
| `create_agent` | `resource agent create -f -` |
| `update_agent` | `resource agent update <id> -f -` |
| `delete_agent` (`with_configs`) | `resource agent delete <id> [--with-configs]` |
| `add_config_to_agent` | `resource agent add-config <agentId> --config-id <id> --config-type webhook\|task` |
| `remove_config_from_agent` | `resource agent remove-config <agentId> --config-id <id> --config-type webhook\|task` |

`config_type` accepts exactly `webhook` or `task`. Attach by `config_id` slug;
a numeric id is accepted and canonicalized to the slug.

## Integrations

| MCP tool | CLI |
| --- | --- |
| `list_integrations` | `resource integration list` |
| `get_integration` | `resource integration get <integrationId>` |
| `create_integration` | `resource integration create -f -` |
| `update_integration` | `resource integration update <integrationId> -f -` |
| `delete_integration` | `resource integration delete <integrationId>` |
| `list_integration_types` | `resource integration types` |
| `describe_integration_type` | `resource integration describe <type>` |

MCP `create_integration` takes `integration_id`, `type`, and `config` (the
type-specific config as a JSON-encoded **string**). The CLI body uses
`{"integrationId": ..., "type": ..., "config": "<json string>"}`.

## Secrets

| MCP tool | CLI |
| --- | --- |
| `list_secrets` | `resource secret list` |
| `create_secret` | `resource secret create -f -` |
| `update_secret` | `resource secret update <id> -f -` |
| `delete_secret` | `resource secret delete <id>` |

Values are write-only everywhere: no tool or command returns them.
`update_secret` changes the value only; renaming is not supported.

## Workspaces

| MCP tool | CLI |
| --- | --- |
| `list_workspaces` | `resource workspace list` |
| `get_workspace` | `resource workspace get <id>` |
| `create_workspace` | `resource workspace create -f -` |
| `update_workspace` | `resource workspace update <id> -f -` |
| `delete_workspace` | `resource workspace delete <id>` |

## Discovery / docs

| MCP tool | CLI |
| --- | --- |
| `list_actions` | `resource action list` |
| `describe_action` | `resource action describe <type> [<type>…]` |
| `config_schema` | `resource config schema` |
| `config_example` | `resource config example` |
| `list_template_functions` | `resource config template-functions [--category …]` |
