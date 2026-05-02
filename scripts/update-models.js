#!/usr/bin/env node
/**
 * Update Moonshot models from API
 *
 * Fetches models from https://api.moonshot.ai/v1/models and updates:
 * - models.json: Provider model definitions (enriched with pricing & compat)
 * - README.md: Model table in the Available Models section
 *
 * The Moonshot /v1/models API returns basic model info (id, context_length,
 * supports_image_in, supports_reasoning) but does NOT include pricing or
 * max output tokens.
 * models.json is the source of truth for curated specs — the script preserves
 * existing data and only adds new models with sensible defaults.
 * Curate models.json manually after new model discovery.
 *
 * patch.json is applied at runtime by the provider — not baked into models.json.
 *
 * Requires MOONSHOT_API_KEY environment variable.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODELS_API_URL = 'https://api.moonshot.ai/v1/models';
const MODELS_JSON_PATH = path.join(__dirname, '..', 'models.json');
const README_PATH = path.join(__dirname, '..', 'README.md');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ Saved ${path.basename(filePath)}`);
}

// ─── API fetch ───────────────────────────────────────────────────────────────

async function fetchModels() {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY environment variable is required');
  }

  console.log(`Fetching models from ${MODELS_API_URL}...`);
  const response = await fetch(MODELS_API_URL, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const models = data.data || [];
  console.log(`✓ Fetched ${models.length} models from API`);
  return models;
}

// ─── Transform API model → models.json entry ────────────────────────────────

function transformApiModel(apiModel, existingModelsMap) {
  const id = apiModel.id;

  // Preserve existing curated data (pricing, reasoning, compat, etc.)
  if (existingModelsMap[id]) {
    const existing = { ...existingModelsMap[id] };
    // Update context window from API if changed
    if (apiModel.context_length) {
      existing.contextWindow = apiModel.context_length;
    }
    // Update reasoning/vision flags from API
    existing.reasoning = apiModel.supports_reasoning ?? existing.reasoning;
    if (apiModel.supports_image_in) {
      if (!existing.input.includes('image')) {
        existing.input = ['text', 'image'];
      }
    }
    return existing;
  }

  // New model — build from API data + sensible defaults
  // Curate models.json manually after discovery for pricing, maxTokens, thinkingFormat, etc.
  const inputTypes = ['text'];
  if (apiModel.supports_image_in) {
    inputTypes.push('image');
  }

  const model = {
    id,
    name: generateDisplayName(id),
    reasoning: apiModel.supports_reasoning || false,
    input: inputTypes,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: apiModel.context_length || 131072,
    maxTokens: 16384,
  };

  // Add compat settings
  model.compat = {
    maxTokensField: 'max_tokens',
    supportsDeveloperRole: false,
    supportsStore: false,
  };

  return model;
}

function generateDisplayName(id) {
  // Fallback: prettify the ID
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── README generation ──────────────────────────────────────────────────────

function formatContext(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return n.toString();
}

function formatCost(cost) {
  if (cost === 0) return 'Free';
  if (cost === null || cost === undefined) return '-';
  return `$${cost.toFixed(2)}`;
}

function generateReadmeTable(models) {
  const lines = [
    '| Model | Context | Vision | Reasoning | Input $/M | Output $/M | Cache Read $/M |',
    '|-------|---------|--------|-----------|-----------|------------|----------------|',
  ];

  for (const model of models) {
    const context = formatContext(model.contextWindow);
    const vision = model.input.includes('image') ? '✅' : '❌';
    const reasoning = model.reasoning ? '✅' : '❌';
    const inputCost = formatCost(model.cost.input);
    const outputCost = formatCost(model.cost.output);
    const cacheCost = formatCost(model.cost.cacheRead);

    lines.push(`| ${model.name} | ${context} | ${vision} | ${reasoning} | ${inputCost} | ${outputCost} | ${cacheCost} |`);
  }

  return lines.join('\n');
}

function updateReadme(models) {
  let readme = fs.readFileSync(README_PATH, 'utf8');
  const newTable = generateReadmeTable(models);

  const tableRegex = /(## Available Models\n\n)\| Model \|[^\n]+\|\n\|[-| ]+\|(\n\|[^\n]+\|)*\n*/;

  if (tableRegex.test(readme)) {
    readme = readme.replace(tableRegex, (match, header) => `${header}${newTable}\n\n`);
    fs.writeFileSync(README_PATH, readme);
    console.log('✓ Updated README.md');
  } else {
    console.warn('⚠ Could not find model table in "## Available Models" section');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const apiModels = await fetchModels();

    // Load existing models.json — source of truth for curated specs
    const existingModels = loadJson(MODELS_JSON_PATH);
    const existingModelsMap = {};
    for (const m of (Array.isArray(existingModels) ? existingModels : [])) {
      existingModelsMap[m.id] = m;
    }

    // Transform API models, preserving existing data where available
    let models = apiModels.map(m =>
      transformApiModel(m, existingModelsMap)
    );

    // Keep models from models.json that are NOT in the API response
    // (e.g. deprecated but still usable models)
    const apiIds = new Set(apiModels.map(m => m.id));
    for (const existing of Object.values(existingModelsMap)) {
      if (!apiIds.has(existing.id)) {
        models.push(existing);
      }
    }

    // Sort: K2.6 first, then K2.5, then K2 family, then V1
    const FAMILY_ORDER = ['k2.6', 'k2.5', 'k2-thinking-turbo', 'k2-thinking', 'k2-turbo', 'k2-0905', 'k2-0711', 'v1-128', 'v1-32', 'v1-8'];
    models.sort((a, b) => {
      const aIdx = FAMILY_ORDER.findIndex(f => a.id.includes(f));
      const bIdx = FAMILY_ORDER.findIndex(f => b.id.includes(f));
      if (aIdx !== -1 && bIdx !== -1) {
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.id.localeCompare(b.id);
      }
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    // Save models.json
    saveJson(MODELS_JSON_PATH, models);

    // Update README
    updateReadme(models);

    // Summary
    const newIds = new Set(models.map(m => m.id));
    const oldIds = new Set(Object.keys(existingModelsMap));
    const added = [...newIds].filter(id => !oldIds.has(id));
    const removed = [...oldIds].filter(id => !newIds.has(id));

    console.log('\n--- Summary ---');
    console.log(`Total models: ${models.length}`);
    console.log(`Reasoning models: ${models.filter(m => m.reasoning).length}`);
    console.log(`Vision models: ${models.filter(m => m.input.includes('image')).length}`);
    if (added.length > 0) console.log(`New models: ${added.join(', ')} — curate models.json manually`);
    if (removed.length > 0) console.log(`Removed models: ${removed.join(', ')}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
