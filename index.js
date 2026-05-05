const fs = require('fs');

const CONFIG = {
    PORT: 4096,
    HOST: 'http://localhost',
    PASSWORD: '3Tristestigres',
    INPUT_FILE: 'video.txt',
    OUTPUT_FILE: 'documento_formateado.txt',
    CHUNK_SIZE: 100,
    RETRIES: 3
};

const authHeader = 'Basic ' + Buffer.from(`opencode:${CONFIG.PASSWORD}`).toString('base64');

// Función mejorada con reintentos y timeout extendido
async function fetchWithRetry(endpoint, options, retries = CONFIG.RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600000); // 5 min por intento

            const response = await fetch(`${CONFIG.HOST}:${CONFIG.PORT}${endpoint}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'Connection': 'keep-alive',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            return await response.json();

        } catch (err) {
            const isLastRetry = i === retries - 1;
            
            // Log descriptivo del error
            let errorMsg = err.name === 'AbortError' 
                ? '⏱️ TIMEOUT: La IA está tardando demasiado en procesar este bloque.' 
                : `❌ ERROR de Red/Servidor: ${err.message}`;
            
            console.log(`⚠️ Intento ${i + 1} fallido: ${errorMsg}`);
        
            if (isLastRetry) throw err;
            console.log(`Retrying in 5s...`);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

async function procesarTexto() {
    try {
        const contenido = fs.readFileSync(CONFIG.INPUT_FILE, 'utf-8').split('\n').filter(l => l.trim() !== "");
        const totalChunks = Math.ceil(contenido.length / CONFIG.CHUNK_SIZE);
        
        console.log(`📖 Archivo: ${contenido.length} líneas. Bloques: ${totalChunks}`);
        
        const session = await fetchWithRetry('/session', {
            method: 'POST',
            body: JSON.stringify({ title: 'Procesamiento Robusto' })
        });

        let resultadoFinal = "";

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CONFIG.CHUNK_SIZE;
            const chunk = contenido.slice(start, start + CONFIG.CHUNK_SIZE).join('\n');
            
            console.log(`⏳ Procesando bloque ${i + 1}/${totalChunks}...`);

            const prompt = `@transcriptor 
            TAREA: Convierte esta transcripción en un artículo fluido.
            REGLAS ESTRICTAS:
            1. NO crees títulos para cada marca de tiempo. 
            2. Solo usa '#' para las secciones principales (máximo 4 o 5 en todo el documento).
            3. Une las frases para formar párrafos coherentes de al menos 5-6 líneas.
            4. Mantén la literalidad absoluta de las palabras.
            5. Elimina los timestamps que aparezcan en medio de las oraciones.
            
            TEXTO:
            ${chunk}`;

            const messageData = await fetchWithRetry(`/session/${session.id}/message`, {
                method: 'POST',
                body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] })
            });
            
            // FILTRO MEJORADO: Solo tomamos las partes de texto y descartamos razonamientos
            const blockText = messageData.parts
                .filter(p => p.type === 'text') // Solo partes de tipo texto
                .map(p => p.text || "")
                .join('\n')
                .replace(/<thought>[\s\S]*?<\/thought>/g, '') // Elimina etiquetas de pensamiento si existen
                .trim();
            
            // Aseguramos que solo añadimos si hay contenido
            if (blockText) {
                resultadoFinal += blockText + "\n\n";
            }
        }

        fs.writeFileSync(CONFIG.OUTPUT_FILE, resultadoFinal.trim());
        console.log(`✅ ¡Éxito! Guardado en: ${CONFIG.OUTPUT_FILE}`);

    } catch (error) {
        console.error("❌ Error definitivo:", error.message);
    }
}

procesarTexto();