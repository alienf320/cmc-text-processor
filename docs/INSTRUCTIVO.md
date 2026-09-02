# Instructivo de uso y configuración — YT Transcriber

YT Transcriber convierte transcripciones, textos y extractos de libros en documentos Markdown organizados mediante Google Gemini. También permite consultar un texto procesado con preguntas.

## Acceso rápido

### Usar la aplicación web localmente

1. Instalar [Node.js 18 o superior](https://nodejs.org/).
2. Clonar o descargar el repositorio.
3. Abrir una terminal en la carpeta raíz del proyecto.
4. Instalar las dependencias del servidor:

   ```bash
   npm install
   ```

5. Configurar el archivo `.env` (ver [Configuración](#configuración)).
6. Construir la interfaz Angular:

   ```bash
   cd electron-angular-test
   npm install
   npm run build
   cd ..
   ```

7. Iniciar el servidor:

   ```bash
   npm start
   ```

8. Abrir [http://localhost:3000](http://localhost:3000).

> El servidor Express sirve la interfaz ya compilada desde `electron-angular-test/dist`. Si se modifican archivos de Angular, volver a ejecutar `npm run build`.

### Desarrollo de la interfaz

Para trabajar con recarga automática, usar dos terminales:

```bash
# Terminal 1 — API
npm start

# Terminal 2 — Angular
cd electron-angular-test
npm start
```

Luego abrir [http://localhost:4200](http://localhost:4200). La interfaz local utiliza automáticamente la API en `http://localhost:3000`.

## Configuración

Crear `.env` en la raíz del proyecto:

```env
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_de_gemini
```

La API Key se obtiene desde [Google AI Studio](https://aistudio.google.com/app/apikey). Es obligatoria para procesar y analizar textos.

### Google Drive (opcional)

La aplicación intenta guardar y leer los resultados desde Google Drive. Si Drive no está disponible, conserva el resultado localmente en `resultados/`.

Para habilitar Drive:

1. En Google Cloud Console, crear o seleccionar un proyecto.
2. Habilitar **Google Drive API**.
3. Crear credenciales **OAuth 2.0 Client ID** de tipo **Desktop app**.
4. Descargar el JSON y guardarlo como `credentials.json` en la raíz del proyecto.
5. Ejecutar una operación que use Drive, por ejemplo el flujo CLI de entrada desde Drive.
6. Abrir la URL que aparece en la terminal y autorizar la cuenta de Google.
7. Cuando se solicite, pegar el código de autorización. Se creará `token.json`.

Variables opcionales:

```env
# Nombre de la carpeta donde se guardan los resultados
DRIVE_FOLDER_NAME=yt-transcriber

# Nombre de la carpeta de entradas para el flujo CLI
DRIVE_INPUT_FOLDER=Entradas

# ID explícito de una carpeta de Drive (tiene prioridad sobre DRIVE_FOLDER_NAME)
DRIVE_FOLDER_ID=ID_DE_LA_CARPETA
```

Para despliegues donde no se pueden subir archivos JSON, se pueden usar versiones Base64 de las credenciales:

```env
GOOGLE_OAUTH_CREDENTIALS=JSON_DE_CREDENTIALS_EN_BASE64
GOOGLE_OAUTH_TOKEN=JSON_DEL_TOKEN_EN_BASE64
```

No subir `.env`, `credentials.json`, `token.json` ni claves privadas al repositorio. Ya están contemplados en `.gitignore`.

## Uso de la interfaz web

### 1. Procesar un video de YouTube

1. Entrar en **YouTube**.
2. Pegar una URL válida del video, por ejemplo `https://www.youtube.com/watch?v=...`.
3. Elegir el **tipo de contenido**:
   - **Transcripción de Video**: ordena la transcripción en párrafos y secciones Markdown y agrega timestamps a los títulos.
   - **Textos Teológicos**: conserva las ideas, corrige errores menores y normaliza citas bíblicas.
   - **Extractos de Libros**: corrige OCR, párrafos y errores ortográficos sin resumir.
4. Elegir el idioma de salida: **Español** o **English**.
5. Presionar **Procesar**.

El video debe tener subtítulos disponibles. La aplicación selecciona subtítulos en español cuando están disponibles y, si no, utiliza la primera pista disponible.

### 2. Procesar texto o archivo

1. Entrar en **Texto**.
2. Elegir tipo de contenido e idioma.
3. Pegar el texto en el área de texto y presionar **Procesar texto**, o seleccionar un archivo `.txt`, `.md` o `.pdf` y presionar **Subir y procesar**.
4. Revisar la vista previa del resultado.

El límite de subida de archivos es de 50 MB. Los documentos extensos se dividen internamente en partes para conservar el contexto y luego se genera un archivo final.

### 3. Consultar un documento

1. Entrar en **Resultados** y seleccionar un archivo para ver su contenido.
2. Copiar el contenido del documento.
3. Entrar en **Preguntar** y pegarlo en el campo **Texto**.
4. Escribir una pregunta concreta y presionar **Preguntar**.

La respuesta se genera basándose en el texto proporcionado; esta pantalla no selecciona automáticamente un archivo de Resultados.

### 4. Cambiar la URL de la API

En **Config**, escribir la URL del servidor y presionar **Aplicar**. Ejemplos:

```text
http://localhost:3000
https://tu-api.example.com
```

## Uso mediante CLI

El CLI permite opciones adicionales, como elegir un prompt extra y trabajar con archivos de Drive.

Desde la raíz del proyecto:

```bash
npm run cli
```

Menú principal:

1. **Procesar texto / PDF**: elegir archivo local, archivo de Drive o ruta manual; seleccionar tipo, idioma, nombre de salida y prompt extra.
2. **Analizar / Hacer preguntas**: consultar un texto o PDF.
3. **Descargar y procesar transcripción de YouTube**: pegar la URL, elegir tipo, idioma y nombre de salida.

Los archivos locales se buscan en `Entradas/` y los resultados se escriben en `resultados/`. El CLI también puede sincronizar resultados con la carpeta configurada de Google Drive.

## Comprobar que el servidor funciona

Con el servidor iniciado, abrir:

```text
http://localhost:3000/api/health
```

La respuesta esperada contiene:

```json
{"status":"ok"}
```

Si se usa Google Drive, revisar también:

```text
http://localhost:3000/api/drive-test
```

Este diagnóstico informa si faltan credenciales, si la autorización falla o qué carpeta está utilizando la aplicación.

## Solución de problemas

| Problema | Qué revisar |
|---|---|
| `No se encontró la API Key` | Confirmar `GOOGLE_GENERATIVE_AI_API_KEY` en `.env` y reiniciar el servidor. |
| La página no carga en el puerto 3000 | Ejecutar `npm run build` dentro de `electron-angular-test` y volver a iniciar `npm start`. |
| Video sin transcripción | Verificar que el video tenga subtítulos accesibles y probar otra URL. |
| Error de Google Drive | Confirmar que `credentials.json`/`token.json` sean válidos y revisar `/api/drive-test`. |
| No aparecen resultados | Presionar **Refrescar**; si Drive falla, revisar la carpeta local `resultados/`. |
| Respuesta inesperada | Revisar el tipo de contenido, idioma y que el texto de entrada sea legible. |

## Estructura de carpetas relevante

```text
yt-transcriber/
├── Entradas/                         # Entradas locales (se crea cuando hace falta)
├── Resultados/                       # Markdown generado localmente
├── uploads/                          # Temporales de archivos subidos
├── src/                              # API, CLI, prompts y servicios
├── server.js                         # Servidor Express y endpoints REST
└── electron-angular-test/            # Interfaz Angular
```

## Notas importantes

- La IA está configurada para organizar, corregir y traducir cuando corresponde; no está diseñada para resumir automáticamente.
- Los resultados pueden incluir metadata YAML con tipo, idioma, fecha, fuente y partes procesadas.
- Los títulos generados no deben interpretarse como una transcripción literal de la estructura original.
- Verificar manualmente citas, nombres propios y timestamps antes de publicar un resultado.
