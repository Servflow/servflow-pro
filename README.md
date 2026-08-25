# ServflowAI

<p align="center">
  <strong>A powerful API workflow orchestration platform for building, managing, and executing complex API workflows with ease.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#cookbook">Cookbook</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#license">License</a>
</p>

---

## Overview

ServflowAI is an advanced API workflow orchestration platform that enables you to design, deploy, and manage complex API workflows. It provides a visual workflow builder, scheduled job execution, integrations with popular services, and enterprise-grade features for production environments.

## Features

- **Visual Workflow Builder** - Design workflows visually with a drag-and-drop dashboard interface
- **YAML-Based Configuration** - Define workflows as code using simple, readable YAML files
- **Scheduled Jobs** - Run workflows on a schedule using cron expressions
- **Built-in Actions** - HTTP requests, JavaScript execution, database operations, AI/LLM agents, and more
- **Integrations** - Connect to MongoDB, OpenAI, Binance, Telegram, SQL databases, Qdrant, and more
- **Conditional Logic** - Branch workflows based on conditions and data
- **Secret Management** - Securely store and reference API keys and credentials

- **Distributed Tracing** - OpenTelemetry support for observability
- **OAuth Support** - Built-in OAuth flow management for third-party integrations

## Quick Start

The fastest way to get started:

```bash
# Using Docker
docker run -p 8080:8080 -p 3000:3000 servflow/servflowai

# Or using Homebrew (macOS/Linux)
brew install Servflow/servflow/servflowai
servflowai start --config config.toml --dashboard
```

Access the dashboard at `http://localhost:3000`

## Installation

### Homebrew (macOS / Linux)

```bash
brew install Servflow/servflow/servflowai
```

### npm

```bash
npm install -g servflowai
```

### Docker

Pull the latest image from Docker Hub:

```bash
docker pull servflow/servflowai:latest
```

Run with default configuration:

```bash
docker run -p 8080:8080 -p 3000:3000 servflow/servflowai
```

Run with custom configuration and persistent storage:

```bash
docker run -p 8080:8080 -p 3000:3000 \
  -v ./config.toml:/data/config.toml \
  -v ./configs:/data/configs \
  -v ./data:/data \
  servflow/servflowai
```

### Binary Downloads

Download pre-built binaries from the [Releases](https://github.com/Servflow/servflowai/releases) page.

Available platforms:
- **Linux** (x86_64, arm64)
- **macOS** (x86_64, arm64)

```bash
# Download and extract (example for Linux x86_64)
tar -xzf servflowai_Linux_x86_64.tar.gz

# Make executable and run
chmod +x servflowai
./servflowai start --config config.toml --dashboard
```

### From Source

```bash
# Clone the repository
git clone https://github.com/Servflow/servflowai.git
cd servflowai

# Build
go build -o servflowai

# Run
./servflowai start --config config.toml --dashboard
```

## Configuration

ServflowAI uses TOML configuration files. Create a `config.toml` file:

```toml
[server]
port = "8080"
config_folder = "./configs"
env = "production"

[dashboard]
port = "3000"
configs_folder = "./configs"

[sqlite]
path = "/data/secrets.db"

# Optional: OpenTelemetry tracing
[tracing]
enabled = false
service_name = "servflowai"
collector_endpoint = ""
```

### Configuration Options

| Section | Option | Description | Default |
|---------|--------|-------------|---------|
| `server` | `port` | API server port | `8080` |
| `server` | `config_folder` | Directory for workflow YAML files | `./configs` |
| `server` | `env` | Environment (production/development) | `production` |
| `dashboard` | `port` | Dashboard UI port | `3000` |
| `sqlite` | `path` | Path to SQLite database for secrets/settings | - |
| `tracing` | `enabled` | Enable OpenTelemetry tracing | `false` |

## Usage

### CLI Commands

```bash
# Start server only
servflowai start --config config.toml

# Start server with dashboard
servflowai start --config config.toml --dashboard
```

### Creating a Workflow

Workflows are defined in YAML files. Here's a simple example:

```yaml
enabled: true
id: hello-world

http:
  listenPath: /hello
  method: GET
  next: action.greet

actions:
  greet:
    name: greet
    type: static
    config:
      value: "Hello, World!"
    next: response.success

responses:
  success:
    name: success
    code: 200
    responseObject:
      value: ""
      fields:
        message:
          value: "{{ .greet }}"
```

### Available Action Types

| Action | Description |
|--------|-------------|
| `http` | Make HTTP requests to external APIs |
| `javascript` | Execute JavaScript code |
| `fetch` | Query databases (MongoDB, SQL) |
| `store` | Store data in databases |
| `agent` | AI/LLM agent with tool calling |
| `static` | Return static values |
| `hash` | Hash data (bcrypt, SHA, etc.) |
| `jwt` | Generate/validate JWT tokens |
| `email` | Send emails |
| `download` | Download files |

### Available Integrations

| Integration | Description |
|-------------|-------------|
| `openai` | OpenAI API for LLM capabilities |
| `mongo` | MongoDB database |
| `sql` | SQL databases (PostgreSQL, MySQL, SQLite) |
| `qdrant` | Qdrant vector database |
| `binance` | Binance cryptocurrency exchange |

## Cookbook

Check out the [cookbook](./cookbook) directory for example workflows:

- **[Telegram Binance Assistant](./cookbook/telegram/binance-assistant.yaml)** - A Telegram bot that uses AI to interact with Binance, featuring credential storage and natural language commands

## Dashboard

The dashboard provides a visual interface for:

- **Workflow Builder** - Create and edit workflows visually
- **API Management** - Enable/disable and manage workflows
- **Integrations** - Configure third-party service connections
- **Secrets** - Manage API keys and credentials securely
- **Execution Logs** - Monitor workflow executions in real-time

Access the dashboard at `http://localhost:3000` when started with the `--dashboard` flag.

## Template Functions

ServflowAI supports Go template syntax for dynamic values:

```yaml
# Access request body
{{ body "user.name" }}

# Access secrets
{{ secret "API_KEY" }}

# Access action results
{{ .previous_action.field }}

# Built-in functions
{{ now }}
{{ join .array "," }}
{{ eq .value "expected" }}
```

## Documentation

- [Configuration Reference](./docs/configuration.md)
- [Action Types](./docs/actions.md)
- [Integrations Guide](./docs/integrations.md)
- [Template Functions](./docs/templates.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ServflowAI is released under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by the <a href="https://servflow.io">ServFlow</a> team
</p>