# Inscripciones ITD — Módulo 1

Formulario de inscripción a cursos de Actualización Docente, con validación
automática de cupo y traslape de horario (aplicada en la base de datos, no
solo en el formulario).

## 1. Requisitos previos

- Haber corrido ya en Supabase, **en este orden**:
  1. `01_schema_inscripciones.sql`
  2. `02_migracion_docentes.sql`
  3. `03_migracion_convocatorias_y_cursos.sql`
  4. `04_migracion_historial.sql`
  5. `05_migracion_inscripciones_actuales.sql`

## 2. Configurar Google OAuth en Supabase

1. En Google Cloud Console, crea (o reusa) un OAuth Client ID de tipo
   "Web application".
2. En **Authorized redirect URIs** agrega la URL que te da Supabase en
   Authentication → Providers → Google (algo como
   `https://TU-PROYECTO.supabase.co/auth/v1/callback`).
3. En Supabase → Authentication → Providers, activa **Google** y pega el
   Client ID y Client Secret.
4. En Authentication → URL Configuration, agrega la URL donde publiques
   este sitio (ej. `https://da-itd.github.io/inscripciones-itd/`) tanto en
   "Site URL" como en "Redirect URLs".

   Nota importante: el parámetro `hd=itdurango.edu.mx` que manda el botón de
   login es una ayuda de interfaz (Google prioriza cuentas de ese dominio en
   el selector), **no** una barrera de seguridad. La verificación real ocurre
   en `App.jsx` (cierra sesión si el correo no termina en
   `@itdurango.edu.mx`) y en las políticas RLS de la base de datos.

## 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos de
Supabase → Project Settings → API.

## 3.5 Configurar el envío de correos (confirmación / cancelación)

Esto reemplaza el `MailApp.sendEmail` de tu sistema anterior.

1. Crea una cuenta gratis en **https://resend.com** (100 correos/día gratis).
2. En Resend, ve a **API Keys** y crea una nueva — cópiala.
3. **Importante sobre el remitente:** mientras no verifiques tu propio dominio
   (`itdurango.edu.mx`) en Resend, solo podrás mandar correos usando la
   dirección de pruebas `onboarding@resend.dev`, y **solo llegarán a la
   cuenta con la que te registraste en Resend** — para mandar a cualquier
   docente real, verifica tu dominio en Resend → Domains (agrega un registro
   DNS que te va a pedir; puede tardar unas horas en propagarse).
4. Instala la CLI de Supabase si no la tienes:
   ```bash
   npm install -g supabase
   ```
5. Desde la carpeta del proyecto, conéctala a tu proyecto real:
   ```bash
   supabase login
   supabase link --project-ref htkiilwlnglqvcfzekwg
   ```
6. Configura los secrets (variables de entorno) de la función:
   ```bash
   supabase secrets set RESEND_API_KEY=tu_api_key_de_resend
   supabase secrets set FROM_EMAIL=onboarding@resend.dev
   ```
   (cuando verifiques tu dominio, cambia `FROM_EMAIL` a algo como
   `coord_actualizaciondocente@itdurango.edu.mx`)
7. Publica la función:
   ```bash
   supabase functions deploy send-email
   ```

Con esto, la app ya manda correo de confirmación al inscribirse y de
cancelación al dar de baja o liberar un curso — igual que tu sistema
anterior. Si el correo falla por cualquier motivo, la inscripción/cancelación
**ya quedó guardada de todos modos**; solo no llegaría el aviso por correo.

## 3.6 Configurar el respaldo oculto en Google Drive

Esto guarda una copia de cada constancia/reconocimiento generado en:
https://drive.google.com/drive/folders/1MCOBmSka8lbdVQAaH4U-TLzhxh41i734

1. Ve a **https://console.cloud.google.com** (puedes usar el mismo proyecto
   donde ya tienes el Client ID de Google OAuth).
2. **IAM & Admin → Service Accounts → Create Service Account**. Nómbrala
   algo como `constancias-drive`. No necesita roles de proyecto, solo
   creala.
3. Entra a la cuenta de servicio recién creada → pestaña **Keys** → **Add
   Key → Create new key → JSON**. Se descarga un archivo `.json` — ábrelo,
   ahí están `client_email` y `private_key`.
4. **Habilita la API:** en el buscador de Google Cloud, busca "Google
   Drive API" y dale **Enable** (si no estaba ya habilitada).
5. **Comparte la carpeta de Drive** con el `client_email` de la cuenta de
   servicio (algo como `constancias-drive@tu-proyecto.iam.gserviceaccount.com`):
   entra a la carpeta en Drive → Compartir → pega ese correo → dale
   permiso de **Editor**.
6. Configura los secrets en Supabase:
   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=constancias-drive@tu-proyecto.iam.gserviceaccount.com
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
   supabase secrets set GOOGLE_DRIVE_FOLDER_ID=1MCOBmSka8lbdVQAaH4U-TLzhxh41i734
   ```
   (la `private_key` del JSON descargado ya trae los `\n` como texto —
   cópiala tal cual, entre comillas dobles)
7. Publica la función:
   ```bash
   supabase functions deploy constancia-drive
   ```
8. Corre `13_constancias_generadas.sql` en el SQL Editor de Supabase.

**Cómo se comporta:** la primera vez que alguien descarga una constancia,
se genera y sube una copia oculta a esa carpeta (el docente nunca ve el
enlace de Drive). Si la vuelve a descargar después, en vez de generar una
copia nueva, se le manda la misma que ya estaba guardada -- así tienes en
Drive un registro fijo de quién ha generado qué. Si Drive no está
configurado todavía, la descarga sigue funcionando normal (solo no queda
el respaldo).

## 4. Desarrollo local

```bash
npm install
npm run dev
```

## 5. Publicar en GitHub Pages

1. En `vite.config.js`, ajusta `base` al nombre real de tu repositorio.
2. Crea el repositorio en GitHub y súbelo:
   ```bash
   git init
   git add .
   git commit -m "Módulo 1: inscripciones"
   git branch -M main
   git remote add origin https://github.com/DA-itd/NOMBRE-REPO.git
   git push -u origin main
   ```
3. Publica:
   ```bash
   npm run deploy
   ```
   Esto construye el proyecto y sube `dist/` a la rama `gh-pages`.
4. En GitHub → Settings → Pages, selecciona la rama `gh-pages` como fuente.

## Qué valida el sistema automáticamente (antes vivía solo como aviso)

- **Cupo máximo por curso** — no deja inscribir si ya está lleno.
- **Máximo 2 cursos activos por convocatoria** (ej. "Agosto 2026").
- **Sin traslape de fechas** entre los cursos de una misma convocatoria.

Estas tres reglas están en un trigger de Postgres (`fn_validar_inscripcion`
en `01_schema_inscripciones.sql`), así que aplican sin importar desde dónde
se inserte el registro — este formulario, otro cliente, o el panel de
administración que se construya después.

## Pendiente para siguientes fases

- Panel de administración (altas/bajas de convocatorias y cursos, cierre de
  inscripciones, reportes).
- Generación y validación de constancias.
- Envío de correos de confirmación/recordatorio (Edge Function + Resend,
  reemplazando el envío actual con `MailApp` de Apps Script).
- Módulo 2: Propuesta y aprobación de cursos (oficios, criterios de
  selección de instructor).
