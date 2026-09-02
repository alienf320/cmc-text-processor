# Plan de implementación: preparación del portfolio

## Objetivo

Preparar `yt-transcriber` para su publicación en GitHub como proyecto de portfolio, priorizando seguridad, reproducibilidad, calidad técnica, documentación y una presentación clara para recruiters. La arquitectura también debe permitir reemplazar proveedores —por ejemplo, usar OpenAI para traducción y MEGA para almacenamiento— sin modificar los casos de uso principales.

## Progreso actual

- Fase 0: auditor?a de publicaci?n avanzada; queda una revisi?n manual final antes de publicar.
- Fase 1: README, gu?a de uso, arquitectura y configuraci?n documentados; faltan demo, capturas, ejemplos y badges verificados.
- Fase 3.1: contrato `TextGenerator` y adaptador Gemini implementados; falta integrar factories y desacoplar almacenamiento/transcripciones.
- Fase 2 y el resto de Fase 3 en adelante: pendientes.

## Resultado esperado

Un recruiter debería poder, en pocos minutos:

1. Entender qué problema resuelve el proyecto.
2. Verlo funcionando mediante una demo o capturas.
3. Levantarlo localmente sin conocimiento previo del proyecto.
4. Identificar decisiones técnicas y desafíos reales.
5. Ver evidencia de tests, CI y buenas prácticas.

## Estado de referencia

- Backend Node.js/Express en la raíz.
- Frontend Angular 21 en `electron-angular-test/`.
- Procesamiento con Google Gemini.
- Cloudflare Worker para obtener transcripciones de YouTube desde el frontend.
- Integración opcional con Google Drive.
- Build Angular funcional.
- Test raíz todavía placeholder.
- Tests Angular bloqueados por falta de `jsdom` o `happy-dom`.
- No hay cobertura ni tests E2E configurados.
- El repositorio contiene archivos no versionados que deben revisarse antes de publicar.

## Principios de implementación

- Resolver primero los riesgos de seguridad.
- No agregar features que no mejoren la historia del portfolio.
- Mantener cambios pequeños y verificables.
- Documentar limitaciones reales en lugar de ocultarlas.
- No incluir secretos ni datos personales en ejemplos, capturas o fixtures.
- Cada fase debe dejar el proyecto en un estado ejecutable.
- Los casos de uso dependen de capacidades internas, no de SDKs o servicios concretos.
- Cada integración externa debe ser reemplazable mediante un adaptador y configuración.

## Arquitectura objetivo: proveedores reemplazables

La aplicación debe evolucionar hacia una arquitectura ligera de puertos y adaptadores. No se busca una reescritura ni una abstracción genérica excesiva: se definen contratos pequeños para las dependencias que realmente pueden cambiar.

### Puertos principales

```text
src/
├── domain/
│   ├── ports/
│   │   ├── text-generator.js
│   │   ├── document-storage.js
│   │   └── transcript-provider.js
│   └── useCases/
│       ├── processDocument.js
│       └── analyzeDocument.js
├── adapters/
│   ├── ai/
│   │   ├── geminiTextGenerator.js
│   │   └── openaiTextGenerator.js
│   ├── storage/
│   │   ├── localFileStorage.js
│   │   ├── googleDriveStorage.js
│   │   └── megaStorage.js
│   └── youtube/
│       ├── youtubeTranscriptProvider.js
│       └── cloudflareTranscriptProvider.js
├── config/
└── interfaces/
    ├── http/
    └── cli/
```

### Contratos mínimos

#### TextGenerator

Debe aceptar un prompt de sistema y un prompt de usuario, y devolver texto junto con metadata del modelo utilizado. El retry, rate limiting y normalización de errores deben vivir en el adaptador o en una política independiente, no en los casos de uso.

#### DocumentStorage

Debe cubrir las operaciones que la aplicación realmente necesita:

```js
save(document)
list()
read(filename)
delete(filename)
```

Los casos de uso no deben saber si el documento se guarda en el filesystem, Google Drive, MEGA, S3 o cualquier otro servicio.

