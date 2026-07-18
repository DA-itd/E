# Cómo publicar cambios — Guía rápida

Cada vez que Claude te dé un archivo nuevo o modificado (o cada vez que tú
edites algo directo en VS Code), sigue estos pasos **en este orden**:

## 1. Reemplaza los archivos en tu carpeta local

Copia el/los archivo(s) nuevo(s) sobre los que ya tienes en
`inscripciones-itd/` (mismo nombre, misma carpeta).

## 2. Pruébalo en tu computadora ANTES de publicar

```bash
npm run dev
```

Abre `http://localhost:5173/E/` y revisa que se vea/funcione bien.
Si algo se ve mal, dile a Claude ANTES de seguir a los pasos de abajo —
así no publicas algo roto.

**Detén el servidor** cuando termines de probar: `Ctrl + C` en la terminal.

## 3. Guarda el cambio en GitHub (esto es el "respaldo")

```bash
git add .
git commit -m "descripción breve de qué cambiaste"
git push
```

Esto guarda tu código en `github.com/DA-itd/E`, pero **todavía NO actualiza
lo que ven los docentes** en la página en vivo.

## 4. Publica la versión en vivo (esto es lo que ven los docentes)

```bash
npm run build
npm run deploy
```

- `npm run build` arma la versión final optimizada (carpeta `dist/`)
- `npm run deploy` sube esa carpeta a GitHub Pages

Espera 1-2 minutos, luego revisa `https://da-itd.github.io/E/` con
**Cmd+Shift+R** (recarga forzada, para que tu navegador no te muestre una
copia vieja guardada).

---

## Resumen ultra-corto (cuando ya tengas práctica)

```bash
# 1. Reemplazar archivos (manual)
# 2. Probar local
npm run dev        # Ctrl+C para detener cuando termines de probar

# 3. Respaldar en GitHub
git add .
git commit -m "mensaje"
git push

# 4. Publicar en vivo
npm run build
npm run deploy
```

## Errores comunes y qué hacen

| Error | Qué significa | Qué hacer |
|---|---|---|
| `Failed to get remote.origin.url` | No hay remoto configurado en esta carpeta | `git remote add origin https://github.com/DA-itd/E.git` |
| `remote origin already exists` | Ya había un remoto (puede estar mal apuntado) | `git remote -v` para revisar a dónde apunta antes de tocar nada |
| Pantalla en blanco después de publicar | Puede ser caché del navegador, o que faltó `npm run build` antes del `deploy` | Cmd+Shift+R primero; si sigue, revisar consola del navegador (F12) |
| VITE_SUPABASE_URL no funciona | El `.env` tiene mal escrito el nombre de la variable | Debe ser exactamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` |

## Cosas que NUNCA se suben a GitHub (ya están protegidas en `.gitignore`)

- `.env` / `.env.local` (tus claves de Supabase)
- `node_modules/` (se reinstala con `npm install`)
- `dist/` (se genera con `npm run build`)
