/**
 * Model name normalizer for OTel LLM span data.
 *
 * Resolves raw model names from {@link https://opentelemetry.io/docs/specs/semconv/gen-ai/ | GenAI semantic convention}
 * span attributes into canonical `provider/model` format for pricing lookup.
 *
 * @packageDocumentation
 * @module calculator/normalizer
 */

export interface NormalizedModel {
  provider: string;
  canonicalName: string;
}

export interface ModelNormalizer {
  normalize(modelName: string, system?: string): NormalizedModel | null;
  addAlias(alias: string, canonical: string): void;
}

const SYSTEM_PROVIDERS = new Map<string, string>([
  ['openai', 'openai'],
  ['anthropic', 'anthropic'],
  ['vertexai', 'google'],
  ['google_genai', 'google'],
  ['aws.bedrock', 'aws-bedrock'],
  ['azure_openai', 'azure'],
]);

const DEFAULT_ALIASES = new Map<string, string>([
  ['gpt4', 'gpt-4'],
  ['gpt35', 'gpt-3.5-turbo'],
  ['gpt-35-turbo', 'gpt-3.5-turbo'],
  ['claude-opus', 'claude-3-opus-20240229'],
  ['claude-sonnet', 'claude-3-5-sonnet-20241022'],
  ['claude-haiku', 'claude-3-haiku-20240307'],
  ['gemini-pro', 'gemini-1.5-pro'],
  ['gemini-flash', 'gemini-1.5-flash'],
]);

const KNOWN_PREFIXES = [
  'openai',
  'anthropic',
  'vertexai',
  'google_genai',
  'aws.bedrock',
  'azure_openai',
  'google',
  'aws-bedrock',
  'azure',
];

function detectProviderFromName(name: string): string | null {
  const lower = name.toLowerCase();

  if (/^gpt-|^text-davinci-/.test(lower)) return 'openai';
  if (/^claude-/.test(lower)) return 'anthropic';
  if (/^gemini-/.test(lower)) return 'google';
  if (/^llama-|^titan-/.test(lower)) return 'aws-bedrock';

  return null;
}

export function createModelNormalizer(): ModelNormalizer {
  const aliases = new Map(DEFAULT_ALIASES);

  return {
    normalize(modelName: string, system?: string): NormalizedModel | null {
      let provider: string | undefined | null;

      if (system) {
        provider = SYSTEM_PROVIDERS.get(system);
        if (!provider) return null;
      }

      let cleaned = modelName;

      for (const prefix of KNOWN_PREFIXES) {
        if (cleaned.startsWith(`${prefix}/`)) {
          cleaned = cleaned.slice(prefix.length + 1);
          break;
        }
      }

      const aliasTarget = aliases.get(cleaned);
      if (aliasTarget) {
        cleaned = aliasTarget;
      }

      let changed = true;
      while (changed) {
        changed = false;

        if (/-v\d+$/.test(cleaned)) {
          cleaned = cleaned.replace(/-v\d+$/, '');
          changed = true;
        }

        if (/[@:]latest$/.test(cleaned)) {
          cleaned = cleaned.replace(/[@:]latest$/, '');
          changed = true;
        }

        if (/(?:-us|-eu)$/.test(cleaned)) {
          cleaned = cleaned.replace(/(?:-us|-eu)$/, '');
          changed = true;
        }
      }

      cleaned = cleaned.replace(/^ft:/, '');

      if (!provider) {
        provider = detectProviderFromName(cleaned);
        if (!provider) return null;
      }

      return { provider, canonicalName: cleaned };
    },

    addAlias(alias: string, canonical: string): void {
      aliases.set(alias, canonical);
    },
  };
}
