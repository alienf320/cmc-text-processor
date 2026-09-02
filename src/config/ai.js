const PROVIDER_DEFAULTS = {
  gemini: {
    model: 'gemini-2.5-flash-lite',
    credential: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  openai: {
    model: 'gpt-4o-mini',
    credential: 'OPENAI_API_KEY',
  },
  groq: {
    model: 'llama-3.1-8b-instant',
    credential: 'GROQ_API_KEY',
  },
};

export function getAiConfig(env = process.env) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];

  if (!defaults) {
    throw new Error(
      `AI_PROVIDER_INVALID: "${provider}". Valores permitidos: ${Object.keys(PROVIDER_DEFAULTS).join(', ')}`
    );
  }

  const apiKey = env[defaults.credential];
  if (!apiKey) {
    throw new Error(`AI_CREDENTIAL_MISSING: configura ${defaults.credential} para el proveedor "${provider}"`);
  }

  return {
    provider,
    model: env.AI_MODEL || defaults.model,
    apiKey,
  };
}

export function getSupportedAiProviders() {
  return Object.keys(PROVIDER_DEFAULTS);
}
