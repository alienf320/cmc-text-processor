const fs = require("fs");

// CONFIGURACIÓN DIRECTA
const CONFIG = {
  GROQ_API_KEY: "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", // <--- PEGA TU KEY AQUÍ
  MODEL: "llama-3.1-8b-instant",
  INPUT_FILE: "video.txt",
  OUTPUT_FILE: "documento_formateado.txt",
  // AUMENTO: Ahora podemos enviar más texto de una vez
  CHUNK_SIZE: 100,
  // REDUCCIÓN: Casi no necesitamos esperar entre bloques exitosos
  DELAY_BETWEEN_CHUNKS: 2000,
};

// ... (En la función llamarGroq, asegúrate de usar CONFIG.MODEL)
async function llamarGroq(messages) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONFIG.MODEL, // <--- Usará el 8B
        messages: messages,
        temperature: 0.1, // Más bajo es más rápido y preciso para limpiar texto
      }),
    }
  );
  return response;
}

async function procesarConGroq() {
  try {
    const lineas = fs
      .readFileSync(CONFIG.INPUT_FILE, "utf-8")
      .split("\n")
      .filter((l) => l.trim());
    const total = Math.ceil(lineas.length / CONFIG.CHUNK_SIZE);
    let resultadoFinal = "";

    console.log(`🚀 Procesando ${total} bloques con control de tráfico...`);

    for (let i = 0; i < total; i++) {
      const chunk = lineas
        .slice(i * CONFIG.CHUNK_SIZE, (i + 1) * CONFIG.CHUNK_SIZE)
        .join("\n");
      let bloqueCompletado = false;
      let intentos = 0;

      while (!bloqueCompletado && intentos < 5) {
        console.log(`⏳ Bloque ${i + 1}/${total} (Intento ${intentos + 1})...`);

        const response = await llamarGroq([
          {
            role: "system",
            content: `Eres un editor de textos teológicos. Tu objetivo es convertir transcripciones crudas en un formato de ensayo o libro fluido.
                      
                      REGLAS DE ORO:
                      1. NARRATIVA DIRECTA: No uses frases como "El orador dice" o "El autor menciona". Escribe el texto como si el autor lo estuviera redactando directamente.
                      2. ESTRUCTURA: Solo usa '##' para títulos de temas nuevos y significativos. No crees títulos para cada párrafo. 
                      3. TIMESTAMPS: Pon el tiempo solo al inicio de los títulos '##'. Ejemplo: '## La Gracia Soberana (12:45)'.
                      4. CITAS BÍBLICAS: Asegúrate de que sigan el formato (Libro Cap:Ver). Si el orador dice "San Mateo", cámbialo a "Mateo". 
                      5. CERO REPETICIÓN: Si el texto del bloque parece una repetición exacta de una idea anterior o una muletilla, sintetízalo.
                      6. VERIFICACIÓN: No inventes referencias. Si el orador cita mal un versículo, mantén la cita pero asegúrate de que el formato sea correcto.`,
          },
          { role: "user", content: chunk },
        ]);

        const data = await response.json();

        if (response.ok) {
          resultadoFinal += data.choices[0].message.content + "\n\n";
          console.log(`✅ Bloque ${i + 1} listo.`);
          bloqueCompletado = true;
          // Espera de seguridad entre bloques exitosos
          await new Promise((r) => setTimeout(r, CONFIG.DELAY_BETWEEN_CHUNKS));
        } else if (response.status === 429) {
          // ERROR DE RATE LIMIT: Extraemos cuánto tiempo hay que esperar
          const esperaSugerida =
            data.error?.message?.match(/(\d+\.?\d*)s/)?.[1] || 15;
          const msEspera = (parseFloat(esperaSugerida) + 2) * 1000; // Añadimos 2 segundos extra por margen

          console.warn(
            `⚠️ Límite alcanzado. Esperando ${esperaSugerida}s para reintentar...`
          );
          await new Promise((r) => setTimeout(r, msEspera));
          intentos++;
        } else {
          console.error(`❌ Error grave:`, data.error?.message);
          break;
        }
      }
    }

    fs.writeFileSync(CONFIG.OUTPUT_FILE, resultadoFinal.trim());
    console.log(`\n🎉 ¡TRANSCRIPCIÓN COMPLETA! Revisa ${CONFIG.OUTPUT_FILE}`);
  } catch (err) {
    console.error("❌ Error de lectura/escritura:", err.message);
  }
}

procesarConGroq();
