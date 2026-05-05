const Groq = require("groq-sdk");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Tu Key de Groq
const groq = new Groq({ apiKey: "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" });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
    const input = process.argv[2];
    if (!input) {
        console.log("Uso: node index.js <URL_o_RUTA_ARCHIVO>");
        return;
    }

    let rawContent = "";
    if (input.startsWith("http")) {
        rawContent = extractFromYouTube(input);
    } else {
        if (fs.existsSync(input)) {
            console.log(`--- Leyendo archivo local: ${input} ---`);
            rawContent = fs.readFileSync(input, 'utf8');
        } else {
            console.error("Error: El archivo no existe.");
            return;
        }
    }

    // 1. CAMBIO: Bajamos a 10,000 para evitar el error de "Request too large" 
    // al devolver el texto íntegro.
    const CHUNK_SIZE = 10000; 
    const chunks = [];
    for (let i = 0; i < rawContent.length; i += CHUNK_SIZE) {
        chunks.push(rawContent.substring(i, i + CHUNK_SIZE));
    }

    console.log(`--- Iniciando procesamiento de ${chunks.length} partes ---`);
    let finalMarkdown = "";

    for (let i = 0; i < chunks.length; i++) {
        console.log(`Procesando parte ${i + 1} de ${chunks.length}...`);
        
        const partResult = await organizeWithGroq(chunks[i], i + 1);
        finalMarkdown += partResult + "\n\n";

        if (i < chunks.length - 1) {
            console.log("Esperando 60 segundos para resetear límite de tokens (TPM)...");
            await delay(61000); 
        }
    }
    
    const outputPath = "fuente_notebooklm.md";
    fs.writeFileSync(outputPath, finalMarkdown);
    console.log(`\n--- ¡Éxito! Archivo listo: ${path.resolve(outputPath)} ---`);
}

async function organizeWithGroq(text, partNumber) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    // 2. CAMBIO: Instrucciones estrictas para que NO RESUMA
                    content: "OBJETIVO: Formatear transcripción. REGLAS: 1. NO RESUMAS. 2. NO CAMBIES las palabras. 3. MANTÉN las marcas de tiempo solo en los títulos. 4. Solo inserta títulos ## para organizar. El resultado debe ser el texto original íntegro."
                },
                {
                    role: "user",
                    content: `TEXTO PARTE ${partNumber}:\n\n${text}`
                }
            ],
            model: "llama-3.1-8b-instant",
            // 3. CAMBIO: Temperatura baja (0.1) para que sea fiel al texto y no invente nada
            temperature: 0.1, 
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error(`Error en parte ${partNumber}:`, error.message);
        return `[Error en parte ${partNumber}]`;
    }
}

function extractFromYouTube(url) {
    console.log("--- Extrayendo de YouTube ---");
    try {
        execSync(`yt-dlp --skip-download --write-auto-subs --sub-format vtt -o "temp_subs" "${url}"`);
        const vttFile = fs.readdirSync('.').find(f => f.startsWith('temp_subs') && f.endsWith('.vtt'));
        if (!vttFile) throw new Error("No se generó el archivo.");
        const content = fs.readFileSync(vttFile, 'utf8');
        fs.unlinkSync(vttFile); 
        return cleanVtt(content);
    } catch (e) {
        console.error("Error en yt-dlp.");
        process.exit(1);
    }
}

function cleanVtt(vtt) {
    return vtt.replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n/g, '').replace(/<[^>]*>/g, '').split('\n').filter((l, i, a) => l.trim() !== '' && l !== a[i-1]).join(' ');
}

main();