#### TranscriptProvider

Debe encapsular la obtención de transcripciones y permitir elegir entre el proveedor local de YouTube y el Cloudflare Worker según el entorno.

### Configuración por ambiente

Agregar una configuración validada al inicio:

```env
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
STORAGE_PROVIDER=local
TRANSCRIPT_PROVIDER=youtube
```

Ejemplo para una futura instalación:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
STORAGE_PROVIDER=mega
TRANSCRIPT_PROVIDER=cloudflare
```

La configuración debe seleccionar adaptadores mediante factories. No se deben dispersar condicionales como `if (provider === ...)` dentro de `processText.js`, `server.js` o los componentes Angular.

### Regla de dependencia

```text
Interfaces HTTP / CLI
          ↓
Casos de uso de dominio
          ↓
Puertos (contratos)
          ↑
Adaptadores Gemini, OpenAI, Drive, MEGA, local, YouTube, Worker
```

Los adaptadores pueden depender de SDKs externos. El dominio y los casos de uso no.

## Pr?ximo bloque de implementaci?n

**Fase 3.1 ? Contrato de generaci?n de texto y adaptador Gemini**

- [x] Definir el contrato m?nimo `TextGenerator` sin acoplarlo al SDK de Gemini.
- [x] Encapsular la integraci?n actual de Gemini detr?s del adaptador.
- [x] Mantener el contrato de salida actual para no romper CLI ni API.
- [x] Verificar el adaptador con un smoke test local sin llamar a la API real.

## Fases

### Fase 0 — Auditoría previa y seguridad

**Prioridad:** crítica

- [x] Revisar `git status` y todos los archivos tracked.
- [x] Confirmar que `.env`, `credentials.json`, `token.json` y claves de Google nunca fueron commiteados.
- [x] Revisar el historial de Git por posibles secretos.
- [x] Agregar `.env.example` con nombres de variables, valores ficticios y comentarios.
- [x] Documentar las variables necesarias para desarrollo y deploy.
- [x] Revisar `renew_token.cjs` y decidir si se versiona, se documenta o se elimina.
- [x] Confirmar que las carpetas con entradas y resultados personales no se publiquen.
- [x] Verificar la codificación UTF-8 de los archivos con texto en español.

**Criterio de aceptación:** no existen secretos, tokens, credenciales ni datos personales en el historial o en los archivos que se publicarán.

### Fase 1 — README y presentación

**Prioridad:** alta

- [x] Reescribir `README.md` con un resumen orientado al problema y al resultado.
- [x] Agregar una sección de funcionalidades principales.
- [ ] Agregar screenshot o GIF del flujo principal.
- [ ] Agregar enlace a la demo desplegada, si permanece disponible.
- [x] Documentar arquitectura con un diagrama simple.
- [x] Explicar el flujo YouTube → Cloudflare Worker → API → Gemini → resultado Markdown.
- [x] Documentar instalación, configuración, ejecución local y troubleshooting.
- [x] Agregar una sección de limitaciones conocidas.
- [x] Agregar una sección de decisiones técnicas y desafíos resueltos.
- [ ] Agregar badges de build/deploy cuando los workflows estén verificados.
- [ ] Incluir ejemplos pequeños de entrada y salida.

**Criterio de aceptación:** una persona externa puede comprender el producto y ejecutarlo siguiendo únicamente el README.

### Fase 2 — Estructura y limpieza del repositorio

**Prioridad:** alta

- [ ] Evaluar renombrar `electron-angular-test/` a `frontend/`.
- [ ] Separar claramente backend, frontend, Worker, scripts y documentación.
- [ ] Revisar archivos antiguos como `index - groq.js`, `index - studio lm.js` y `deprecated/`.
- [ ] Mover documentación vigente a `docs/` o dejar referencias claras desde el README.
- [ ] Separar ejemplos públicos de datos locales.
- [ ] Revisar inconsistencias entre `Resultados/` y `resultados/`.
- [ ] Eliminar scripts experimentales que no aporten al producto o documentar su propósito.
- [ ] Normalizar nombres de archivos y convenciones.

**Criterio de aceptación:** la estructura del repositorio comunica la arquitectura sin depender de conocimiento histórico.

### Fase 3 — Desacoplamiento de proveedores

**Prioridad:** alta

#### 3.1 Caso de uso de procesamiento

- [ ] Separar el caso de uso de procesamiento de la infraestructura en `processText.js`.
- [ ] Extraer la lógica de chunking, continuidad y metadata a módulos independientes y testeables.
- [ ] Hacer que el caso de uso reciba dependencias (`textGenerator`, `documentStorage`) mediante parámetros o un contenedor pequeño.
- [ ] Evitar que el caso de uso importe directamente `@ai-sdk/google`, `googleapis` o SDKs de storage.
- [ ] Mantener el contrato actual de salida para no romper CLI ni API.

#### 3.2 Adaptación de IA

- [ ] Convertir `src/services/ai.js` en un adaptador `GeminiTextGenerator`.
- [ ] Definir el puerto `TextGenerator`.
- [ ] Crear un `OpenAITextGenerator` usando el SDK oficial de OpenAI.
- [ ] Separar selección de modelo, retry y clasificación de errores de la lógica de negocio.
- [ ] Configurar proveedor, modelo y API key mediante variables de entorno.
- [ ] Normalizar la respuesta para que Gemini y OpenAI devuelvan el mismo contrato.
- [ ] Documentar qué capacidades son comunes y cuáles dependen del proveedor.
- [ ] Agregar tests con un fake generator, sin llamadas reales a APIs.

#### 3.3 Adaptación de almacenamiento

- [ ] Definir el puerto `DocumentStorage`.
- [ ] Convertir el filesystem local en `LocalFileStorage`.
- [ ] Encapsular Google Drive en `GoogleDriveStorage`.
- [ ] Crear una interfaz de configuración para agregar un futuro `MegaStorage` sin tocar los casos de uso.
- [ ] Investigar y documentar el método de autenticación y la API oficial de MEGA antes de implementar ese adaptador.
- [ ] Mover el fallback local a una política de composición, no a condicionales repartidos por las rutas.
- [ ] Hacer que CLI y API consuman el mismo contrato de almacenamiento.
- [ ] Agregar tests de contrato ejecutables contra local y fakes de Drive/MEGA.

#### 3.4 Adaptación de transcripciones

- [ ] Definir el puerto `TranscriptProvider`.
- [ ] Convertir `src/modules/youtube.js` en un adaptador de transcripción local/backend.
- [ ] Documentar el Cloudflare Worker como adaptador específico del frontend.
- [ ] Evitar que la UI conozca detalles de parsing de URLs o del formato de respuesta del Worker.

#### 3.5 Factories y configuración

- [ ] Crear un módulo de configuración que valide variables obligatorias y valores permitidos.
- [ ] Crear factories para `TextGenerator`, `DocumentStorage` y `TranscriptProvider`.
- [ ] Fallar al iniciar con un mensaje claro si se selecciona un proveedor no configurado.
- [ ] Agregar `.env.example` con combinaciones documentadas de desarrollo y producción.
- [ ] No usar secretos como valores por defecto.

**Criterio de aceptación:** cambiar `AI_PROVIDER` de Gemini a OpenAI o `STORAGE_PROVIDER` de local a un adaptador remoto no requiere modificar los casos de uso, las rutas Express ni los componentes Angular.

### Fase 4 — Tests y calidad automatizada

**Prioridad:** alta

- [ ] Reemplazar el placeholder de `npm test` raíz.
- [ ] Agregar tests unitarios para extracción de IDs de YouTube.
- [ ] Agregar tests para chunking de textos largos.
- [ ] Agregar tests para metadata y nombres de archivos.
- [ ] Agregar tests de validación de entradas y errores.
- [ ] Instalar y configurar `jsdom` o `happy-dom` para los tests Angular.
- [ ] Cubrir estados principales del frontend: carga, éxito, error y resultados vacíos.
- [ ] Agregar tests de integración para `/api/health`, `/api/process` y `/api/analyze` con dependencias externas mockeadas.
- [ ] Configurar cobertura mínima razonable.
- [ ] Agregar ESLint y Prettier con scripts reproducibles.
- [ ] Corregir el warning del presupuesto de `app.scss` o justificarlo explícitamente.

**Criterio de aceptación:** `npm test`, lint y formatter se ejecutan desde comandos documentados y también desde CI.

### Fase 5 — CI/CD y reproducibilidad

**Prioridad:** media-alta

- [ ] Crear un workflow de validación para pull requests.
- [ ] Ejecutar instalación limpia, lint, tests y build.
- [ ] Mantener separado el workflow de deploy de Pages del workflow de validación.
- [ ] Usar versiones de Node explícitas y consistentes.
- [ ] Documentar los secretos requeridos por Render, GitHub Actions y Cloudflare.
- [ ] Verificar que el build use correctamente `base-href` según el entorno.
- [ ] Agregar badges solo después de confirmar que representan checks reales.

**Criterio de aceptación:** un pull request que rompe tests, lint o build queda bloqueado automáticamente.

### Fase 6 — Robustez del producto

**Prioridad:** media

- [ ] Centralizar el manejo de errores de Express.
- [ ] Validar URLs de YouTube, nombres de archivo, tipo de contenido y tamaño de entrada.
- [ ] Validar la configuración al iniciar y mostrar errores accionables.
- [ ] Configurar URLs de API y Worker por ambiente.
- [ ] Revisar limpieza de archivos temporales ante errores.
- [ ] Revisar compatibilidad de rutas y nombres en Linux.
- [ ] Añadir límites y mensajes claros para textos demasiado grandes.
- [ ] Asegurar que las respuestas de Drive y almacenamiento local tengan el mismo contrato.

**Criterio de aceptación:** los errores esperables no producen stack traces innecesarios ni dejan archivos temporales abandonados.

### Fase 7 — UX, accesibilidad y demo

**Prioridad:** media

- [ ] Mejorar estados de carga, error y vacío.
- [ ] Revisar labels, navegación por teclado y contraste.
- [ ] Agregar metadata Open Graph y favicon.
- [ ] Preparar una demo reproducible con datos no sensibles.
- [ ] Grabar un GIF corto del flujo principal.
- [ ] Crear capturas de YouTube, procesamiento de texto, resultados y Q&A.
- [ ] Agregar un documento `docs/demo-script.md` con el recorrido recomendado.

**Criterio de aceptación:** la demo muestra valor en menos de un minuto y no depende de credenciales personales visibles.

## Orden recomendado de ejecución

1. Fase 0 — Seguridad.
2. Fase 1 — README y presentación.
3. Fase 2 — Limpieza estructural mínima.
4. Fase 3 — Desacoplamiento de proveedores.
5. Fase 4 — Tests y calidad.
6. Fase 5 — CI/CD.
7. Fase 6 — Robustez.
8. Fase 7 — UX y demo.

## Definition of Done

- [ ] El repositorio no contiene secretos ni datos personales.
- [ ] El README explica propósito, arquitectura, instalación, demo y limitaciones.
- [ ] El proyecto tiene comandos funcionales de test, lint y build.
- [ ] CI ejecuta las validaciones principales.
- [ ] La demo o las capturas muestran el producto funcionando.
- [ ] Las decisiones técnicas importantes están documentadas.
- [ ] El estado publicado coincide con el estado real del sistema.
- [ ] Una revisión externa puede identificar rápidamente el aporte técnico del proyecto.
- [ ] La documentación incluye un ejemplo de cambio de proveedor de IA y almacenamiento.
- [ ] Los adaptadores tienen tests de contrato o fakes verificables.

## Próximo bloque de trabajo

Comenzar por la Fase 0 y no publicar el repositorio hasta completar la auditoría de secretos e historial de Git. Luego implementar primero los puertos de IA y almacenamiento, manteniendo Gemini y filesystem local como adaptadores iniciales; OpenAI y MEGA pueden incorporarse después sin rediseñar el dominio.
