# yt-transcriber

Herramienta CLI para procesar transcripciones de video, textos teológicos y extractos de libros usando IA (Google Gemini). También permite analizar y hacer preguntas sobre textos ya procesados.

## Características

- **Procesar texto**: Transforma transcripciones crudas en documentos formateados con estructura Markdown, corrección de errores y traducción cuando es necesario.
- **Análisis Q&A**: Haz preguntas sobre documentos ya procesados y obtén respuestas basadas en el contenido.
- **Multilingüe**: Soporte para Español e Inglés.
- **Tipos de contenido**: Transcripciones de video, textos teológicos/comentarios bíblicos, extractos de libros.
- **Prompt extra**: Añade instrucciones personalizadas al procesar cualquier texto.
- **Reintentos automáticos**: Si un modelo de IA está saturado, prueba automáticamente con otros modelos disponibles.

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- Una [API Key de Google Gemini](https://aistudio.google.com/app/apikey)

## Instalación

1. Clona o descarga este repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz del proyecto con tu API Key:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_aqui
   ```

## Uso

### Iniciar la aplicación

```bash
npm start
# o
node src/index.js
```

### Opción 1: Procesar texto

1. **Selecciona el archivo de entrada**: Elige un archivo de la carpeta `Entradas/` o ingresa una ruta manualmente. Los archivos deben ser `.txt` o `.md`.
2. **Selecciona el tipo de contenido**:
   - **Transcripción de Video**: Organiza párrafos, añade secciones Markdown y timestamps.
   - **Textos Teológicos / Comentarios Bíblicos**: Formato de ensayo, corrige citas bíblicas, mantiene todas las palabras intactas.
   - **Extractos de Libros**: Corrige errores OCR, arregla párrafos, mantiene el contenido original.
3. **Selecciona el idioma**: Español o Inglés.
4. **Archivo de salida**: Acepta el nombre por defecto o escribe uno personalizado. Se guarda en `Resultados/`.
5. **Prompt extra (opcional)**: Añade instrucciones específicas como "Analizar la doctrina del autor" o "Resaltar las citas bíblicas". Deja vacío para continuar.

### Opción 2: Analizar / Hacer preguntas sobre un texto

1. **Selecciona un archivo**: Elige un documento de la carpeta `Resultados/` o ingresa una ruta.
2. **Haz tus preguntas**: Escribe una pregunta y la IA responderá basándose en el contenido del texto.
3. **Continúa preguntando**: Responde `s` para hacer otra pregunta o `n` para terminar.
4. **Guarda las Q&A**: Al finalizar, se genera un archivo `.md` con todas las preguntas y respuestas en `Resultados/`.

## Estructura del proyecto

```
yt-transcriber/
├── Entradas/              # Archivos de entrada (.txt, .md)
├── Resultados/            # Archivos generados automáticamente
├── deprecated/            # Scripts antiguos (no usar)
├── src/                   # Código fuente
│   ├── index.js           # Punto de entrada
│   ├── config/            # Configuración y prompts
│   ├── services/          # Servicios de IA (Gemini)
│   ├── modules/           # Lógica de negocio (procesar, analizar)
│   └── utils/             # Utilidades de archivos
├── .env                   # Variables de entorno (API Key)
├── package.json
└── README.md
```

## Notas

- Los prompts están diseñados para **NO resumir** ni eliminar contenido. Solo formatean, corrigen errores y traducen si es necesario.
- Los títulos (`##`) se añaden solo cuando el texto cambia claramente de tema o sección.
- Los archivos de salida incluyen metadata YAML con tipo, idioma, fecha y fuente original.
