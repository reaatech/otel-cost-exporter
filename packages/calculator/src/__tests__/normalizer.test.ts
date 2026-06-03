import type { ModelNormalizer } from '@reaatech/otel-cost-exporter-calculator';
import { createModelNormalizer } from '@reaatech/otel-cost-exporter-calculator';
import { beforeEach, describe, expect, it } from 'vitest';

describe('createModelNormalizer', () => {
  let normalizer: ModelNormalizer;

  beforeEach(() => {
    normalizer = createModelNormalizer();
  });

  describe('normalize with system', () => {
    it('should resolve openai system', () => {
      const result = normalizer.normalize('gpt-4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should resolve anthropic system', () => {
      const result = normalizer.normalize('claude-3-opus-20240229', 'anthropic');
      expect(result).toEqual({
        provider: 'anthropic',
        canonicalName: 'claude-3-opus-20240229',
      });
    });

    it('should resolve vertexai system to google provider', () => {
      const result = normalizer.normalize('gemini-pro', 'vertexai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-pro' });
    });

    it('should resolve google_genai system to google provider', () => {
      const result = normalizer.normalize('gemini-1.5-pro', 'google_genai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-pro' });
    });

    it('should resolve aws.bedrock system to aws-bedrock provider', () => {
      const result = normalizer.normalize('titan-text', 'aws.bedrock');
      expect(result).toEqual({ provider: 'aws-bedrock', canonicalName: 'titan-text' });
    });

    it('should resolve azure_openai system to azure provider', () => {
      const result = normalizer.normalize('gpt-4', 'azure_openai');
      expect(result).toEqual({ provider: 'azure', canonicalName: 'gpt-4' });
    });

    it('should return null for unknown system value', () => {
      const result = normalizer.normalize('gpt-4', 'unknown_system');
      expect(result).toBeNull();
    });
  });

  describe('provider prefix stripping', () => {
    it('should strip openai/ prefix', () => {
      const result = normalizer.normalize('openai/gpt-4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip anthropic/ prefix', () => {
      const result = normalizer.normalize('anthropic/claude-3-opus', 'anthropic');
      expect(result).toEqual({ provider: 'anthropic', canonicalName: 'claude-3-opus' });
    });

    it('should strip vertexai/ prefix', () => {
      const result = normalizer.normalize('vertexai/gemini-pro', 'vertexai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-pro' });
    });

    it('should strip aws.bedrock/ prefix', () => {
      const result = normalizer.normalize('aws.bedrock/llama-3', 'aws.bedrock');
      expect(result).toEqual({ provider: 'aws-bedrock', canonicalName: 'llama-3' });
    });

    it('should strip azure_openai/ prefix', () => {
      const result = normalizer.normalize('azure_openai/gpt-4', 'azure_openai');
      expect(result).toEqual({ provider: 'azure', canonicalName: 'gpt-4' });
    });
  });

  describe('alias resolution', () => {
    it('should resolve gpt4 alias to gpt-4', () => {
      const result = normalizer.normalize('gpt4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should resolve gpt35 alias to gpt-3.5-turbo', () => {
      const result = normalizer.normalize('gpt35', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-3.5-turbo' });
    });

    it('should resolve gpt-35-turbo alias to gpt-3.5-turbo', () => {
      const result = normalizer.normalize('gpt-35-turbo', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-3.5-turbo' });
    });

    it('should resolve claude-opus alias to canonical name', () => {
      const result = normalizer.normalize('claude-opus', 'anthropic');
      expect(result).toEqual({
        provider: 'anthropic',
        canonicalName: 'claude-3-opus-20240229',
      });
    });

    it('should resolve claude-sonnet alias to canonical name', () => {
      const result = normalizer.normalize('claude-sonnet', 'anthropic');
      expect(result).toEqual({
        provider: 'anthropic',
        canonicalName: 'claude-3-5-sonnet-20241022',
      });
    });

    it('should resolve claude-haiku alias to canonical name', () => {
      const result = normalizer.normalize('claude-haiku', 'anthropic');
      expect(result).toEqual({
        provider: 'anthropic',
        canonicalName: 'claude-3-haiku-20240307',
      });
    });

    it('should resolve gemini-pro alias to gemini-1.5-pro', () => {
      const result = normalizer.normalize('gemini-pro', 'google_genai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-pro' });
    });

    it('should resolve gemini-flash alias to gemini-1.5-flash', () => {
      const result = normalizer.normalize('gemini-flash', 'google_genai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-flash' });
    });
  });

  describe('version suffix stripping', () => {
    it('should strip -v1 suffix', () => {
      const result = normalizer.normalize('gpt-4-v1', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip -v2 suffix', () => {
      const result = normalizer.normalize('claude-3-opus-v2', 'anthropic');
      expect(result).toEqual({ provider: 'anthropic', canonicalName: 'claude-3-opus' });
    });

    it('should strip -v10 suffix', () => {
      const result = normalizer.normalize('gemini-1.5-pro-v10', 'google_genai');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-1.5-pro' });
    });

    it('should strip @latest suffix', () => {
      const result = normalizer.normalize('gpt-4@latest', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip :latest suffix', () => {
      const result = normalizer.normalize('gpt-4:latest', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should preserve date-based version suffixes', () => {
      const result = normalizer.normalize('claude-3-opus-20240229', 'anthropic');
      expect(result).toEqual({
        provider: 'anthropic',
        canonicalName: 'claude-3-opus-20240229',
      });
    });

    it('should strip multiple -v suffixes', () => {
      const result = normalizer.normalize('gpt-4-v1-v2', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });
  });

  describe('region suffix stripping', () => {
    it('should strip -us region suffix', () => {
      const result = normalizer.normalize('gpt-4-us', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip -eu region suffix', () => {
      const result = normalizer.normalize('gpt-4-eu', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should not strip -us from middle of name', () => {
      const result = normalizer.normalize('custom-model-us-east', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'custom-model-us-east' });
    });

    it('should not strip -eu from middle of name', () => {
      const result = normalizer.normalize('custom-model-eu-west', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'custom-model-eu-west' });
    });

    it('should strip multiple region suffixes', () => {
      const result = normalizer.normalize('gpt-4-us-eu', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip region suffix reversed order', () => {
      const result = normalizer.normalize('gpt-4-eu-us', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });
  });

  describe('fine-tuned model handling', () => {
    it('should strip ft: prefix', () => {
      const result = normalizer.normalize('ft:gpt-4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should handle ft: without alias resolution (spec order)', () => {
      const result = normalizer.normalize('ft:gpt35', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt35' });
    });
  });

  describe('pattern-based fallback detection', () => {
    it('should detect gpt- prefix as openai', () => {
      const result = normalizer.normalize('gpt-4-turbo');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4-turbo' });
    });

    it('should detect text-davinci- prefix as openai', () => {
      const result = normalizer.normalize('text-davinci-003');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'text-davinci-003' });
    });

    it('should detect claude- prefix as anthropic', () => {
      const result = normalizer.normalize('claude-3.5-sonnet');
      expect(result).toEqual({ provider: 'anthropic', canonicalName: 'claude-3.5-sonnet' });
    });

    it('should detect gemini- prefix as google', () => {
      const result = normalizer.normalize('gemini-2.0-flash');
      expect(result).toEqual({ provider: 'google', canonicalName: 'gemini-2.0-flash' });
    });

    it('should detect llama- prefix as aws-bedrock', () => {
      const result = normalizer.normalize('llama-3-70b');
      expect(result).toEqual({ provider: 'aws-bedrock', canonicalName: 'llama-3-70b' });
    });

    it('should detect titan- prefix as aws-bedrock', () => {
      const result = normalizer.normalize('titan-text-express');
      expect(result).toEqual({ provider: 'aws-bedrock', canonicalName: 'titan-text-express' });
    });
  });

  describe('unrecognized models', () => {
    it('should return null for unknown model without system', () => {
      const result = normalizer.normalize('completely-random-model');
      expect(result).toBeNull();
    });

    it('should return null for empty model name without system', () => {
      const result = normalizer.normalize('');
      expect(result).toBeNull();
    });

    it('should return result for any model name with known system', () => {
      const result = normalizer.normalize('some-custom-model', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'some-custom-model' });
    });
  });

  describe('addAlias', () => {
    it('should dynamically add new alias', () => {
      normalizer.addAlias('my-model', 'gpt-4');
      const result = normalizer.normalize('my-model', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should override existing alias', () => {
      normalizer.addAlias('gpt4', 'gpt-4-turbo');
      const result = normalizer.normalize('gpt4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4-turbo' });
    });
  });

  describe('composite normalization', () => {
    it('should handle prefix + version + region stripping together', () => {
      const result = normalizer.normalize('openai/gpt-4-v2-us', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should handle prefix + alias resolution together', () => {
      const result = normalizer.normalize('openai/gpt4', 'openai');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should handle version + region without system (pattern fallback)', () => {
      const result = normalizer.normalize('gpt-4-v1-eu');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should handle ft: prefix without system (pattern fallback)', () => {
      const result = normalizer.normalize('ft:gpt-4');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });

    it('should strip prefix even without system when pattern detects provider', () => {
      const result = normalizer.normalize('openai/gpt-4');
      expect(result).toEqual({ provider: 'openai', canonicalName: 'gpt-4' });
    });
  });
});
