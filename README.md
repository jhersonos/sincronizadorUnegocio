# Sincronizador uNegocio - Dashboard HubDB

Dashboard para sincronización y mapeo de datos entre base de datos y HubDB.

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp env.example .env
```

3. Editar `.env` con tus credenciales:
   
   **HubSpot:**
   - `HUBSPOT_API_TOKEN`: Tu API token de HubSpot (PAT)
   - `HUBSPOT_PORTAL_ID`: ID de tu portal de HubSpot
   - `HUBDB_TABLE_ID`: ID de la tabla de HubDB que deseas usar
   
   **MySQL:**
   - `MYSQL_HOST`: Host de tu base de datos (default: localhost)
   - `MYSQL_PORT`: Puerto de MySQL (default: 3306)
   - `MYSQL_USER`: Usuario de MySQL
   - `MYSQL_PASSWORD`: Contraseña de MySQL
   - `MYSQL_DATABASE`: Nombre de la base de datos
   - `MYSQL_TABLE`: Nombre de la tabla

4. Iniciar el servidor:
```bash
npm start
```

Para desarrollo con auto-reload:
```bash
npm run dev
```

5. Abrir en el navegador:
```
http://localhost:3000
```

## Estructura del Proyecto

```
├── server.js                 # Punto de entrada del servidor
├── src/
│   ├── config/
│   │   ├── hubdb.js         # Configuración de HubDB
│   │   └── database.js      # Configuración de MySQL
│   ├── controllers/
│   │   └── hubdbController.js # Controladores para HubDB
│   ├── routes/
│   │   └── api.js           # Rutas de la API
│   └── public/
│       ├── index.html       # Dashboard principal
│       ├── css/
│       │   └── styles.css   # Estilos del dashboard
│       └── js/
│           └── dashboard.js # Lógica del frontend
├── .env                     # Variables de entorno (no commitear)
└── package.json
```

## Sprints

### Sprint 1 ✅
- Dashboard con selectores dinámicos para campos de HubDB
- Generación automática de selectores según cantidad de campos
- Integración con API de HubSpot HubDB

### Sprint 2 (Próximo)
- Listado de campos de base de datos MySQL
- Asociación de campos entre HubDB y base de datos
- Sistema de mapeo de campos
