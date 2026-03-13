/**
 * Dashboard de sincronización para la tabla HubDB de directores/académicos.
 * Usa HUBDB_DIRECTOR_ID para conectar con la tabla específica.
 */

class DirectorDashboard {
    constructor() {
        this.fields = [];
        this.dbFields = [];
        this.tableInfo = null;
        this.syncRows = [];
        this.apiBaseUrl = '/api';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadTableInfo();
        await this.loadFields();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('director-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadFields();
                this.loadTableInfo();
            });
        }

        const selectAllCheckbox = document.getElementById('director-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                document.querySelectorAll('#director-selectors-container .field-checkbox').forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    this.toggleRowState(checkbox);
                });
                this.updateSelectAllCheckbox();
            });
        }

        const syncShowBtn = document.getElementById('director-sync-show-btn');
        if (syncShowBtn) {
            syncShowBtn.addEventListener('click', () => this.prepareDirectorSyncTable());
        }

        const syncBackBtn = document.getElementById('director-sync-back-btn');
        if (syncBackBtn) {
            syncBackBtn.addEventListener('click', () => this.showMappingView());
        }

        const syncStartBtn = document.getElementById('director-sync-start-btn');
        if (syncStartBtn) {
            syncStartBtn.addEventListener('click', () => this.startDirectorSynchronization());
        }
    }

    getDirectorMappings() {
        const rows = document.querySelectorAll('#director-selectors-container .director-mapping-row');
        const mappings = [];
        rows.forEach((row) => {
            const checkbox = row.querySelector('.field-checkbox');
            const select = row.querySelector('.database-field-select');
            const fieldId = row.dataset.fieldId;
            if (checkbox && checkbox.checked && select && select.value) {
                const hubdbField = this.fields.find((f) => f.id === fieldId);
                const databaseFieldName = select.value;
                const databaseField = this.dbFields.find((f) => f.name === databaseFieldName);
                if (hubdbField && databaseField) {
                    mappings.push({
                        enabled: true,
                        hubdbField: { id: hubdbField.id, name: hubdbField.name, label: hubdbField.label || hubdbField.name },
                        databaseField: { name: databaseField.name },
                    });
                }
            }
        });
        return mappings;
    }

    hasCodDiplomaMapping(mappings) {
        return Array.isArray(mappings) && mappings.some(
            (m) => m.hubdbField && (m.hubdbField.name === 'cod_diploma' || m.hubdbField.name === 'COD_DIPLOMA')
        );
    }

    showDirectorSyncView() {
        const mappingSection = document.getElementById('director-mapping-section');
        const syncViewSection = document.getElementById('director-sync-view-section');
        if (mappingSection) mappingSection.style.display = 'none';
        if (syncViewSection) syncViewSection.style.display = '';
    }

    async prepareDirectorSyncTable() {
        const syncContainer = document.getElementById('director-sync-table-container');
        const syncCount = document.getElementById('director-sync-count');
        const syncStartBtn = document.getElementById('director-sync-start-btn');

        const mappings = this.getDirectorMappings();

        if (!mappings || mappings.length === 0) {
            this.showMessage('⚠️ Debes seleccionar al menos un campo mapeado antes de sincronizar.', 'warning');
            return;
        }
        if (!this.hasCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio: asigna la columna HubDB "cod_diploma" a tu campo de BD (p. ej. cod_diploma) para poder sincronizar.', 'warning');
            return;
        }

        this.showDirectorSyncView();

        syncContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando registros de directores desde la base de datos...</p>
            </div>
        `;
        syncCount.textContent = '';
        if (syncStartBtn) syncStartBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/db/director/sync-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mappings }),
            });

            const result = await response.json();

            if (result.success) {
                this.syncRows = result.data || [];
                this.renderDirectorSyncTable(this.syncRows, mappings);
                syncCount.textContent = `${result.count} registros`;

                if (syncStartBtn) syncStartBtn.disabled = this.syncRows.length === 0;

                if (this.syncRows.length === 0) {
                    this.showMessage('⚠️ No se encontraron registros de directores en la base de datos.', 'warning');
                } else {
                    this.showMessage(`✅ Se cargaron ${result.count} registros de directores para sincronización.`, 'success');
                }
            } else {
                syncContainer.innerHTML = `<div class="preview-error"><p>❌ Error: ${result.error || 'Error desconocido al cargar registros'}</p></div>`;
                syncCount.textContent = 'Error';
                this.showMessage(`❌ Error al cargar registros: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error al preparar tabla de sincronización de directores:', error);
            syncContainer.innerHTML = `<div class="preview-error"><p>❌ Error de conexión al cargar los registros</p></div>`;
            syncCount.textContent = 'Error';
            this.showMessage('❌ Error de conexión al cargar los registros de directores', 'error');
        }
    }

    renderDirectorSyncTable(rows, mappings) {
        const container = document.getElementById('director-sync-table-container');

        if (!rows || rows.length === 0) {
            container.innerHTML = '<div class="preview-empty"><p>No hay registros para mostrar.</p></div>';
            return;
        }

        const columns = mappings.map((m) => ({
            header: m.hubdbField.label || m.hubdbField.name,
            dbField: m.databaseField.name,
        }));

        let html = `
            <div class="preview-table-container">
                <table class="preview-table sync-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="director-sync-select-all" title="Seleccionar todos"></th>
                            ${columns.map((col) => `<th>${col.header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        rows.forEach((row, index) => {
            const codDiploma = row.cod_diploma ?? row.COD_DIPLOMA ?? row.codDiploma ?? '';
            html += `
                <tr class="sync-row director-sync-row" data-index="${index}" data-cod-diploma="${codDiploma}">
                    <td><input type="checkbox" class="sync-row-checkbox" checked></td>
            `;
            columns.forEach((col) => {
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

        html += '</tbody></table></div>';
        container.innerHTML = html;

        const selectAll = document.getElementById('director-sync-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                container.querySelectorAll('.sync-row-checkbox').forEach((cb) => {
                    cb.checked = e.target.checked;
                });
            });
        }

        const searchInput = document.getElementById('director-sync-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const q = (searchInput.value || '').toLowerCase().trim();
                container.querySelectorAll('.director-sync-row').forEach((row) => {
                    const text = (row.textContent || '').toLowerCase();
                    row.style.display = !q || text.includes(q) ? '' : 'none';
                });
            });
        }
    }

    async startDirectorSynchronization() {
        const rowsElements = document.querySelectorAll('#director-sync-table-container .director-sync-row');
        const mappings = this.getDirectorMappings();

        if (!rowsElements || rowsElements.length === 0) {
            this.showMessage('⚠️ No hay registros cargados para sincronizar.', 'warning');
            return;
        }
        if (!mappings || mappings.length === 0) {
            this.showMessage('⚠️ Debes tener mapeos activos para poder sincronizar.', 'warning');
            return;
        }
        if (!this.hasCodDiplomaMapping(mappings)) {
            this.showMessage('⚠️ El campo cod_diploma es obligatorio para sincronizar.', 'warning');
            return;
        }

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

        const syncStartBtn = document.getElementById('director-sync-start-btn');
        this.setSyncButtonLoading(syncStartBtn, true);

        try {
            const response = await fetch(`${this.apiBaseUrl}/hubdb/director/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                this.showMessage(`✅ Sincronización de directores completada. ${msg}`, 'success');
            } else {
                this.showMessage(`❌ Error en la sincronización: ${result.error || 'Error desconocido'}`, 'error');
            }
        } catch (error) {
            console.error('Error al sincronizar directores:', error);
            this.showMessage('❌ Error de conexión durante la sincronización con HubDB', 'error');
        } finally {
            this.setSyncButtonLoading(document.getElementById('director-sync-start-btn'), false);
        }
    }

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

    showMappingView() {
        const mappingSection = document.getElementById('director-mapping-section');
        const syncViewSection = document.getElementById('director-sync-view-section');
        if (mappingSection) mappingSection.style.display = '';
        if (syncViewSection) syncViewSection.style.display = 'none';
    }

    async loadTableInfo() {
        try {
            const res = await fetch(`${this.apiBaseUrl}/hubdb/director/table-info`);
            const result = await res.json();

            if (result.success && result.data) {
                this.tableInfo = result.data;
                this.renderTableInfo(result.data);
            } else {
                this.renderTableInfo({
                    error: result.error || 'Error al cargar información de la tabla de directores',
                });
            }
        } catch (error) {
            console.error('Error al cargar información de la tabla de directores:', error);
            this.renderTableInfo({
                error: 'Error de conexión al cargar la información de la tabla',
            });
        }
    }

    renderTableInfo(info) {
        const nameEl = document.getElementById('director-table-info-name');
        const labelEl = document.getElementById('director-table-info-label');
        const idEl = document.getElementById('director-table-info-id');
        const fieldsEl = document.getElementById('director-table-info-fields');

        if (info.error) {
            if (nameEl) nameEl.textContent = 'Error';
            if (labelEl) labelEl.textContent = info.error;
            if (idEl) idEl.textContent = '—';
            if (fieldsEl) fieldsEl.textContent = '—';
            this.showMessage(`❌ ${info.error}`, 'error');
            return;
        }

        if (nameEl) nameEl.textContent = info.name || '—';
        if (labelEl) labelEl.textContent = info.label || '—';
        if (idEl) idEl.textContent = info.id || '—';
        if (fieldsEl) fieldsEl.textContent = info.columnsCount || '0';
    }

    async loadFields() {
        const container = document.getElementById('director-selectors-container');
        if (!container) return;

        container.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Cargando campos...</p>
                    </div>
                </td>
            </tr>
        `;

        try {
            const [hubRes, dbRes] = await Promise.all([
                fetch(`${this.apiBaseUrl}/hubdb/director/fields`),
                fetch(`${this.apiBaseUrl}/db/director/fields`),
            ]);

            const hubResult = await hubRes.json();
            const dbResult = await dbRes.json();

            const hubFields = hubResult.success ? hubResult.data : [];
            const dbFields = dbResult.success ? dbResult.data : [];

            this.fields = hubFields;
            this.dbFields = dbFields;

            this.renderSelectors(hubFields, dbFields);

            if (hubFields.length === 0) {
                this.showMessage('⚠️ No se encontraron campos en la tabla de directores. Verifica HUBDB_DIRECTOR_ID en tu .env', 'warning');
            }
        } catch (error) {
            console.error('Error al cargar campos:', error);
            container.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="preview-error">
                            <p>❌ Error al cargar campos</p>
                        </div>
                    </td>
                </tr>
            `;
            this.showMessage('❌ Error al cargar campos de HubDB o BD', 'error');
        }
    }

    renderSelectors(hubFields, dbFields) {
        const container = document.getElementById('director-selectors-container');
        if (!container) return;

        if (!hubFields || hubFields.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <p>No hay campos disponibles en la tabla de directores.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const hasDb = dbFields && dbFields.length > 0;
        const optNone = '<option value="">-- No asignar --</option>';

        container.innerHTML = hubFields.map((field, index) => {
            const suggestedDbFieldName = this.findDefaultDbFieldForDirector(field);
            const hasSuggestion =
                hasDb &&
                suggestedDbFieldName &&
                dbFields.some((col) => col.name && col.name.toLowerCase() === suggestedDbFieldName.toLowerCase());

            const checkboxAttr = hasSuggestion ? ' checked' : '';
            const rowDisabledClass = hasSuggestion ? '' : ' mapping-row-disabled';
            const selectDisabledAttr = hasDb && !hasSuggestion ? ' disabled' : hasDb ? '' : ' disabled';

            const dbOptions = hasDb
                ? dbFields
                      .map((col) => {
                          const selected =
                              hasSuggestion &&
                              suggestedDbFieldName &&
                              col.name.toLowerCase() === suggestedDbFieldName.toLowerCase()
                                  ? ' selected'
                                  : '';
                          return `<option value="${col.name}"${selected}>${col.name} (${col.type})</option>`;
                      })
                      .join('')
                : '';

            const typeClass = this.getTypeBadgeClass(field.type);
            const typeLabel = this.getTypeLabel(field.type);
            const searchText = `${field.name || ''} ${field.label || ''}`.toLowerCase();

            return `
                <tr class="mapping-row director-mapping-row ${hasSuggestion ? 'has-assignment' : ''}${rowDisabledClass}" data-field-id="${field.id}" data-search="${searchText.replace(/"/g, '&quot;')}">
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
                            <select class="database-field-select" data-field-id="${field.id}" data-field-index="${index}" aria-label="Campo de BD para ${field.label || field.name}"${selectDisabledAttr}>
                                ${optNone}${dbOptions}
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

    findDefaultDbFieldForDirector(hubdbField) {
        const name = (hubdbField?.name || '').toLowerCase();

        const directMap = {
            'cod_diploma': 'cod_diploma',
            'nombre_academico': 'nombre_academico',
            'resumen_cv': 'resumen_cv',
            'foto': 'foto',
            'estudios': 'estudios',
            'cargo': 'cargo',
            'palabras_del_director': 'palabras_del_director',
        };

        if (directMap[name]) {
            return directMap[name];
        }

        const sameName = this.dbFields?.find((f) => f.name && f.name.toLowerCase() === name);
        if (sameName) {
            return sameName.name;
        }

        return null;
    }

    getTypeBadgeClass(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('number') || t.includes('numeric')) return 'type-number';
        if (t.includes('date') || t.includes('datetime')) return 'type-date';
        if (t.includes('url')) return 'type-url';
        return 'type-text';
    }

    getTypeLabel(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('number') || t.includes('numeric')) return 'Número';
        if (t.includes('date') || t.includes('datetime')) return 'Fecha';
        if (t.includes('url')) return 'URL';
        if (t.includes('select')) return 'Opción';
        if (t.includes('multiselect')) return 'Multi-opción';
        return 'Texto';
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('director-select-all');
        if (!selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('#director-selectors-container .field-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }

        const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;

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

    attachSelectorListeners() {
        const checkboxes = document.querySelectorAll('#director-selectors-container .field-checkbox');
        checkboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => {
                this.toggleRowState(e.target);
            });
        });

        document.querySelectorAll('#director-selectors-container .database-field-select').forEach((selector) => {
            selector.addEventListener('change', (e) => {
                const selectedFieldName = (e.target.value || '').trim();
                const row = e.target.closest('.mapping-row');
                const checkbox = row ? row.querySelector('.field-checkbox') : null;

                if (!selectedFieldName && checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    this.toggleRowState(checkbox);
                } else if (selectedFieldName && checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    this.toggleRowState(checkbox);
                }
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
        const rows = document.querySelectorAll('#director-selectors-container .director-mapping-row');
        const total = rows.length;
        const assigned = Array.from(rows).filter((r) => {
            const sel = r.querySelector('.database-field-select');
            return sel && sel.value && sel.value.trim() !== '';
        }).length;
        const statusEl = document.getElementById('director-mapping-status');
        if (statusEl) statusEl.textContent = `${assigned} de ${total} campos asignados`;

        const mappings = this.getDirectorMappings();
        const syncShowBtn = document.getElementById('director-sync-show-btn');
        if (syncShowBtn) {
            syncShowBtn.disabled = !(mappings.length > 0 && this.hasCodDiplomaMapping(mappings));
        }
    }

    setupSearchListeners() {
        const searchInput = document.getElementById('director-search-fields');
        const container = document.getElementById('director-selectors-container');
        if (!searchInput || !container) return;
        searchInput.addEventListener('input', () => {
            const q = (searchInput.value || '').toLowerCase().trim();
            container.querySelectorAll('.director-mapping-row').forEach((row) => {
                const text = (row.getAttribute('data-search') || '').toLowerCase();
                row.style.display = !q || text.includes(q) ? '' : 'none';
            });
        });
    }

    toggleRowState(checkbox) {
        const row = checkbox.closest('.mapping-row');
        const select = row.querySelector('.database-field-select');

        if (checkbox.checked) {
            row.classList.remove('mapping-row-disabled');
            if (select) select.disabled = false;
        } else {
            row.classList.add('mapping-row-disabled');
            if (select) select.disabled = true;
        }

        this.updateSelectAllCheckbox();
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container');

        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;

        container.appendChild(message);

        setTimeout(() => {
            message.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 300);
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DirectorDashboard();
});
