import OpenAI from 'openai';

/**
 * OpenAI implementation of the TextGenerator port.
 */
export class OpenAITextGenerator {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = 'gpt-4o-mini', client } = {}) {
    this.client = client || new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(systemPrompt, userPrompt) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    return {
      text: response.choices[0]?.message?.content || '',
      modelName: response.model || this.model,
    };
  }
}
