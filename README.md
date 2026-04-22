# pi-moonshot-provider

A [pi](https://github.com/badlogic/pi-mono) extension that registers [Moonshot AI](https://www.moonshot.ai/) as a custom provider. Access Kimi K2.6, K2.5, K2 Thinking, and Moonshot V1 models through a unified OpenAI-compatible API.

## Features

- **Kimi K2.6** — Latest flagship model with multimodal input, long-horizon coding, and agentic reasoning
- **Kimi K2.5** — Previous flagship with vision support and thinking mode
- **Kimi K2 Thinking** — Deep reasoning variants for complex problems
- **Kimi K2 Turbo** — High-speed variants (60-100 tok/s) for responsive applications
- **Moonshot V1** — Legacy text-only models (8K/32K/128K context)
- **Cost Tracking** — Per-model pricing for budget management
- **Reasoning Support** — Thinking mode via zai format
- **Vision Support** — Image input on K2.6 and K2.5

## Installation

### Option 1: Using `pi install` (Recommended)

Install directly from GitHub:

```bash
pi install git:github.com/monotykamary/pi-moonshot-provider
```

Then set your API key and run pi:
```bash
export MOONSHOT_API_KEY=your-api-key-here
pi
```

Get your API key at [platform.kimi.ai/console/api-keys](https://platform.kimi.ai/console/api-keys).

### Option 2: Manual Clone

1. Clone this repository:
   ```bash
   git clone https://github.com/monotykamary/pi-moonshot-provider.git
   cd pi-moonshot-provider
   ```

2. Set your Moonshot API key:
   ```bash
   export MOONSHOT_API_KEY=your-api-key-here
   ```

3. Run pi with the extension:
   ```bash
   pi -e /path/to/pi-moonshot-provider
   ```

## Available Models

| Model | Context | Vision | Reasoning | Input $/M | Output $/M | Cache Read $/M |
|-------|---------|--------|-----------|-----------|------------|----------------|
| Kimi K2.6 | 262K | ✅ | ✅ | $0.95 | $4.00 | $0.16 |
| Kimi K2.5 | 262K | ✅ | ✅ | $0.60 | $3.00 | $0.10 |
| Kimi K2 Thinking Turbo | 262K | ❌ | ✅ | $1.15 | $8.00 | $0.15 |
| Kimi K2 Thinking | 262K | ❌ | ✅ | $0.60 | $2.50 | $0.15 |
| Kimi K2 Turbo | 262K | ❌ | ❌ | $1.15 | $8.00 | $0.15 |
| Kimi K2 0905 Preview | 262K | ❌ | ❌ | $0.60 | $2.20 | $0.15 |
| Kimi K2 0711 Preview | 131K | ❌ | ❌ | $0.55 | $2.20 | $0.30 |
| Moonshot V1 128k Vision Preview | 131K | ✅ | ❌ | $0.60 | $3.00 | $0.15 |
| Moonshot V1 128K | 131K | ❌ | ❌ | $2.00 | $5.00 | $2.00 |
| Moonshot V1 32K | 33K | ❌ | ❌ | $1.00 | $3.00 | $1.00 |
| Moonshot V1 32k Vision Preview | 33K | ✅ | ❌ | $0.60 | $3.00 | $0.15 |
| Moonshot V1 8k Vision Preview | 8K | ✅ | ❌ | $0.60 | $3.00 | $0.15 |
| Moonshot V1 8K | 8K | ❌ | ❌ | $0.20 | $2.00 | $0.20 |
| Moonshot V1 Auto | 131K | ❌ | ❌ | $0.60 | $3.00 | $0.15 |

*Costs are per million tokens. Prices subject to change — check [platform.moonshot.ai](https://platform.moonshot.ai/docs/pricing/chat) for current pricing.*

## Usage

After loading the extension, use the `/model` command in pi to select your preferred model:

```
/model moonshot kimi-k2.6
```

Or start pi directly with a Moonshot model:

```bash
pi --provider moonshot --model kimi-k2.6
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MOONSHOT_API_KEY` | Yes | Your Moonshot AI API key |

## Configuration

Add to your pi configuration for automatic loading:

```json
{
  "extensions": [
    "/path/to/pi-moonshot-provider"
  ]
}
```

### Compat Settings

Moonshot's API requires specific compatibility settings:

- **`supportsDeveloperRole: false`** — All models. Moonshot uses `system` role, not `developer`.
- **`maxTokensField: "max_tokens"`** — All models. Moonshot uses `max_tokens` instead of `max_completion_tokens`.
- **`thinkingFormat: "zai"`** — Reasoning models (K2.6, K2.5, K2 Thinking). Sends `thinking: { type: "enabled" }` in the request body.
- **`supportsStore: false`** — All models. Moonshot doesn't support the `store` parameter.

### Patch Overrides

The `patch.json` file contains overrides that are applied on top of `models.json` data. This is useful for:
- Correcting API-derived values (e.g., marking a model as reasoning-capable)
- Adding compat settings that the API doesn't provide
- Overriding pricing when official rates change

## Updating Models

Run the update script to fetch the latest models from Moonshot's API:

```bash
export MOONSHOT_API_KEY=your-api-key
node scripts/update-models.js
```

This will:
1. Fetch models from `https://api.moonshot.ai/v1/models`
2. Preserve pricing and compat from existing `models.json`
3. Apply overrides from `patch.json`
4. Update `models.json` and the README model table

A GitHub Actions workflow runs this daily and creates a PR if models have changed.

## License

MIT
