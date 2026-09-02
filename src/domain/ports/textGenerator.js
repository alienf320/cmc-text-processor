/**
 * Port implemented by every text-generation provider.
 *
 * @typedef {Object} TextGenerator
 * @property {(systemPrompt: string, userPrompt: string) => Promise<{text: string, modelName: string}>} generate
 */

/**
 * Fail early when a use case is wired with an incompatible provider.
 *
 * @param {TextGenerator} textGenerator
 * @returns {TextGenerator}
 */
export function assertTextGenerator(textGenerator) {
  if (!textGenerator || typeof textGenerator.generate !== 'function') {
    throw new TypeError('TextGenerator must expose generate(systemPrompt, userPrompt)');
  }

  return textGenerator;
}
