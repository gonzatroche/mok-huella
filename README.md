# Huella de Carbono — Inventario de GEI (template genérico)

App web para gestionar el **inventario de huella de carbono corporativa según ISO 14064-1:2018**,
organizada por las **cláusulas operativas de la norma**. Es un template **genérico**: la
organización y todos los catálogos (tipos de sitio, fuentes y factores de emisión) se cargan
desde la app, sin datos de empresa hardcodeados.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage) · recharts.

## Módulos (por cláusula de la norma)

- **5 · Límites**: límites organizacionales, sitios e instalaciones, tipos de sitio, categorías de emisión (las 6 de ISO 14064-1).
- **6 · Cuantificación**: inventario de emisiones (cálculo automático de t CO₂eq), fuentes, factores y año base.
- **7 · Mitigación**: objetivos y proyectos de reducción / remoción de GEI.
- **8 · Gestión de datos**: evidencias (con carga de archivos), control de calidad/incertidumbre, documentación y responsables.
- **9 · Reporte**: consolidado por categoría/trimestre/sitio (con gráficos), indicadores de intensidad e informe de huella.
- **Verificación (ISO 14064-3)**: verificaciones del inventario con hallazgos, y no conformidades con acciones.

El núcleo es el **inventario de emisiones**: cada registro guarda el dato de actividad, la unidad,
el factor de emisión y calcula `emisiones (t CO₂eq) = cantidad × factor ÷ 1000` (columna calculada
en Postgres, no editable). La organización y el año base se configuran en **Configuración**.

## Puesta en marcha (local, con Supabase CLI + Docker)

1. Tener **Docker Desktop** corriendo e instalar la CLI: `brew install supabase/tap/supabase`.
2. En la raíz del proyecto:
   ```bash
   supabase start     # levanta Postgres + Auth + Studio locales
   ```
   Anotá lo que imprime: `API URL` (http://127.0.0.1:54321), `anon key`, `service_role key`
   y Studio (http://127.0.0.1:54323).
3. Aplicar el esquema: abrir Studio → **SQL Editor**, pegar y correr `supabase/schema.sql`.
   (Alternativa: `supabase db reset`, que aplica `supabase/migrations/`.)
4. Copiar `.env.example` a `.env.local` y completar con los valores del paso 2.
5. Crear el primer usuario en Studio → **Authentication → Users** (email + password).
   Sin fila en `user_profiles`, el rol cae a `admin` (fallback) → desde **Configuración** podés
   dar de alta al resto del equipo y sus roles.
6. Instalar y correr:
   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```
7. Cargar los datos de tu organización y el año base en **Configuración** y **6 · Año base**.
   Después cargá los catálogos (tipos de sitio, fuentes, factores) y empezá el inventario.

### Alternativa sin Docker

Crear un proyecto gratis en [supabase.com](https://supabase.com), correr `supabase/schema.sql`
en su SQL Editor y apuntar `.env.local` a esa URL y claves. El código es idéntico.

## Documentos de referencia

En `docs/` están las guías de implementación de huella ISO 14064 (catálogos de fuentes, factores
de emisión e indicadores de intensidad) que sirven de base para poblar los catálogos.

## Verificar

```bash
npx tsc --noEmit   # typecheck
npm run build      # build de producción
```
