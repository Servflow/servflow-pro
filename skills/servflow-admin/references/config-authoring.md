# Workflow config authoring essentials

The authoritative shape always comes from the running instance —
`config_example` for a complete working document, `config_schema` for the
JSON Schema. This file covers only the rules that trip people up; it does not
replace discovery.

## Body shape

One flat document ("engine-shaped" / ProConfig):

```yaml
enabled: true
id: my-workflow          # becomes the config_id slug — set it explicitly
name: My Workflow
http:                     # HTTP entry (or use trigger: for a callee/cron)
  listenPath: /my-path
  method: POST
  next: action.first_step
trigger:                  # trigger entry (callworkflow target or cron)
  enabled: false          # true registers it; required true for callees
  cron: ""                # empty = only invocable, never scheduled
  next: ""
  result: ""              # template rendered as the invocation's return value
actions:
  first_step:
    name: First Step
    type: http            # an action type from list_actions
    config: { ... }       # exactly the fields describe_action lists
    next: response.ok     # where to go on success
    fail: ""              # where to go on failure ("" = stop)
conditionals: { ... }
responses:
  ok:
    name: OK
    code: 200
    type: template
    template: '{"status":"ok"}'
```

## Rules

- **`id` is the identity.** It is slugified (lowercase, hyphens) and must be
  unique across the instance. Agent attachments and `callworkflow` refs point
  at it. Choose a stable slug; renaming it breaks references.
- **Steps connect by prefixed reference strings** in
  `next`/`fail`/`onTrue`/`onFalse`/`dispatch`: `action.<key>`,
  `conditional.<key>`, `response.<key>`, where `<key>` is the map key (not the
  `name`). Every reference must resolve or validation fails.
- **An action's `config` holds exactly the fields `describe_action` lists**
  for its type. Unknown fields are rejected (additionalProperties: false).
  Fill every `required: true` field.
- **Dynamic values are Go templates**: `{{ body "field.path" }}`,
  `{{ urlparam "x" }}`, `{{ secret "name" }}`, `{{ input "name" }}` (trigger
  inputs), `{{ .step_key }}` (a prior step's output). Discover the full set
  with `list_template_functions`.
- **`{{ escape … }}` any dynamic value embedded inside a JSON string field**
  (prompts, string bodies) — raw quotes/newlines break the outer JSON. Do NOT
  escape text an AI agent reads directly as its input (diffs, file contents).
- **Conditionals**: `type: template` takes one `expression`;
  `type: structured` takes `structure`, an outer array of OR-groups each
  holding an inner array of AND-conditions
  (`{content, comparison, function, title}`) — `[[A,B],[C]]` means
  `(A AND B) OR C`.
- **`dispatch` on an action runs the listed steps in background goroutines**
  after the action completes, while `next` continues synchronously — the
  webhook-ack pattern: a static action with `next: response.accepted` and
  `dispatch: [action.long_job]` returns 202 immediately.

## Calling one workflow from another

- Caller: a `callworkflow` action with
  `config: {workflowID: <callee config_id>, inputs: {name: "{{ … }}"}}`.
- Callee: a `trigger` entry with `enabled: true` (mandatory — a disabled
  trigger is never registered and the call fails at runtime), reads arguments
  with `{{ input "name" }}`, returns via the trigger's `result` template.
  A JSON `result` is parsed, so the caller can read `{{ .call_step.field }}`.
- No cycles, direct or transitive.
- `validate_config` checks one config at a time; cross-config wiring
  (callee exists, input names match) only fails at runtime — check it
  yourself.

## Agent (AI) actions

The `agent` action needs `integrationID` referencing a stored integration
from the `ai` group (`list_integrations` / `create_integration`), plus
`systemPrompt`/`userPrompt`. Tools are declared under `toolConfigs`: each
`workflow`-type tool names a `start` step inside the same config and declares
`params` the model can pass; the step reads them with
`{{ tool_param "name" }}`. The accumulator idiom (a `static` step that
appends to its own prior output) collects repeated tool calls into one value.
