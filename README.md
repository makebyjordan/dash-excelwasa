# Dashboard Leads ExcelWasa

Dashboard web (HTML/CSS/JS) con:

- Lectura en vivo desde Google Sheets (endpoint `gviz`)
- Tabla de leads con búsqueda y filtro por estado
- Métricas resumen
- Vista por origen (barras)
- Modo dark/light
- Modal de configuración para cambiar `sheetId`, `gid` y rango

## Uso rápido

1. Abre `index.html` en el navegador.
2. Si no carga datos, en Google Sheets comparte la hoja como:
   - `Cualquiera con el enlace` -> `Lector`
3. Pulsa `Configurar fuente` y revisa:
   - Spreadsheet ID
   - GID (pestaña)
   - Rango (opcional, por defecto `A1:R`)

## Fuente por defecto

Se carga automáticamente esta hoja:

- Spreadsheet ID: `1dpTWl8ciiS_nU7UgbNmXq-1og9FmDwWiDUHVtDsde-U`
- GID: `1114581047`

## Nota

La configuración y el tema se guardan en `localStorage`, por lo que persisten entre recargas.
