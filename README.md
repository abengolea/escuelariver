# Escuela River App

Aplicación web para gestión y seguimiento de jugadores de escuelas de fútbol.

Desarrollada con Next.js y Firebase (Firestore, Auth, App Hosting).

## Desarrollo
El código vive en Firebase Studio y se trabaja localmente con Node.js.

**Variables de entorno:** Copiar `.env.example` a `.env.local` y rellenar los valores (Firebase, Genkit). No commitear credenciales.

Punto de entrada:
- src/app/page.tsx

## Staging y producción (Firebase App Hosting)

Las variables de Firebase ya están definidas en `apphosting.yaml`. La **clave de API** no va en el repo: se inyecta desde **Secret Manager**.

### Subir la clave de Firebase a staging/producción (una vez por backend)

1. En la raíz del proyecto, con Firebase CLI instalado y logueado:
   ```bash
   firebase apphosting:secrets:set firebase-api-key
   ```
2. Cuando pida el valor, pega la **misma clave** que tienes en `.env.local` (`NEXT_PUBLIC_FIREBASE_API_KEY`).
3. Si tienes **varios backends** (staging y producción en proyectos o backends distintos), ejecuta el comando en cada uno y pega la clave correspondiente.

Tras el siguiente deploy, App Hosting usará esa clave. No hace falta tocar la consola web; el `apphosting.yaml` ya referencia el secret `firebase-api-key`.
