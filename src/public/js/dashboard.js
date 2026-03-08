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
        this.reverseViewInitialized = false;
        this.reverseHubdbRows = [];
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

        const switchView = (view) => {
            tabButtons.forEach((b) => b.classList.remove('tab-active'));
            const tabBtn = document.querySelector(`.tab-button[data-view="${view}"]`);
            if (tabBtn) tabBtn.classList.add('tab-active');
            document.querySelectorAll('.control-card').forEach((card) => {
                card.setAttribute('aria-pressed', card.dataset.view === view ? 'true' : 'false');
            });
            if (mappingView && reverseView) {
                if (view === 'mapping') {
                    mappingView.classList.remove('dashboard-content-hidden');
                    reverseView.classList.add('dashboard-content-hidden');
                } else {
                    reverseView.classList.remove('dashboard-content-hidden');
                    mappingView.classList.add('dashboard-content-hidden');
                    this.initReverseView();
                }
            }
        };

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        document.querySelectorAll('.control-card').forEach((card) => {
            card.addEventListener('click', () => switchView(card.dataset.view));
        });

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadFields();
                this.loadTableInfo();
            });
        }

        // Checkbox "Seleccionar todos" (solo vista BD→HubDB)
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                document.querySelectorAll('#selectors-container .field-checkbox').forEach(checkbox => {
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

        // Botón Retroceder: volver a la vista de mapeo
        const syncBackBtn = document.getElementById('sync-back-btn');
        if (syncBackBtn) {
            syncBackBtn.addEventListener('click', () => {
                this.showMappingView();
            });
        }

        // --- Vista HubDB → BD ---
        const reverseRefreshBtn = document.getElementById('reverse-refresh-btn');
        if (reverseRefreshBtn) {
            reverseRefreshBtn.addEventListener('click', () => this.initReverseView(true));
        }
        const reverseSelectAll = document.getElementById('reverse-select-all');
        if (reverseSelectAll) {
            reverseSelectAll.addEventListener('change', (e) => {
                document.querySelectorAll('#reverse-selectors-container .field-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                    this.toggleReverseRowState(cb);
                });
                this.updateReverseSelectAllCheckbox();
            });
        }
        const reverseSyncShowBtn = document.getElementById('reverse-sync-show-btn');
        if (reverseSyncShowBtn) {
            reverseSyncShowBtn.addEventListener('click', () => this.prepareReverseSyncTable());
        }
        const reverseSyncBackBtn = document.getElementById('reverse-sync-back-btn');
        if (reverseSyncBackBtn) {
            reverseSyncBackBtn.addEventListener('click', () => this.showReverseMappingView());
        }
        const reverseSyncStartBtn = document.getElementById('reverse-sync-start-btn');
        if (reverseSyncStartBtn) {
            reverseSyncStartBtn.addEventListener('click', () => this.startReverseSynchronization());
        }
    }

    /**
     * Muestra la vista de mapeo (tabla de campos) y oculta la vista de sincronización
     */
    showMappingView() {
        const mappingSection = document.getElementById('mapping-section');
        const syncViewSection = document.getElementById('sync-view-section');
        if (mappingSection) mappingSection.style.display = '';
        if (syncViewSection) syncViewSection.style.display = 'none';
    }

    /**
     * Muestra la vista de sincronización (registros) y oculta la tabla de mapeo
     */
    showSyncView() {
        const mappingSection = document.getElementById('mapping-section');
        const syncViewSection = document.getElementById('sync-view-section');
        if (mappingSection) mappingSection.style.display = 'none';
        if (syncViewSection) syncViewSection.style.display = 'block';
    }

    // ---------- Vista HubDB → BD ----------

    async initReverseView(forceReload = false) {
        if (this.reverseViewInitialized && !forceReload) return;
        const container = document.getElementById('reverse-selectors-container');
        if (!container) return;
        container.innerHTML = `
            <tr><td colspan="3">
                <div class="loading-state"><div class="spinner"></div><p>Cargando vista HubDB → BD...</p></div>
            </td></tr>
        `;
        try {
            await this.loadReverseTableInfo();
            await this.loadReverseFields();
            this.reverseViewInitialized = true;
        } catch (e) {
            console.error('Error init reverse view:', e);
            container.innerHTML = `<tr><td colspan="3"><div class="preview-error">Error al cargar. Revisa la consola.</div></td></tr>`;
        }
    }

    async loadReverseTableInfo() {
        const el = document.getElementById('reverse-table-info');
        if (!el) return;
        try {
            const res = await fetch(`${this.apiBaseUrl}/hubdb/table-info`);
            const result = await res.json();
            if (result.success && result.data) {
                const info = result.data;
                el.innerHTML = `
                    <div class="table-info-item"><span class="table-info-label">Nombre:</span><span class="table-info-value">${info.name || 'N/A'}</span></div>
                    <div class="table-info-item"><span class="table-info-label">Etiqueta:</span><span class="table-info-value">${info.label || 'N/A'}</span></div>
                    <div class="table-info-item"><span class="table-info-label">ID:</span><span class="table-info-value">${info.id || 'N/A'}</span></div>
                    <div class="table-info-item"><span class="table-info-label">Campos:</span><span class="table-info-value">${info.columnsCount || 0}</span></div>
                `;
            } else {
                el.innerHTML = `<p class="error">${result.error || 'Error'}</p>`;
            }
        } catch (e) {
            el.innerHTML = `<p class="error">Error de conexión</p>`;
        }
    }

    async loadReverseFields() {
        const container = document.getElementById('reverse-selectors-container');
        try {
            const [hubRes, dbRes] = await Promise.all([
                fetch(`${this.apiBaseUrl}/hubdb/fields`),
                fetch(`${this.apiBaseUrl}/db/fields`),
            ]);
            const hubResult = await hubRes.json();
            const dbResult = await dbRes.json();
            const hubFields = hubResult.success ? hubResult.data : [];
            const dbFields = dbResult.success ? dbResult.data : [];
            this.fields = hubFields;
            this.dbFields = dbFields;
            this.renderReverseSelectors(hubFields, dbFields);
        } catch (e) {
            if (container) {
                container.innerHTML = `<tr><td colspan="3"><div class="preview-error">Error al cargar campos.</div></td></tr>`;
            }
        }
    }

    renderReverseSelectors(hubFields, dbFields) {
        const container = document.getElementById('reverse-selectors-container');
        if (!container) return;
        if (!hubFields || hubFields.length === 0) {
            container.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>No hay campos en HubDB.</p></div></td></tr>`;
            return;
        }
        const hasDb = dbFields && dbFields.length > 0;
        const optNone = '<option value="">-- No asignar --</option>';
        container.innerHTML = hubFields.map((field, idx) => {
            const suggestedDbFieldName = this.findDefaultDbFieldForHubdb(field);
            const hasSuggestion =
                hasDb &&
                suggestedDbFieldName &&
                dbFields.some(
                    (col) =>
                        col.name &&
                        col.name.toLowerCase() === suggestedDbFieldName.toLowerCase()
                );
            const checkboxAttr = hasSuggestion ? ' checked' : '';
            const rowDisabledClass = hasSuggestion ? '' : ' mapping-row-disabled';
            const selectDisabledAttr = hasDb && !hasSuggestion ? ' disabled' : hasDb ? '' : ' disabled';
            const dbOptions = hasDb
                ? dbFields
                      .map((col) => {
                          const selected =
                              hasSuggestion &&
                              suggestedDbFieldName &&
                              col.name.toLowerCase() ===
                                  suggestedDbFieldName.toLowerCase()
                                  ? ' selected'
                                  : '';
                          return `<option value="${col.name}"${selected}>${col.name} (${col.type}${col.isPrimaryKey ? ' - PK' : ''})</option>`;
                      })
                      .join('')
                : '';
            const typeClass = this.getTypeBadgeClass(field.type);
            const typeLabel = this.getTypeLabel(field.type);
            const searchText = `${field.name || ''} ${field.label || ''}`.toLowerCase();
            return `
            <tr class="mapping-row reverse-mapping-row ${hasSuggestion ? 'has-assignment' : ''}${rowDisabledClass}" data-field-id="${field.id}" data-search="${searchText.replace(/"/g, '&quot;')}">
                <td class="col-checkbox">
                    <input type="checkbox" class="field-checkbox" data-field-id="${field.id}"${checkboxAttr}>
                </td>
                <td class="col-hubdb">
                    <div class="hubdb-field">
                        <span class="hubdb-field-name">${field.label || field.name}</span>
                    </div>
                </td>
                <td class="col-tipo">
                    <span class="type-badge ${typeClass}">${typeLabel}</span>
                </td>
                <td class="col-database">
                    <div class="database-field-cell">
                        <select class="database-field-select" data-field-id="${field.id}" data-field-index="${idx}"${selectDisabledAttr}>
                            ${optNone}${dbOptions}
                        </select>
                        <span class="assign-check" aria-hidden="true">✓</span>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
        this.attachReverseSelectorListeners();
        this.updateReverseSelectAllCheckbox();
        this.updateReverseMappingStatus();
        this.setupReverseSearchListeners();
    }

    getReverseMappings() {
        const rows = document.querySelectorAll('#reverse-selectors-container .reverse-mapping-row');
        const mappings = [];
        rows.forEach(row => {
            const checkbox = row.querySelector('.field-checkbox');
            const select = row.querySelector('.database-field-select');
            const fieldId = row.dataset.fieldId;
            if (checkbox && checkbox.checked && select && select.value) {
                const hubdbField = this.fields.find(f => String(f.id) === String(fieldId));
                const databaseField = this.dbFields.find(f => f.name === select.value);
                if (hubdbField && databaseField) {
                    mappings.push({ enabled: true, hubdbField, databaseField });
                }
            }
        });
        return mappings;
    }

    toggleReverseRowState(checkbox) {
        const row = checkbox.closest('.mapping-row');
        const select = row.querySelector('.database-field-select');
        if (checkbox.checked) {
            row.classList.remove('mapping-row-disabled');
            if (select) select.disabled = false;
        } else {
            row.classList.add('mapping-row-disabled');
            if (select) select.disabled = true;
        }
        this.updateReverseSelectAllCheckbox();
    }

    updateReverseSelectAllCheckbox() {
        const selectAll = document.getElementById('reverse-select-all');
        if (!selectAll) return;
        const checkboxes = document.querySelectorAll('#reverse-selectors-container .field-checkbox');
        if (checkboxes.length === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            return;
        }
        const n = Array.from(checkboxes).filter(cb => cb.checked).length;
        selectAll.checked = n === checkboxes.length;
        selectAll.indeterminate = n > 0 && n < checkboxes.length;
    }

    attachReverseSelectorListeners() {
        document.querySelectorAll('#reverse-selectors-container .field-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.toggleReverseRowState(cb));
        });
        document.querySelectorAll('#reverse-selectors-container .database-field-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const selectedValue = (sel.value || '').trim();
                const row = sel.closest('.mapping-row');
                const checkbox = row ? row.querySelector('.field-checkbox') : null;
                // Si el usuario elige "No asignar", desmarcar el checkbox
                if (!selectedValue && checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    this.toggleReverseRowState(checkbox);
                } else if (selectedValue && checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    this.toggleReverseRowState(checkbox);
                }
                this.updateReverseSelectAllCheckbox();
                this.updateRowAssignmentState(row);
                this.updateReverseMappingStatus();
            });
        });
    }

    updateReverseMappingStatus() {
        const rows = document.querySelectorAll('#reverse-selectors-container .reverse-mapping-row');
        const total = rows.length;
        const assigned = Array.from(rows).filter((r) => {
            const sel = r.querySelector('.database-field-select');
            return sel && sel.value && sel.value.trim() !== '';
        }).length;
        const statusEl = document.getElementById('reverse-mapping-status');
        if (statusEl) statusEl.textContent = `${assigned} de ${total} campos asignados`;
    }

    setupReverseSearchListeners() {
        const searchInput = document.getElementById('reverse-search-fields');
        const container = document.getElementById('reverse-selectors-container');
        if (!searchInput || !container) return;
        searchInput.addEventListener('input', () => {
            const q = (searchInput.value || '').toLowerCase().trim();
            container.querySelectorAll('.reverse-mapping-row').forEach((row) => {
                const text = (row.getAttribute('data-search') || '').toLowerCase();
                row.style.display = !q || text.includes(q) ? '' : 'none';
            });
        });
    }

    async prepareReverseSyncTable() {
        const mappings = this.getReverseMappings();
        if (!mappings || mappings.length === 0) {
            this.showMessage('⚠️ Selecciona al menos una columna HubDB y asígnala a un campo de BD.', 'warning');
            return;
        }
        if (!this.hasReverseCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio: asigna la columna HubDB "cod_diploma" al campo de BD (p. ej. cod_diploma) para identificar los registros.', 'warning');
            return;
        }
        this.showReverseSyncView();
        const syncContainer = document.getElementById('reverse-sync-table-container');
        const syncCount = document.getElementById('reverse-sync-count');
        const syncStartBtn = document.getElementById('reverse-sync-start-btn');
        syncContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando filas desde HubDB...</p></div>';
        syncCount.textContent = '';
        if (syncStartBtn) syncStartBtn.disabled = true;
        try {
            const res = await fetch(`${this.apiBaseUrl}/hubdb/rows`);
            const result = await res.json();
            if (result.success && result.data) {
                this.reverseHubdbRows = result.data;
                this.renderReverseSyncTable(this.reverseHubdbRows, mappings);
                syncCount.textContent = `${result.count} registros`;
                if (syncStartBtn) syncStartBtn.disabled = result.data.length === 0;
                this.showMessage(`✅ ${result.count} filas cargadas desde HubDB.`, 'success');
            } else {
                syncContainer.innerHTML = `<div class="preview-error">${result.error || 'Error'}</div>`;
                this.showMessage(`❌ ${result.error || 'Error al cargar HubDB'}`, 'error');
            }
        } catch (e) {
            syncContainer.innerHTML = '<div class="preview-error">Error de conexión.</div>';
            this.showMessage('❌ Error de conexión al cargar HubDB', 'error');
        }
    }

    showReverseSyncView() {
        const mappingSection = document.getElementById('reverse-mapping-section');
        const syncViewSection = document.getElementById('reverse-sync-view-section');
        if (mappingSection) mappingSection.style.display = 'none';
        if (syncViewSection) syncViewSection.style.display = 'block';
    }

    showReverseMappingView() {
        const mappingSection = document.getElementById('reverse-mapping-section');
        const syncViewSection = document.getElementById('reverse-sync-view-section');
        if (mappingSection) mappingSection.style.display = '';
        if (syncViewSection) syncViewSection.style.display = 'none';
    }

    renderReverseSyncTable(rows, mappings) {
        const container = document.getElementById('reverse-sync-table-container');
        if (!rows || rows.length === 0) {
            container.innerHTML = '<div class="preview-empty"><p>No hay registros en HubDB.</p></div>';
            return;
        }
        const columns = mappings.map(m => ({ header: m.hubdbField.label || m.hubdbField.name, hubdbName: m.hubdbField.name }));
        let html = `
            <div class="preview-table-container">
                <table class="preview-table sync-table">
                    <thead><tr>
                        <th><input type="checkbox" id="reverse-sync-select-all" title="Seleccionar todos"></th>
                        ${columns.map(c => `<th>${c.header}</th>`).join('')}
                    </tr></thead>
                    <tbody>
        `;
        rows.forEach((row, index) => {
            const codDiploma = row.cod_diploma ?? row.COD_DIPLOMA ?? row.codDiploma ?? '';
            html += `<tr class="sync-row reverse-sync-row" data-index="${index}" data-cod-diploma="${codDiploma}"><td><input type="checkbox" class="sync-row-checkbox reverse-sync-row-checkbox" checked></td>`;
            columns.forEach(col => {
                const v = row[col.hubdbName];
                const display = v == null ? '<em class="null-value">NULL</em>' : String(v).length > 80 ? String(v).slice(0, 80) + '...' : String(v);
                html += `<td>${display}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        const selectAll = document.getElementById('reverse-sync-select-all');
        const checkboxes = container.querySelectorAll('.reverse-sync-row-checkbox');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => checkboxes.forEach(cb => { cb.checked = e.target.checked; }));
        }
    }

    async startReverseSynchronization() {
        const rows = document.querySelectorAll('.reverse-sync-row');
        const mappings = this.getReverseMappings();
        if (!rows.length) {
            this.showMessage('⚠️ No hay registros cargados.', 'warning');
            return;
        }
        if (!mappings.length) {
            this.showMessage('⚠️ No hay mapeos activos.', 'warning');
            return;
        }
        if (!this.hasReverseCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio: la columna HubDB "cod_diploma" debe estar mapeada.', 'warning');
            return;
        }
        const selectedCodDiploma = [];
        rows.forEach(row => {
            const cb = row.querySelector('.reverse-sync-row-checkbox');
            if (cb && cb.checked) {
                const cod = row.dataset.codDiploma;
                if (cod != null && cod !== '') selectedCodDiploma.push(cod);
            }
        });
        if (selectedCodDiploma.length === 0) {
            this.showMessage('⚠️ Selecciona al menos un registro.', 'warning');
            return;
        }
        const reverseSyncStartBtn = document.getElementById('reverse-sync-start-btn');
        this.setSyncButtonLoading(reverseSyncStartBtn, true);
        try {
            const res = await fetch(`${this.apiBaseUrl}/db/sync-from-hubdb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mappings,
                    codDiplomaList: selectedCodDiploma,
                }),
            });
            const result = await res.json();
            if (result.success) {
                this.showMessage(`✅ Sincronización a BD completada. Actualizados: ${result.updatedCount || 0}.`, 'success');
            } else {
                this.showMessage(`❌ ${result.error || 'Error'}`, 'error');
            }
        } catch (e) {
            this.showMessage('❌ Error de conexión al sincronizar a BD', 'error');
        } finally {
            this.setSyncButtonLoading(document.getElementById('reverse-sync-start-btn'), false);
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
                this.renderTableInfo({ name: result.error || 'Error', label: '—', id: '—', columnsCount: '—' });
            }
        } catch (error) {
            console.error('Error al cargar información de la tabla:', error);
            this.renderTableInfo({ name: 'Error al conectar con el servidor', label: '—', id: '—', columnsCount: '—' });
        }
    }

    /**
     * Renderiza la información de la tabla
     */
    renderTableInfo(info) {
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value ?? '—';
        };
        set('table-info-name', info.name);
        set('table-info-label', info.label);
        set('table-info-id', info.id);
        set('table-info-fields', info.columnsCount);
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
     * Clase CSS para badge de tipo HubDB (NUMBER, TEXT, DATE, URL)
     */
    getTypeBadgeClass(type) {
        const t = (type || '').toLowerCase();
        if (t === 'number' || t === 'numeric') return 'type-number';
        if (t === 'date' || t === 'datetime') return 'type-date';
        if (t === 'url') return 'type-url';
        return 'type-text';
    }

    getTypeLabel(type) {
        const t = (type || 'string').toLowerCase();
        if (t === 'number' || t === 'numeric') return 'NUMBER';
        if (t === 'date' || t === 'datetime') return 'DATE';
        if (t === 'url') return 'URL';
        return 'TEXT';
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
                    <td colspan="4">
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

        const hasDbFields = this.dbFields && this.dbFields.length > 0;

        container.innerHTML = fields.map((field, index) => {
            const suggestedDbFieldName = this.findDefaultDbFieldForHubdb(field);
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
            const hasAssignment = hasDbFields && suggestedDbFieldName && this.dbFields.some(
                (c) => c.name && c.name.toLowerCase() === suggestedDbFieldName.toLowerCase()
            );
            const searchText = `${field.name || ''} ${field.label || ''}`.toLowerCase();
            const typeClass = this.getTypeBadgeClass(field.type);
            const typeLabel = this.getTypeLabel(field.type);
            const checkboxChecked = hasAssignment ? ' checked' : '';
            const rowDisabled = hasAssignment ? '' : ' mapping-row-disabled';
            const selectDisabled = hasDbFields && !hasAssignment ? ' disabled' : hasDbFields ? '' : ' disabled';

            return `
                <tr class="mapping-row ${hasAssignment ? 'has-assignment' : ''}${rowDisabled}" data-field-id="${field.id}" data-search="${searchText.replace(/"/g, '&quot;')}">
                    <td class="col-checkbox">
                        <input type="checkbox" class="field-checkbox" data-field-id="${field.id}"${checkboxChecked}>
                    </td>
                    <td class="col-hubdb">
                        <div class="hubdb-field">
                            <span class="hubdb-field-name">${field.label || field.name}</span>
                            ${field.required ? '<div class="hubdb-field-meta"><span class="hubdb-field-required">Requerido</span></div>' : ''}
                        </div>
                    </td>
                    <td class="col-tipo">
                        <span class="type-badge ${typeClass}">${typeLabel}</span>
                    </td>
                    <td class="col-database">
                        <div class="database-field-cell">
                            <select class="database-field-select" data-field-id="${field.id}" data-field-index="${index}" aria-label="Campo de BD para ${field.label || field.name}"${selectDisabled}>
                                ${optionsWithNone}
                            </select>
                            <span class="assign-check" aria-hidden="true">✓</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.attachSelectorListeners();
        this.updateSelectAllCheckbox();
        this.updateMappingStatus();
        this.setupSearchListeners();
    }

    /**
     * Actualiza el estado del checkbox "Seleccionar todos"
     */
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all');
        if (!selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('#selectors-container .field-checkbox');
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

        // Event listeners para selectores de base de datos (solo vista BD→HubDB)
        document.querySelectorAll('#selectors-container .database-field-select').forEach(selector => {
            selector.addEventListener('change', (e) => {
                const selectedFieldName = (e.target.value || '').trim();
                const row = e.target.closest('.mapping-row');
                const checkbox = row ? row.querySelector('.field-checkbox') : null;
                // Si el usuario elige "No asignar", desmarcar el checkbox (no tiene sentido enviar ese mapeo)
                if (!selectedFieldName && checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    this.toggleRowState(checkbox);
                } else if (selectedFieldName && checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    this.toggleRowState(checkbox);
                }
                this.updatePreview();
                this.updateRowAssignmentState(row);
                this.updateMappingStatus();
            });
        });
    }

    updateRowAssignmentState(row) {
        if (!row) return;
        const select = row.querySelector('.database-field-select');
        if (select && select.value) row.classList.add('has-assignment');
        else row.classList.remove('has-assignment');
    }

    updateMappingStatus() {
        const rows = document.querySelectorAll('#selectors-container .mapping-row');
        const total = rows.length;
        const assigned = Array.from(rows).filter((r) => {
            const sel = r.querySelector('.database-field-select');
            return sel && sel.value && sel.value.trim() !== '';
        }).length;
        const statusEl = document.getElementById('mapping-status');
        if (statusEl) statusEl.textContent = `${assigned} de ${total} campos asignados`;
    }

    setupSearchListeners() {
        const searchInput = document.getElementById('search-fields');
        const container = document.getElementById('selectors-container');
        if (!searchInput || !container) return;
        searchInput.addEventListener('input', () => {
            const q = (searchInput.value || '').toLowerCase().trim();
            container.querySelectorAll('.mapping-row').forEach((row) => {
                const text = (row.getAttribute('data-search') || '').toLowerCase();
                row.style.display = !q || text.includes(q) ? '' : 'none';
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
     * Comprueba si los mapeos incluyen cod_diploma (obligatorio para sincronizar).
     * BD → HubDB: debe existir un mapeo hacia la columna HubDB "cod_diploma".
     */
    hasCodDiplomaMapping(mappings) {
        return Array.isArray(mappings) && mappings.some(
            (m) => m.hubdbField && (m.hubdbField.name === 'cod_diploma' || m.hubdbField.name === 'COD_DIPLOMA')
        );
    }

    /**
     * Comprueba si los mapeos inversos incluyen cod_diploma (obligatorio para identificar filas).
     * HubDB → BD: debe existir un mapeo desde la columna HubDB "cod_diploma".
     */
    hasReverseCodDiplomaMapping(mappings) {
        return this.hasCodDiplomaMapping(mappings);
    }

    /**
     * Obtiene el estado actual de los mapeos
     * Útil para guardar el mapeo antes de importar
     */
    getMappings() {
        const rows = document.querySelectorAll('#selectors-container .mapping-row');
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
        if (!this.hasCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio: asigna la columna HubDB "cod_diploma" a tu campo de BD (p. ej. cod_diploma) para poder sincronizar.', 'warning');
            return;
        }

        // Ocultar tabla de mapeo y mostrar vista de sincronización
        this.showSyncView();

        // Mostrar tarjeta y estado de carga
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
        if (!this.hasCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio: la columna HubDB "cod_diploma" debe estar mapeada para poder sincronizar.', 'warning');
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

        const syncStartBtn = document.getElementById('sync-start-btn');
        this.setSyncButtonLoading(syncStartBtn, true);

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
                const updated = result.updatedCount || 0;
                const created = result.createdCount || 0;
                const notFound = result.notFoundCount || 0;
                const published = result.published === true;
                const parts = [];
                if (updated) parts.push(`actualizados: ${updated}`);
                if (created) parts.push(`creados: ${created}`);
                if (notFound) parts.push(`sin coincidencia en BD: ${notFound}`);
                let msg = parts.length ? parts.join(', ') + '.' : 'Sin cambios.';
                if (published) msg += ' Tabla publicada (draft → live).';
                else if (updated || created) msg += ' Tabla no se pudo publicar; revisa en HubSpot.';
                this.showMessage(`✅ Sincronización completada. ${msg}`, 'success');
            } else {
                this.showMessage(
                    `❌ Error en la sincronización: ${result.error || 'Error desconocido'}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Error al iniciar sincronización:', error);
            this.showMessage('❌ Error de conexión durante la sincronización con HubDB', 'error');
        } finally {
            this.setSyncButtonLoading(document.getElementById('sync-start-btn'), false);
        }
    }

    /**
     * Muestra u oculta estado de carga en el botón de iniciar sincronización (evita doble clic).
     * @param {HTMLElement|null} btn - Botón a actualizar
     * @param {boolean} loading - true = deshabilitar y mostrar loader; false = habilitar y restaurar texto
     */
    setSyncButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.classList.add('btn-loading');
            btn.innerHTML = '<span class="btn-spinner"></span> Sincronizando...';
        } else {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            btn.innerHTML = btn.dataset.originalText || 'Iniciar sincronización';
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

