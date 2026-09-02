import Groq from 'groq-sdk';

/**
 * Groq implementation of the TextGenerator port.
 */
export class GroqTextGenerator {
  constructor({ apiKey = process.env.GROQ_API_KEY, model = 'llama-3.1-8b-instant', client } = {}) {
    this.client = client || new Groq({ apiKey });
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
