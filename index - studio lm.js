const { OpenAI } = require("openai");
const fs = require("fs");

const client = new OpenAI({
    baseURL: "http://127.0.0.1:1234/v1",
    apiKey: "lm-studio",
    // --- AQUÍ ESTÁ LA CLAVE ---
    timeout: 600000, // 10 minutos en milisegundos
});

async function main() {
    const inputPath = process.argv[2] || "video.txt";
    const rawContent = fs.readFileSync(inputPath, "utf8");

    console.log("--- Procesando localmente con LM Studio ---");
    console.log("(Este proceso puede tardar un par de minutos según tu PC...)");

    try {
        const response = await client.chat.completions.create({
            model: "google/gemma-4-e4b",
            messages: [
                { 
                    role: "system", 
                    content: "Eres un experto en estructurar transcripciones para NotebookLM. Usa títulos ## y subtítulos ###. No resumas, organiza todo el contenido." 
                },
                { 
                    role: "user", 
                    content: `Estructura este texto:\n\n${rawContent}` 
                }
            ],
            // IMPORTANTE: Baja la temperatura para que no divague
            temperature: 0.1, 
        });

        const structuredMarkdown = response.choices[0].message.content;
        fs.writeFileSync("fuente_notebooklm.md", structuredMarkdown);
        
        console.log("\n--- ¡Éxito! Archivo generado correctamente ---");

    } catch (error) {
        if (error.name === 'APIConnectionTimeoutError') {
            console.error("\n[!] Error: El modelo tardó demasiado. Intenta con un fragmento más corto o aumenta el timeout.");
        } else {
            console.error("\n[!] Error:", error.message);
        }
    }
}

main();