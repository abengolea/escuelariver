# Migración a la base de datos de la app nueva

Esta guía explica cómo migrar a un proyecto Firebase nuevo en lugar de `lexflow-consultas` (usado por Escuelas River).

## 1. Crear / obtener el proyecto Firebase de la app nueva

1. Entrá a [Firebase Console](https://console.firebase.google.com)
2. Si no existe, creá un proyecto nuevo
3. Habilitá **Authentication** (Email/Password)
4. Habilitá **Firestore** y **Storage**
5. Agregá una app web (icono `</>`) y anotá las credenciales

## 2. Actualizar `.env.local` (desarrollo local)

Copiá `.env.example` a `.env.local` y completá con los valores del **nuevo** proyecto:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<TU-PROJECT-ID>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<TU-PROJECT-ID>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<TU-PROJECT-ID>.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Los valores están en: **Firebase Console → Tu proyecto → Configuración (⚙️) → Tus apps**.

## 3. Cuenta de servicio (firebase-admin)

Para que los scripts y las API routes funcionen con el nuevo proyecto:

1. Firebase Console → Tu proyecto → Configuración → **Cuentas de servicio**
2. **Generar nueva clave privada** y guardá el JSON
3. Poné el archivo como `service-account.json` en la raíz del proyecto  
   O definí `GOOGLE_APPLICATION_CREDENTIALS` con la ruta al archivo

## 4. Crear el super admin en el nuevo proyecto

```bash
npm run seed:super-admin
```

Eso crea el usuario `abengolea1@gmail.com` en Auth y el documento `platformUsers` con `super_admin: true`.

## 5. Reglas de Firestore

Configurá las reglas de seguridad en Firestore para el nuevo proyecto. Podés basarte en las reglas actuales del proyecto `lexflow-consultas`.

## 6. Actualizar `apphosting.yaml` (producción)

Para desplegar con Firebase App Hosting contra el nuevo proyecto, editá `apphosting.yaml` y reemplazá:

| Variable | Reemplazar por |
|----------|----------------|
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<TU-PROJECT-ID>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | tu Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `<TU-PROJECT-ID>.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | el Sender ID de tu app |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | el App ID de tu app |
| `NEXT_PUBLIC_APP_URL` | la URL que asigne App Hosting (o tu dominio) |

También tenés que crear/actualizar el secret `firebase-api-key` con la API key del **nuevo** proyecto:

```bash
firebase apphosting:secrets:set firebase-api-key
```

## 7. Reiniciar el servidor

Después de cambiar `.env.local`:

```bash
npm run dev
```

## Datos existentes

Si necesitás migrar datos desde `lexflow-consultas` al nuevo proyecto, tendrás que exportar/importar manualmente o usar scripts de migración. Firebase no tiene migración automática entre proyectos.
