/**
 * Dashboard principal para sincronización de HubDB
 * Sprint 1: Selectores dinámicos para campos de HubDB
 */

class HubDBDashboard {
    constructor() {
        this.fields = [];
        this.dbFields = [];
        this.tableInfo = null;
        this.syncRows = [];
        this.apiBaseUrl = '/api';
        
        this.init();
    }

    /**
     * Inicializa el dashboard
     */
    async init() {
        this.setupEventListeners();
        await this.loadTableInfo();
        await this.loadFields();
    }

    /**
     * Configura los event listeners
     */
    setupEventListeners() {
        // Tabs principales (BD → HubDB / HubDB → BD)
        const tabButtons = document.querySelectorAll('.tab-button');
        const mappingView = document.getElementById('view-mapping');
        const reverseView = document.getElementById('view-reverse');

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;

                tabButtons.forEach((b) => b.classList.remove('tab-active'));
                btn.classList.add('tab-active');

                if (mappingView && reverseView) {
                    if (view === 'mapping') {
                        mappingView.classList.remove('dashboard-content-hidden');
                        reverseView.classList.add('dashboard-content-hidden');
                    } else {
                        reverseView.classList.remove('dashboard-content-hidden');
                        mappingView.classList.add('dashboard-content-hidden');
                    }
                }
            });
        });

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadFields();
                this.loadTableInfo();
            });
        }

        // Checkbox "Seleccionar todos"
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.field-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    this.toggleRowState(checkbox);
                });
                this.updateSelectAllCheckbox();
            });
        }

        // Botón para preparar la sincronización
        const syncShowBtn = document.getElementById('sync-show-btn');
        if (syncShowBtn) {
            syncShowBtn.addEventListener('click', () => {
                this.prepareSyncTable();
            });
        }

        // Botón para iniciar la sincronización
        const syncStartBtn = document.getElementById('sync-start-btn');
        if (syncStartBtn) {
            syncStartBtn.addEventListener('click', () => {
                this.startSynchronization();
            });
        }
    }

    /**
     * Carga la información de la tabla
     */
    async loadTableInfo() {
        const tableInfoContainer = document.getElementById('table-info');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/hubdb/table-info`);
            const result = await response.json();

            if (result.success) {
                this.tableInfo = result.data;
                this.renderTableInfo(result.data);
            } else {
                tableInfoContainer.innerHTML = `
                    <p class="error">Error: ${result.error}</p>
                `;
            }
        } catch (error) {
            console.error('Error al cargar información de la tabla:', error);
            tableInfoContainer.innerHTML = `
                <p class="error">Error al conectar con el servidor</p>
            `;
        }
    }

    /**
     * Renderiza la información de la tabla
     */
    renderTableInfo(info) {
        const container = document.getElementById('table-info');
        
        container.innerHTML = `
            <div class="table-info-item">
                <span class="table-info-label">Nombre:</span>
                <span class="table-info-value">${info.name || 'N/A'}</span>
            </div>
            <div class="table-info-item">
                <span class="table-info-label">Etiqueta:</span>
                <span class="table-info-value">${info.label || 'N/A'}</span>
            </div>
            <div class="table-info-item">
                <span class="table-info-label">ID de Tabla:</span>
                <span class="table-info-value">${info.id || 'N/A'}</span>
            </div>
            <div class="table-info-item">
                <span class="table-info-label">Cantidad de Campos:</span>
                <span class="table-info-value">${info.columnsCount || 0}</span>
            </div>
        `;
    }

    /**
     * Carga los campos de HubDB
     */
    async loadFields() {
        const container = document.getElementById('selectors-container');
        
        // Mostrar estado de carga
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando campos de HubDB...</p>
            </div>
        `;

        try {
            const response = await fetch(`${this.apiBaseUrl}/hubdb/fields`);
            const result = await response.json();

            if (result.success) {
                this.fields = result.data;

                // Una vez que tenemos los campos de HubDB, cargamos los campos de BD
                await this.loadDatabaseFields();

                this.showMessage(`✅ ${result.count} campos de HubDB cargados`, 'success');
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>Error al cargar campos</h3>
                        <p>${result.error || 'Error desconocido'}</p>
                    </div>
                `;
                this.showMessage(`❌ Error: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error al cargar campos:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔌</div>
                    <h3>Error de conexión</h3>
                    <p>No se pudo conectar con el servidor. Verifica tu conexión.</p>
                </div>
            `;
            this.showMessage('❌ Error de conexión con el servidor', 'error');
        }
    }

    /**
     * Carga los campos de la base de datos (MySQL)
     */
    async loadDatabaseFields() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/db/fields`);
            const result = await response.json();

            if (result.success) {
                this.dbFields = result.data;

                if (!this.dbFields || this.dbFields.length === 0) {
                    this.showMessage('⚠️ La tabla de base de datos no tiene columnas o no se encontraron.', 'warning');
                } else {
                    this.showMessage(`✅ ${result.count} campos de base de datos cargados`, 'success');
                }

                // Renderizar la tabla de mapeo cuando tengamos ambos sets de campos
                this.renderSelectors();
            } else {
                this.dbFields = [];
                this.renderSelectors(); // Renderizamos igual, pero sin opciones de BD

                this.showMessage(
                    `⚠️ No se pudieron cargar los campos de la base de datos: ${result.error || 'Error desconocido'}`,
                    'warning'
                );
            }
        } catch (error) {
            console.error('Error al cargar campos de base de datos:', error);
            this.dbFields = [];
            this.renderSelectors();
            this.showMessage('⚠️ Error de conexión al cargar los campos de la base de datos', 'warning');
        }
    }

    /**
     * Renderiza los campos en formato tabla con checkbox
     */
    renderSelectors() {
        const container = document.getElementById('selectors-container');
        const fields = this.fields || [];

        if (!fields || fields.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <h3>No hay campos disponibles</h3>
                            <p>La tabla de HubDB no tiene campos configurados.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Generar opciones de base de datos
        const hasDbFields = this.dbFields && this.dbFields.length > 0;

        // Generar una fila por cada campo de HubDB
        container.innerHTML = fields.map((field, index) => {
            // Sugerencia automática de campo de BD según el nombre del campo HubDB
            const suggestedDbFieldName = this.findDefaultDbFieldForHubdb(field);

            // Opciones desde la base de datos
            const dbOptions = hasDbFields
                ? this.dbFields
                      .map(
                          (col) => `
                    <option value="${col.name}" ${suggestedDbFieldName && col.name.toLowerCase() === suggestedDbFieldName.toLowerCase() ? 'selected' : ''}>
                        ${col.name} (${col.type}${col.isPrimaryKey ? ' - PK' : ''})
                    </option>`
                      )
                      .join('')
                : '';

            const optionsWithNone = `
                <option value="">-- No asignar --</option>
                ${dbOptions}
            `;

            return `
                <tr class="mapping-row" data-field-id="${field.id}">
                    <td class="col-checkbox">
                        <input 
                            type="checkbox" 
                            class="field-checkbox" 
                            data-field-id="${field.id}"
                            checked
                        >
                    </td>
                    <td class="col-hubdb">
                        <div class="hubdb-field">
                            <span class="hubdb-field-name">${field.label || field.name}</span>
                            <div class="hubdb-field-meta">
                                <span class="hubdb-field-type">${field.type}</span>
                                ${field.required ? '<span class="hubdb-field-required">Requerido</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td class="col-database">
                        <select 
                            class="database-field-select" 
                            data-field-id="${field.id}"
                            data-field-index="${index}"
                            aria-label="Seleccionar campo de base de datos para ${field.label || field.name}"
                            ${hasDbFields ? '' : 'disabled'}
                        >
                            ${optionsWithNone}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        // Agregar event listeners
        this.attachSelectorListeners();
        
        // Actualizar estado del checkbox "Seleccionar todos"
        this.updateSelectAllCheckbox();
    }

    /**
     * Actualiza el estado del checkbox "Seleccionar todos"
     */
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all');
        if (!selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('.field-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }

        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    /**
     * Adjunta event listeners a los checkboxes y selectores
     */
    attachSelectorListeners() {
        // Event listeners para checkboxes
        const checkboxes = document.querySelectorAll('.field-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleRowState(e.target);
                // Actualizar vista previa cuando cambie el checkbox
                this.updatePreview();
            });
        });

        // Event listeners para selectores de base de datos
        const selectors = document.querySelectorAll('.database-field-select');
        selectors.forEach(selector => {
            selector.addEventListener('change', (e) => {
                const fieldId = e.target.dataset.fieldId;
                const selectedFieldName = e.target.value; // Ahora es el nombre del campo de BD
                const field = this.fields.find(f => f.id === fieldId);
                const databaseField = selectedFieldName 
                    ? this.dbFields.find(f => f.name === selectedFieldName)
                    : null;
                
                console.log(`Mapeo actualizado:`, {
                    hubdbField: field?.label || field?.name,
                    databaseField: databaseField?.name || 'No asignado'
                });
                
                // Actualizar estado del checkbox si se desasigna
                const row = e.target.closest('.mapping-row');
                const checkbox = row.querySelector('.field-checkbox');
                if (!selectedFieldName && checkbox.checked) {
                    checkbox.checked = false;
                    this.toggleRowState(checkbox);
                } else if (selectedFieldName && !checkbox.checked) {
                    checkbox.checked = true;
                    this.toggleRowState(checkbox);
                }
                
                // Actualizar vista previa cuando cambie el selector
                this.updatePreview();
            });
        });
    }

    /**
     * Alterna el estado de una fila basado en el checkbox
     */
    toggleRowState(checkbox) {
        const row = checkbox.closest('.mapping-row');
        const select = row.querySelector('.database-field-select');
        
        if (checkbox.checked) {
            row.classList.remove('mapping-row-disabled');
            select.disabled = false;
        } else {
            row.classList.add('mapping-row-disabled');
            select.disabled = true;
            // Opcional: resetear el selector cuando se desactiva
            // select.value = '';
        }
        
        // Actualizar estado del checkbox "Seleccionar todos"
        this.updateSelectAllCheckbox();
    }

    /**
     * Intenta determinar automáticamente el campo de BD sugerido
     * para un campo de HubDB, replicando la lógica actual de sincronización.
     */
    findDefaultDbFieldForHubdb(hubdbField) {
        const name = (hubdbField?.name || '').toLowerCase();

        // Mapeos directos por nombre (HubDB → BD)
        const directMap = {
            // claves y campos básicos del programa
            'id_diploma': 'ID_DIPLOMA',
            'cod_diploma': 'cod_diploma',
            'programa': 'DIPLOMADO',
            'fecha_inicio': 'fecha_inicio',
            'fecha_termino': 'fecha_termino',
            'valor_diplomado': 'valor_diplomado',
            'moneda': 'moneda',
            'area_conocimiento': 'area_conocimiento',
            'horario_web': 'horario_web',
            'lnk_pdf': 'lnk_pdf',
            'modalidad_programa': 'modalidad_programa',
            'tipo_programa': 'tipo_programa',
            'nivel': 'nivel',
            'ceco': 'Cod_interno',

            // contenido descriptivo
            'descripcion': 'descripcion',
            'objetivos': 'objetivos',
            'imagen_destacada': 'imagen_destacada',
            'icono': 'icono',
            'consideraciones': 'consideraciones',
            'carrito': 'carrito',

            // estos campos pueden no existir tal cual en BD, se dejan sin sugerencia
            // 'plan_estudios': 'catedras',  // en tu PHP se arma como HTML/JSON
            // 'testimonios':  -> viene de otra consulta
        };

        if (directMap[name]) {
            return directMap[name];
        }

        // Heurística de fallback: si existe un campo de BD con el mismo nombre
        const sameName = this.dbFields?.find(
            (f) => f.name && f.name.toLowerCase() === name
        );
        if (sameName) {
            return sameName.name;
        }

        return null;
    }

    /**
     * Muestra un mensaje al usuario
     */
    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container');
        
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;
        
        container.appendChild(message);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            message.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 300);
        }, 5000);
    }

    /**
     * Obtiene el estado actual de los mapeos
     * Útil para guardar el mapeo antes de importar
     */
    getMappings() {
        const rows = document.querySelectorAll('.mapping-row');
        const mappings = [];
        
        rows.forEach(row => {
            const checkbox = row.querySelector('.field-checkbox');
            const select = row.querySelector('.database-field-select');
            const fieldId = row.dataset.fieldId;
            
            if (checkbox.checked && select.value) {
                const hubdbField = this.fields.find(f => f.id === fieldId);
                const databaseFieldName = select.value; // Nombre del campo de BD
                const databaseField = this.dbFields.find(f => f.name === databaseFieldName);
                
                if (hubdbField && databaseField) {
                    mappings.push({
                        enabled: true,
                        hubdbField: hubdbField,
                        databaseField: databaseField
                    });
                }
            }
        });
        
        return mappings;
    }

    /**
     * Prepara la tabla de sincronización con todos los registros de la base de datos
     * usando los mapeos seleccionados
     */
    async prepareSyncTable() {
        const syncCard = document.getElementById('sync-card');
        const syncContainer = document.getElementById('sync-table-container');
        const syncCount = document.getElementById('sync-count');
        const syncStartBtn = document.getElementById('sync-start-btn');

        const mappings = this.getMappings();

        if (!mappings || mappings.length === 0) {
            this.showMessage('⚠️ Debes seleccionar al menos un campo mapeado antes de sincronizar.', 'warning');
            return;
        }

        // Mostrar tarjeta y estado de carga
        syncCard.style.display = 'block';
        syncContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando registros de la base de datos...</p>
            </div>
        `;
        syncCount.textContent = '';
        if (syncStartBtn) {
            syncStartBtn.disabled = true;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/db/sync-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mappings }),
            });

            const result = await response.json();

            if (result.success) {
                this.syncRows = result.data || [];
                this.renderSyncTable(this.syncRows, mappings);
                syncCount.textContent = `${result.count} registros`;

                if (syncStartBtn) {
                    syncStartBtn.disabled = this.syncRows.length === 0;
                }

                if (this.syncRows.length === 0) {
                    this.showMessage('⚠️ No se encontraron registros en la base de datos para sincronizar.', 'warning');
                } else {
                    this.showMessage(`✅ Se cargaron ${result.count} registros para sincronización.`, 'success');
                }
            } else {
                syncContainer.innerHTML = `
                    <div class="preview-error">
                        <p>❌ Error: ${result.error || 'Error desconocido al cargar registros'}</p>
                    </div>
                `;
                syncCount.textContent = 'Error';
                this.showMessage(`❌ Error al cargar registros: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error al preparar tabla de sincronización:', error);
            syncContainer.innerHTML = `
                <div class="preview-error">
                    <p>❌ Error de conexión al cargar los registros</p>
                </div>
            `;
            syncCount.textContent = 'Error';
            this.showMessage('❌ Error de conexión al cargar los registros de sincronización', 'error');
        }
    }

    /**
     * Renderiza la tabla de registros a sincronizar, con checkboxes por fila
     */
    renderSyncTable(rows, mappings) {
        const container = document.getElementById('sync-table-container');

        if (!rows || rows.length === 0) {
            container.innerHTML = `
                <div class="preview-empty">
                    <p>No hay registros para mostrar.</p>
                </div>
            `;
            return;
        }

        // Encabezados: checkbox + columnas de HubDB seleccionadas
        const columns = mappings.map(m => ({
            header: m.hubdbField.label || m.hubdbField.name,
            dbField: m.databaseField.name,
        }));

        let html = `
            <div class="preview-table-container">
                <table class="preview-table sync-table">
                    <thead>
                        <tr>
                            <th>
                                <input type="checkbox" id="sync-select-all" title="Seleccionar todos los registros">
                            </th>
                            ${columns.map(col => `<th>${col.header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        rows.forEach((row, index) => {
            const codDiploma = row.cod_diploma ?? row.COD_DIPLOMA ?? row.codDiploma ?? '';

            html += `
                <tr class="sync-row" data-index="${index}" data-cod-diploma="${codDiploma}">
                    <td>
                        <input type="checkbox" class="sync-row-checkbox" checked>
                    </td>
            `;

            columns.forEach(col => {
                const value = row[col.dbField];
                const displayValue = value === null || value === undefined
                    ? '<em class="null-value">NULL</em>'
                    : String(value).length > 80
                        ? String(value).substring(0, 80) + '...'
                        : String(value);
                html += `<td>${displayValue}</td>`;
            });

            html += '</tr>';
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Listeners para checkboxes de la tabla de sincronización
        const selectAll = document.getElementById('sync-select-all');
        const rowCheckboxes = container.querySelectorAll('.sync-row-checkbox');

        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                rowCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });
        }

        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!selectAll) return;
                const total = rowCheckboxes.length;
                const checkedCount = Array.from(rowCheckboxes).filter(x => x.checked).length;

                if (checkedCount === 0) {
                    selectAll.checked = false;
                    selectAll.indeterminate = false;
                } else if (checkedCount === total) {
                    selectAll.checked = true;
                    selectAll.indeterminate = false;
                } else {
                    selectAll.checked = false;
                    selectAll.indeterminate = true;
                }
            });
        });
    }

    /**
     * Inicia el proceso de sincronización contra HubDB
     * usando cod_diploma (BD) vs cod_diploma (HubDB)
     */
    async startSynchronization() {
        const rowsElements = document.querySelectorAll('.sync-row');
        const mappings = this.getMappings();

        if (!rowsElements || rowsElements.length === 0) {
            this.showMessage('⚠️ No hay registros cargados para sincronizar.', 'warning');
            return;
        }

        if (!mappings || mappings.length === 0) {
            this.showMessage('⚠️ Debes tener mapeos activos para poder sincronizar.', 'warning');
            return;
        }

        // Obtener lista de cod_diploma seleccionados
        const selectedCodDiploma = [];
        rowsElements.forEach((rowEl) => {
            const checkbox = rowEl.querySelector('.sync-row-checkbox');
            if (checkbox && checkbox.checked) {
                const cod = rowEl.dataset.codDiploma;
                if (cod !== undefined && cod !== null && cod !== '') {
                    selectedCodDiploma.push(cod);
                }
            }
        });

        if (selectedCodDiploma.length === 0) {
            this.showMessage('⚠️ Debes seleccionar al menos un registro para sincronizar.', 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/hubdb/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mappings,
                    codDiplomaList: selectedCodDiploma,
                }),
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(
                    `✅ Sincronización completada. Actualizados: ${result.updatedCount || 0}, sin coincidencia: ${result.notFoundCount || 0}.`,
                    'success'
                );
            } else {
                this.showMessage(
                    `❌ Error en la sincronización: ${result.error || 'Error desconocido'}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Error al iniciar sincronización:', error);
            this.showMessage('❌ Error de conexión durante la sincronización con HubDB', 'error');
        }
    }

    /**
     * Actualiza la vista previa de datos en tiempo real
     */
    async updatePreview() {
        const previewCard = document.getElementById('preview-card');
        const previewContainer = document.getElementById('preview-container');
        const previewCount = document.getElementById('preview-count');
        
        const mappings = this.getMappings();
        
        // Si no hay mapeos activos, ocultar la tarjeta
        if (mappings.length === 0) {
            previewCard.style.display = 'none';
            return;
        }
        
        // Mostrar la tarjeta y estado de carga
        previewCard.style.display = 'block';
        previewContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando vista previa...</p>
            </div>
        `;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/db/preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mappings }),
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.renderPreview(result.data, result.count, mappings);
                previewCount.textContent = `${result.count} registros`;
            } else {
                previewContainer.innerHTML = `
                    <div class="preview-error">
                        <p>❌ Error: ${result.error || 'Error desconocido'}</p>
                    </div>
                `;
                previewCount.textContent = 'Error';
            }
        } catch (error) {
            console.error('Error al cargar vista previa:', error);
            previewContainer.innerHTML = `
                <div class="preview-error">
                    <p>❌ Error de conexión al cargar la vista previa</p>
                </div>
            `;
            previewCount.textContent = 'Error';
        }
    }

    /**
     * Renderiza la vista previa de datos
     */
    renderPreview(data, count, mappings) {
        const previewContainer = document.getElementById('preview-container');
        
        if (!data || data.length === 0) {
            previewContainer.innerHTML = `
                <div class="preview-empty">
                    <p>No se encontraron registros con los campos seleccionados</p>
                </div>
            `;
            return;
        }
        
        // Obtener los nombres de las columnas (campos de HubDB)
        const columns = mappings.map(m => m.hubdbField.label || m.hubdbField.name);
        
        // Construir la tabla
        let html = `
            <div class="preview-table-container">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Agregar filas de datos
        data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                const value = row[col];
                const displayValue = value === null || value === undefined 
                    ? '<em class="null-value">NULL</em>' 
                    : String(value).length > 50 
                        ? String(value).substring(0, 50) + '...' 
                        : String(value);
                html += `<td>${displayValue}</td>`;
            });
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        previewContainer.innerHTML = html;
    }
}

// Inicializar el dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new HubDBDashboard();
});

