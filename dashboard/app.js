// Agent Board - Dashboard App
(function () {
  const API = "/api";

  // --- Default Columns ---
  const DEFAULT_COLUMNS = [
    { id: "icebox", label: "Icebox", color: "#64748b" },
    { id: "backlog", label: "Backlog", color: "#94a3b8" },
    { id: "todo", label: "To Do", color: "#6366f1" },
    { id: "doing", label: "Doing", color: "#f59e0b" },
    { id: "review", label: "Review", color: "#a855f7" },
    { id: "done", label: "Done", color: "#22c55e" },
    { id: "failed", label: "Failed", color: "#ef4444" },
  ];

  const COLOR_PRESETS = [
    "#64748b", "#94a3b8", "#6366f1", "#f59e0b", "#a855f7",
    "#22c55e", "#ef4444", "#ec4899", "#14b8a6", "#f97316",
    "#06b6d4", "#8b5cf6",
  ];

  // --- i18n ---
  const I18N = {
    en: {
      board: "Board", agents: "Agents", stats: "Stats",
      noProjects: "No projects", allAgents: "All Agents",
      searchTasks: "Search tasks...",
      newProject: "+ Project", newTask: "+ Task", addTask: "+ Add task",
      clearDone: "Clear all done",
      newProjectTitle: "New Project", name: "Name", owner: "Owner",
      description: "Description", cancel: "Cancel", create: "Create",
      newTaskTitle: "New Task", title: "Title", assignee: "Assignee",
      priority: "Priority", tags: "Tags", tagsHint: "comma-separated",
      status: "Status", createdBy: "Created by", created: "Created",
      thread: "Thread", noComments: "No comments yet. Start the conversation!",
      author: "Author", typeMessage: "Type a message...", send: "Send",
      unassigned: "Unassigned", noDescription: "No description", none: "None",
      loadingStats: "Loading stats...", totalTasks: "Total Tasks",
      completionRate: "Completion Rate", avgDuration: "Avg Duration",
      failed: "Failed", statusBreakdown: "Status Breakdown",
      agentPerformance: "Agent Performance", agent: "Agent", total: "Total",
      done: "Done", active: "Active", avgTime: "Avg Time", rate: "Rate",
      noAgentData: "No agent data yet",
      stuckTask: "Stuck task", inProgressFor: "in progress for",
      noAgents: "No agents registered. Use the API to register agents.",
      deleteTaskConfirm: 'Delete "{title}"?',
      clearDoneConfirm: "Delete {count} completed tasks?",
      deleteCommentConfirm: "Delete comment?",
      addColumn: "Add column", newColumn: "New Column",
      columnName: "Column name", color: "Color",
      deleteColumn: "Delete column",
      deleteColumnConfirm: 'Delete column "{label}"?',
      moveTasksTo: "Move {count} task(s) to:",
      low: "low", medium: "medium", high: "high", urgent: "urgent",
      comments: "comment", commentsPlural: "comments",
      deps: "dep", depsPlural: "deps",
      blockedBy: "Blocked by",
    },
    ca: {
      board: "Tauler", agents: "Agents", stats: "Estadistiques",
      noProjects: "Sense projectes", allAgents: "Tots els agents",
      searchTasks: "Cercar tasques...",
      newProject: "+ Projecte", newTask: "+ Tasca", addTask: "+ Afegir tasca",
      clearDone: "Netejar completades",
      newProjectTitle: "Nou projecte", name: "Nom", owner: "Propietari",
      description: "Descripcio", cancel: "Cancel\u00b7lar", create: "Crear",
      newTaskTitle: "Nova tasca", title: "Titol", assignee: "Assignat",
      priority: "Prioritat", tags: "Etiquetes", tagsHint: "separades per comes",
      status: "Estat", createdBy: "Creat per", created: "Creat",
      thread: "Fil", noComments: "Sense comentaris encara. Inicia la conversa!",
      author: "Autor", typeMessage: "Escriu un missatge...", send: "Enviar",
      unassigned: "Sense assignar", noDescription: "Sense descripcio", none: "Cap",
      loadingStats: "Carregant estadistiques...", totalTasks: "Total de tasques",
      completionRate: "Taxa de completat", avgDuration: "Duracio mitjana",
      failed: "Fallades", statusBreakdown: "Desglossament per estat",
      agentPerformance: "Rendiment dels agents", agent: "Agent", total: "Total",
      done: "Fetes", active: "Actives", avgTime: "Temps mitja", rate: "Taxa",
      noAgentData: "Sense dades d'agents encara",
      stuckTask: "Tasca encallada", inProgressFor: "en curs des de fa",
      noAgents: "Cap agent registrat. Feu servir l'API per registrar agents.",
      deleteTaskConfirm: 'Eliminar "{title}"?',
      clearDoneConfirm: "Eliminar {count} tasques completades?",
      deleteCommentConfirm: "Eliminar comentari?",
      addColumn: "Afegir columna", newColumn: "Nova columna",
      columnName: "Nom de la columna", color: "Color",
      deleteColumn: "Eliminar columna",
      deleteColumnConfirm: 'Eliminar columna "{label}"?',
      moveTasksTo: "Moure {count} tasca/ques a:",
      low: "baixa", medium: "mitjana", high: "alta", urgent: "urgent",
      comments: "comentari", commentsPlural: "comentaris",
      deps: "dep", depsPlural: "deps",
      blockedBy: "Bloquejat per",
    },
    es: {
      board: "Tablero", agents: "Agentes", stats: "Estadisticas",
      noProjects: "Sin proyectos", allAgents: "Todos los agentes",
      searchTasks: "Buscar tareas...",
      newProject: "+ Proyecto", newTask: "+ Tarea", addTask: "+ Anadir tarea",
      clearDone: "Limpiar completadas",
      newProjectTitle: "Nuevo proyecto", name: "Nombre", owner: "Propietario",
      description: "Descripcion", cancel: "Cancelar", create: "Crear",
      newTaskTitle: "Nueva tarea", title: "Titulo", assignee: "Asignado",
      priority: "Prioridad", tags: "Etiquetas", tagsHint: "separadas por comas",
      status: "Estado", createdBy: "Creado por", created: "Creado",
      thread: "Hilo", noComments: "Sin comentarios aun. Inicia la conversacion!",
      author: "Autor", typeMessage: "Escribe un mensaje...", send: "Enviar",
      unassigned: "Sin asignar", noDescription: "Sin descripcion", none: "Ninguno",
      loadingStats: "Cargando estadisticas...", totalTasks: "Total de tareas",
      completionRate: "Tasa de completado", avgDuration: "Duracion media",
      failed: "Fallidas", statusBreakdown: "Desglose por estado",
      agentPerformance: "Rendimiento de agentes", agent: "Agente", total: "Total",
      done: "Hechas", active: "Activas", avgTime: "Tiempo medio", rate: "Tasa",
      noAgentData: "Sin datos de agentes aun",
      stuckTask: "Tarea atascada", inProgressFor: "en curso desde hace",
      noAgents: "Ningun agente registrado. Use la API para registrar agentes.",
      deleteTaskConfirm: 'Eliminar "{title}"?',
      clearDoneConfirm: "Eliminar {count} tareas completadas?",
      deleteCommentConfirm: "Eliminar comentario?",
      addColumn: "Anadir columna", newColumn: "Nueva columna",
      columnName: "Nombre de la columna", color: "Color",
      deleteColumn: "Eliminar columna",
      deleteColumnConfirm: 'Eliminar columna "{label}"?',
      moveTasksTo: "Mover {count} tarea(s) a:",
      low: "baja", medium: "media", high: "alta", urgent: "urgente",
      comments: "comentario", commentsPlural: "comentarios",
      deps: "dep", depsPlural: "deps",
      blockedBy: "Bloqueado por",
    },
  };

  let state = {
    projects: [],
    tasks: [],
    agents: [],
    currentProject: null,
    currentView: "board",
    filterAgent: null,
    lang: localStorage.getItem("ab-lang") || "en",
  };

  function t(key) {
    return I18N[state.lang]?.[key] || I18N.en[key] || key;
  }

  function getColumns() {
    if (!state.currentProject) return DEFAULT_COLUMNS;
    const proj = state.projects.find(p => p.id === state.currentProject);
    return proj?.columns?.length ? proj.columns : DEFAULT_COLUMNS;
  }

  function getColColor(colId) {
    const c = getColumns().find(c => c.id === colId);
    return c ? c.color : "#666";
  }

  function getColLabel(colId) {
    const c = getColumns().find(c => c.id === colId);
    return c ? c.label : colId;
  }

  // --- Theme ---
  const themeToggle = document.getElementById("themeToggle");
  function initTheme() {
    const saved = localStorage.getItem("ab-theme");
    if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.setAttribute("data-theme", "dark");
      themeToggle.textContent = "\u2600";
    }
  }
  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.textContent = isDark ? "\u263E" : "\u2600";
    localStorage.setItem("ab-theme", isDark ? "light" : "dark");
  });
  initTheme();

  // --- Zoom ---
  const ZOOM_STEPS = [50, 60, 70, 80, 90, 100];
  function applyZoom(pct) {
    const scale = pct / 100;
    document.documentElement.style.zoom = scale.toString();
    document.documentElement.style.setProperty("--zoom", scale.toString());
  }
  function getZoom() {
    const saved = parseInt(localStorage.getItem("ab-zoom"), 10);
    return ZOOM_STEPS.includes(saved) ? saved : 100;
  }
  document.getElementById("zoomOut").addEventListener("click", () => {
    const current = getZoom();
    const idx = ZOOM_STEPS.indexOf(current);
    if (idx > 0) {
      const next = ZOOM_STEPS[idx - 1];
      localStorage.setItem("ab-zoom", String(next));
      applyZoom(next);
    }
  });
  document.getElementById("zoomIn").addEventListener("click", () => {
    const current = getZoom();
    const idx = ZOOM_STEPS.indexOf(current);
    if (idx < ZOOM_STEPS.length - 1) {
      const next = ZOOM_STEPS[idx + 1];
      localStorage.setItem("ab-zoom", String(next));
      applyZoom(next);
    }
  });
  applyZoom(getZoom());

  // --- Language Switcher ---
  const langBtn = document.getElementById("langBtn");
  const langDropdown = document.getElementById("langDropdown");

  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => langDropdown.classList.remove("open"));

  document.querySelectorAll(".lang-option").forEach(btn => {
    btn.addEventListener("click", () => {
      state.lang = btn.dataset.lang;
      localStorage.setItem("ab-lang", state.lang);
      langDropdown.classList.remove("open");
      updateStaticI18n();
      render();
    });
  });

  function updateStaticI18n() {
    document.querySelectorAll(".lang-option").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === state.lang);
    });
    document.getElementById("searchInput").placeholder = t("searchTasks");
    document.getElementById("newProjectBtn").textContent = t("newProject");
    document.getElementById("newTaskBtn").textContent = t("newTask");
    document.querySelectorAll(".tab").forEach(tab => {
      const v = tab.dataset.view;
      if (v === "board") tab.textContent = t("board");
      else if (v === "agents") tab.textContent = t("agents");
      else if (v === "stats") tab.textContent = t("stats");
    });
  }
  // Set initial lang highlight
  updateStaticI18n();

  // --- API helpers ---
  async function api(path, opts) {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    return res.json();
  }

  // --- Data loading ---
  async function loadProjects() {
    state.projects = await api("/projects");
    renderProjectSelect();
    if (state.projects.length && !state.currentProject) {
      state.currentProject = state.projects[0].id;
    }
  }

  async function loadTasks() {
    if (!state.currentProject) { state.tasks = []; return; }
    state.tasks = await api("/tasks?projectId=" + state.currentProject);
  }

  async function loadAgents() {
    state.agents = await api("/agents");
  }

  async function refresh() {
    await Promise.all([loadProjects(), loadAgents()]);
    await loadTasks();
    render();
  }

  // --- Project selector ---
  const projectSelect = document.getElementById("projectSelect");
  function renderProjectSelect() {
    if (!state.projects.length) {
      projectSelect.innerHTML = `<option value="">${t("noProjects")}</option>`;
      return;
    }
    projectSelect.innerHTML = state.projects
      .map((p) => `<option value="${p.id}" ${p.id === state.currentProject ? "selected" : ""}>${p.name}</option>`)
      .join("");
  }

  projectSelect.addEventListener("change", async () => {
    state.currentProject = projectSelect.value;
    await loadTasks();
    render();
  });

  // --- Agent filter ---
  const agentFilter = document.getElementById("agentFilter");
  function renderAgentFilter() {
    const agents = [...new Set(state.tasks.map(t => t.assignee).filter(Boolean))].sort();
    agentFilter.innerHTML = `<option value="">${t("allAgents")}</option>` +
      agents.map(a => `<option value="${a}" ${a === state.filterAgent ? "selected" : ""}>${a}</option>`).join("");
  }

  agentFilter.addEventListener("change", () => {
    state.filterAgent = agentFilter.value || null;
    render();
  });

  // --- View tabs ---
  document.getElementById("viewTabs").addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab")) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");
    state.currentView = e.target.dataset.view;
    render();
  });

  // --- Render ---
  function render() {
    const boardView = document.getElementById("boardView");
    const agentsView = document.getElementById("agentsView");
    const statsView = document.getElementById("statsView");

    boardView.classList.add("hidden");
    agentsView.classList.add("hidden");
    statsView.classList.add("hidden");

    if (state.currentView === "board") {
      boardView.classList.remove("hidden");
      renderAgentFilter();
      renderBoard();
    } else if (state.currentView === "agents") {
      agentsView.classList.remove("hidden");
      renderAgents();
    } else if (state.currentView === "stats") {
      statsView.classList.remove("hidden");
      renderStats();
    }
  }

  function formatDuration(ms) {
    if (!ms) return "\u2014";
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  }

  // --- Stats ---
  async function renderStats() {
    const view = document.getElementById("statsView");
    view.innerHTML = `<div style="padding:24px;color:var(--text-muted)">${t("loadingStats")}</div>`;
    const stats = await api("/stats");

    const statusBars = Object.entries(stats.byStatus || {}).map(([s, c]) =>
      `<div class="stat-bar"><span class="stat-label">${s}</span><div class="stat-fill" style="width:${Math.max(5, (c / Math.max(stats.totalTasks, 1)) * 100)}%;background:${getColColor(s)}"></div><span class="stat-val">${c}</span></div>`
    ).join("");

    const agentRows = (stats.agentStats || []).map(a =>
      `<tr>
        <td><strong>${esc(a.agentId)}</strong></td>
        <td>${a.totalTasks}</td>
        <td>${a.completed}</td>
        <td>${a.failed}</td>
        <td>${a.inProgress}</td>
        <td>${formatDuration(a.avgDurationMs)}</td>
        <td>${(a.completionRate * 100).toFixed(0)}%</td>
      </tr>`
    ).join("");

    const oldest = stats.oldestDoingTask;
    const alertHtml = oldest && oldest.ageMs > 7200000
      ? `<div class="stat-alert">\u26A0 ${t("stuckTask")}: "${esc(oldest.title)}" (${esc(oldest.assignee)}) \u2014 ${t("inProgressFor")} ${formatDuration(oldest.ageMs)}</div>`
      : "";

    view.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${stats.totalTasks}</div><div class="stat-title">${t("totalTasks")}</div></div>
        <div class="stat-card"><div class="stat-number">${(stats.completionRate * 100).toFixed(0)}%</div><div class="stat-title">${t("completionRate")}</div></div>
        <div class="stat-card"><div class="stat-number">${formatDuration(stats.avgDurationMs)}</div><div class="stat-title">${t("avgDuration")}</div></div>
        <div class="stat-card"><div class="stat-number">${stats.byStatus?.failed || 0}</div><div class="stat-title">${t("failed")}</div></div>
      </div>
      ${alertHtml}
      <h3 style="margin:24px 0 12px">${t("statusBreakdown")}</h3>
      <div class="stat-bars">${statusBars}</div>
      <h3 style="margin:24px 0 12px">${t("agentPerformance")}</h3>
      <table class="stats-table">
        <thead><tr><th>${t("agent")}</th><th>${t("total")}</th><th>${t("done")}</th><th>${t("failed")}</th><th>${t("active")}</th><th>${t("avgTime")}</th><th>${t("rate")}</th></tr></thead>
        <tbody>${agentRows || `<tr><td colspan="7">${t("noAgentData")}</td></tr>`}</tbody>
      </table>
    `;
  }

  // --- Board ---
  function renderBoard() {
    const board = document.getElementById("boardView");
    const columns = getColumns();

    // Preserve scroll positions
    const scrollPositions = {};
    board.querySelectorAll(".column-body").forEach((body) => {
      scrollPositions[body.dataset.col] = body.scrollTop;
    });

    board.innerHTML = columns.map((colDef) => {
      let tasks = state.tasks.filter((t) => t.column === colDef.id);
      if (state.filterAgent) {
        tasks = tasks.filter((t) => t.assignee === state.filterAgent);
      }
      return `
        <div class="column" data-col="${colDef.id}">
          <div class="column-header" draggable="true">
            <span><span class="dot" style="background:${colDef.color}"></span><span class="col-label">${esc(colDef.label)}</span></span>
            <span class="column-header-actions">
              <span class="count">${tasks.length}</span>
              <button class="col-delete-btn" data-col="${colDef.id}" title="${t("deleteColumn")}">&times;</button>
            </span>
          </div>
          <div class="column-body" data-col="${colDef.id}">
            ${tasks.map(renderCard).join("")}
            <button class="add-task-btn" data-col="${colDef.id}">${t("addTask")}</button>
            ${colDef.id === "done" || (tasks.length && colDef.id === columns.find(c => c.id === "done")?.id) ? "" : ""}
            ${tasks.length && colDef.id === "done" ? `<button class="clear-done-btn">${t("clearDone")} (${tasks.length})</button>` : ""}
          </div>
        </div>`;
    }).join("") + `
      <div class="column column-add" id="addColumnBtn">
        <div class="add-column-icon">+</div>
        <div class="add-column-text">${t("addColumn")}</div>
      </div>`;

    // --- Card Drag & Drop ---
    board.querySelectorAll(".card").forEach(initDrag);
    board.querySelectorAll(".column-body").forEach(initDrop);

    // --- Card click → detail ---
    board.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.defaultPrevented) return;
        openDetail(card.dataset.id);
      });
    });

    // --- Card delete ---
    board.querySelectorAll(".card-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        if (!confirm(t("deleteTaskConfirm").replace("{title}", task.title))) return;
        await api(`/tasks/${id}`, { method: "DELETE" });
        await loadTasks();
        render();
      });
    });

    // --- Clear done ---
    board.querySelectorAll(".clear-done-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const doneTasks = state.tasks.filter((t) => t.column === "done");
        if (!doneTasks.length) return;
        if (!confirm(t("clearDoneConfirm").replace("{count}", doneTasks.length))) return;
        for (const t of doneTasks) {
          await api(`/tasks/${t.id}`, { method: "DELETE" });
        }
        await loadTasks();
        render();
      });
    });

    // --- Add task buttons ---
    board.querySelectorAll(".add-task-btn").forEach((btn) => {
      btn.addEventListener("click", () => showTaskModal(btn.dataset.col));
    });

    // --- Add column button ---
    const addColBtn = document.getElementById("addColumnBtn");
    if (addColBtn) {
      addColBtn.addEventListener("click", () => showAddColumnModal());
    }

    // --- Column header: double-click to rename ---
    board.querySelectorAll(".col-label").forEach((label) => {
      label.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const colEl = label.closest(".column");
        const colId = colEl.dataset.col;
        const colDef = getColumns().find(c => c.id === colId);
        if (!colDef) return;

        const input = document.createElement("input");
        input.type = "text";
        input.value = colDef.label;
        input.className = "col-rename-input";
        label.replaceWith(input);
        input.focus();
        input.select();

        async function save() {
          const newLabel = input.value.trim();
          if (newLabel && newLabel !== colDef.label) {
            await renameColumn(colId, newLabel);
          } else {
            render();
          }
        }
        input.addEventListener("blur", save);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); input.blur(); }
          if (e.key === "Escape") { input.value = colDef.label; input.blur(); }
        });
      });
    });

    // --- Column delete buttons ---
    board.querySelectorAll(".col-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const colId = btn.dataset.col;
        showDeleteColumnModal(colId);
      });
    });

    // --- Column DnD (reorder) ---
    board.querySelectorAll(".column:not(.column-add)").forEach(initColDrag);

    // --- Drop on collapsed columns ---
    board.querySelectorAll(".column:not(.column-add)").forEach((col) => {
      col.addEventListener("dragover", (e) => {
        if (!col.classList.contains("collapsed")) return;
        if (draggedColId) return; // column drag, not card
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        col.classList.add("drag-over");
      });
      col.addEventListener("dragleave", () => {
        col.classList.remove("drag-over");
      });
      col.addEventListener("drop", async (e) => {
        if (!col.classList.contains("collapsed")) return;
        if (draggedColId) return;
        e.preventDefault();
        col.classList.remove("drag-over");
        if (!draggedId) return;
        const newCol = col.dataset.col;
        await api("/tasks/" + draggedId + "/move", {
          method: "POST",
          body: JSON.stringify({ column: newCol }),
        });
        await loadTasks();
        render();
      });
    });

    // --- Column collapse toggle ---
    const collapsed = JSON.parse(localStorage.getItem("ab-collapsed") || '["icebox"]');
    board.querySelectorAll(".column:not(.column-add)").forEach((col) => {
      const colName = col.dataset.col;
      if (collapsed.includes(colName)) col.classList.add("collapsed");
      col.querySelector(".column-header").addEventListener("click", (e) => {
        if (e.defaultPrevented) return;
        col.classList.toggle("collapsed");
        const current = JSON.parse(localStorage.getItem("ab-collapsed") || "[]");
        if (col.classList.contains("collapsed")) {
          if (!current.includes(colName)) current.push(colName);
        } else {
          const idx = current.indexOf(colName);
          if (idx !== -1) current.splice(idx, 1);
        }
        localStorage.setItem("ab-collapsed", JSON.stringify(current));
      });
    });

    // Restore scroll positions
    board.querySelectorAll(".column-body").forEach((body) => {
      if (scrollPositions[body.dataset.col]) {
        body.scrollTop = scrollPositions[body.dataset.col];
      }
    });

    // Re-apply search highlight
    if (searchQuery) applySearch();
  }

  function getUnresolvedDeps(task) {
    if (!task.dependencies || !task.dependencies.length) return [];
    return task.dependencies
      .map((depId) => state.tasks.find((t) => t.id === depId))
      .filter((dep) => dep && dep.column !== "done");
  }

  function renderCard(task) {
    const priorityClass = `badge-priority-${task.priority}`;
    const tags = task.tags.map((t) => `<span class="badge badge-tag">${esc(t)}</span>`).join("");
    const commentsLabel = task.comments.length > 1 ? t("commentsPlural") : t("comments");
    const commentsHtml = task.comments.length ? `<span class="card-comments">${task.comments.length} ${commentsLabel}</span>` : "";

    const blockers = getUnresolvedDeps(task);
    const depsLabel = blockers.length > 1 ? t("depsPlural") : t("deps");
    const lockHtml = blockers.length
      ? `<span class="badge badge-locked" title="${t("blockedBy")}: ${blockers.map((b) => esc(b.title)).join(", ")}">&#x1F512; ${blockers.length} ${depsLabel}</span>`
      : "";

    let overdueClass = "";
    let deadlineHtml = "";
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      const now = new Date();
      const isOverdue = deadlineDate < now && task.column !== "done";
      overdueClass = isOverdue ? "card-overdue" : "";
      const deadlineStr = deadlineDate.toLocaleDateString();
      deadlineHtml = `<span class="badge badge-deadline ${isOverdue ? "badge-overdue" : ""}">${isOverdue ? "\u26A0 " : ""}\uD83D\uDCC5 ${deadlineStr}</span>`;
    }

    return `
      <div class="card ${overdueClass} ${blockers.length ? "card-blocked" : ""}" draggable="true" data-id="${task.id}">
        <div class="card-header">
          <div class="card-title">${lockHtml ? lockHtml + " " : ""}${esc(task.title)}</div>
          <button class="card-delete" data-id="${task.id}" title="Delete">&times;</button>
        </div>
        ${task.description ? `<div class="card-desc">${esc(task.description)}</div>` : ""}
        <div class="card-meta">
          ${task.assignee ? `<span class="badge badge-assignee">${esc(task.assignee)}</span>` : ""}
          <span class="badge ${priorityClass}">${t(task.priority)}</span>
          ${tags}
          ${deadlineHtml}
          ${commentsHtml}
        </div>
      </div>`;
  }

  function renderAgents() {
    const view = document.getElementById("agentsView");
    if (!state.agents.length) {
      view.innerHTML = `<div style="padding:24px;color:var(--text-muted)">${t("noAgents")}</div>`;
      return;
    }
    view.innerHTML = state.agents.map((a) => {
      const taskCount = state.tasks.filter((t) => t.assignee === a.id).length;
      return `
        <div class="agent-card">
          <h3>${esc(a.name)}</h3>
          <div class="role">${esc(a.role)} &middot; ${a.status} &middot; ${taskCount} task${taskCount !== 1 ? "s" : ""}</div>
          <div class="caps">${a.capabilities.map((c) => `<span class="badge badge-tag">${esc(c)}</span>`).join("")}</div>
        </div>`;
    }).join("");
  }

  // --- Card Drag & Drop ---
  let draggedId = null;

  function initDrag(card) {
    card.addEventListener("dragstart", (e) => {
      draggedId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/card", draggedId);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedId = null;
    });
  }

  function initDrop(colBody) {
    colBody.addEventListener("dragover", (e) => {
      if (draggedColId) return; // column drag, not card
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      colBody.classList.add("drag-over");
    });
    colBody.addEventListener("dragleave", () => {
      colBody.classList.remove("drag-over");
    });
    colBody.addEventListener("drop", async (e) => {
      if (draggedColId) return;
      e.preventDefault();
      colBody.classList.remove("drag-over");
      if (!draggedId) return;
      const newCol = colBody.dataset.col;
      await api("/tasks/" + draggedId + "/move", {
        method: "POST",
        body: JSON.stringify({ column: newCol }),
      });
      await loadTasks();
      render();
    });
  }

  // --- Column Drag & Drop (reorder) ---
  let draggedColId = null;

  function initColDrag(colEl) {
    const header = colEl.querySelector(".column-header");

    header.addEventListener("dragstart", (e) => {
      // Only start column drag if not dragging a card
      if (e.target.closest(".card")) return;
      draggedColId = colEl.dataset.col;
      colEl.classList.add("column-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/column", draggedColId);
    });

    header.addEventListener("dragend", () => {
      colEl.classList.remove("column-dragging");
      draggedColId = null;
      document.querySelectorAll(".col-drop-before, .col-drop-after").forEach(el => {
        el.classList.remove("col-drop-before", "col-drop-after");
      });
    });

    colEl.addEventListener("dragover", (e) => {
      if (!draggedColId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Determine before/after based on mouse position
      const rect = colEl.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const allCols = document.querySelectorAll(".column:not(.column-add)");
      allCols.forEach(c => c.classList.remove("col-drop-before", "col-drop-after"));

      if (e.clientX < midX) {
        colEl.classList.add("col-drop-before");
      } else {
        colEl.classList.add("col-drop-after");
      }
    });

    colEl.addEventListener("dragleave", () => {
      colEl.classList.remove("col-drop-before", "col-drop-after");
    });

    colEl.addEventListener("drop", async (e) => {
      if (!draggedColId) return;
      e.preventDefault();
      colEl.classList.remove("col-drop-before", "col-drop-after");

      const targetColId = colEl.dataset.col;
      if (draggedColId === targetColId) return;

      const columns = [...getColumns()];
      const fromIdx = columns.findIndex(c => c.id === draggedColId);
      if (fromIdx === -1) return;

      const [moved] = columns.splice(fromIdx, 1);

      const rect = colEl.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      let toIdx = columns.findIndex(c => c.id === targetColId);
      if (e.clientX >= midX) toIdx++;

      columns.splice(toIdx, 0, moved);

      await api("/projects/" + state.currentProject, {
        method: "PATCH",
        body: JSON.stringify({ columns }),
      });
      await loadProjects();
      render();
    });
  }

  // --- Column Management ---
  async function renameColumn(colId, newLabel) {
    const columns = getColumns().map(c => c.id === colId ? { ...c, label: newLabel } : { ...c });
    await api("/projects/" + state.currentProject, {
      method: "PATCH",
      body: JSON.stringify({ columns }),
    });
    await loadProjects();
    render();
  }

  async function deleteColumn(colId, moveToId) {
    const tasksToMove = state.tasks.filter(t => t.column === colId);
    for (const task of tasksToMove) {
      await api("/tasks/" + task.id + "/move", {
        method: "POST",
        body: JSON.stringify({ column: moveToId }),
      });
    }
    const columns = getColumns().filter(c => c.id !== colId).map(c => ({ ...c }));
    await api("/projects/" + state.currentProject, {
      method: "PATCH",
      body: JSON.stringify({ columns }),
    });
    await loadProjects();
    await loadTasks();
    render();
  }

  function showAddColumnModal() {
    let selectedColor = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
    const swatches = COLOR_PRESETS.map(c =>
      `<button type="button" class="color-swatch ${c === selectedColor ? "selected" : ""}" data-color="${c}" style="background:${c}"></button>`
    ).join("");

    const overlay = showModal(`
      <h2>${t("newColumn")}</h2>
      <label>${t("columnName")}</label>
      <input type="text" id="modalColName" autofocus>
      <label>${t("color")}</label>
      <div class="color-swatches" id="colorSwatches">${swatches}</div>
      <input type="text" id="modalColColor" value="${selectedColor}" style="margin-top:8px">
      <div class="modal-actions">
        <button class="btn" id="modalCancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="modalConfirm">${t("create")}</button>
      </div>
    `);

    overlay.querySelectorAll(".color-swatch").forEach(sw => {
      sw.addEventListener("click", () => {
        overlay.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
        sw.classList.add("selected");
        selectedColor = sw.dataset.color;
        overlay.querySelector("#modalColColor").value = selectedColor;
      });
    });

    overlay.querySelector("#modalColColor").addEventListener("input", (e) => {
      selectedColor = e.target.value;
      overlay.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
    });

    overlay.querySelector("#modalCancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#modalConfirm").addEventListener("click", async () => {
      const name = overlay.querySelector("#modalColName").value.trim();
      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (getColumns().some(c => c.id === id)) {
        alert("Column ID already exists: " + id);
        return;
      }
      const columns = [...getColumns().map(c => ({ ...c })), { id, label: name, color: selectedColor }];
      await api("/projects/" + state.currentProject, {
        method: "PATCH",
        body: JSON.stringify({ columns }),
      });
      overlay.remove();
      await loadProjects();
      render();
    });
  }

  function showDeleteColumnModal(colId) {
    const columns = getColumns();
    const colDef = columns.find(c => c.id === colId);
    if (!colDef) return;
    if (columns.length <= 1) { alert("Cannot delete the last column."); return; }

    const tasksInCol = state.tasks.filter(t => t.column === colId);
    const otherCols = columns.filter(c => c.id !== colId);

    let html = `<h2>${t("deleteColumn")}</h2>
      <p>${t("deleteColumnConfirm").replace("{label}", esc(colDef.label))}</p>`;

    if (tasksInCol.length > 0) {
      html += `
        <label>${t("moveTasksTo").replace("{count}", tasksInCol.length)}</label>
        <select id="modalMoveTo">
          ${otherCols.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}
        </select>`;
    }

    html += `<div class="modal-actions">
        <button class="btn" id="modalCancel">${t("cancel")}</button>
        <button class="btn btn-danger" id="modalConfirm">${t("deleteColumn")}</button>
      </div>`;

    const overlay = showModal(html);
    overlay.querySelector("#modalCancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#modalConfirm").addEventListener("click", async () => {
      const moveToId = tasksInCol.length > 0 ? overlay.querySelector("#modalMoveTo").value : null;
      overlay.remove();
      if (moveToId) {
        await deleteColumn(colId, moveToId);
      } else {
        const cols = getColumns().filter(c => c.id !== colId).map(c => ({ ...c }));
        await api("/projects/" + state.currentProject, {
          method: "PATCH",
          body: JSON.stringify({ columns: cols }),
        });
        await loadProjects();
        render();
      }
    });
  }

  // --- Task Detail Panel ---
  const detailPanel = document.getElementById("detailPanel");
  const detailContent = document.getElementById("detailContent");
  let threadInterval = null;
  let currentDetailTaskId = null;

  document.getElementById("closeDetail").addEventListener("click", () => {
    detailPanel.classList.remove("open");
    if (threadInterval) { clearInterval(threadInterval); threadInterval = null; }
    currentDetailTaskId = null;
  });

  function renderThread(comments) {
    const threadEl = document.getElementById("threadMessages");
    if (!threadEl) return;
    if (!comments.length) {
      threadEl.innerHTML = `<div class="thread-empty">${t("noComments")}</div>`;
      return;
    }
    threadEl.innerHTML = comments.map((c, i) =>
      `<div class="thread-msg">
        <div class="thread-msg-header">
          <span class="thread-msg-author">${esc(c.author)}</span>
          <span class="thread-msg-time">${new Date(c.at).toLocaleString()}</span>
          <button class="thread-msg-delete" data-index="${i}" title="Delete">&times;</button>
        </div>
        <div class="thread-msg-text">${esc(c.text)}</div>
      </div>`
    ).join("");
    threadEl.querySelectorAll(".thread-msg-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(t("deleteCommentConfirm"))) return;
        await api("/tasks/" + currentDetailTaskId + "/comments/" + btn.dataset.index, { method: "DELETE" });
        await refreshThread(currentDetailTaskId);
        await loadTasks();
      });
    });
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function refreshThread(taskId) {
    try {
      const comments = await api("/tasks/" + taskId + "/comments");
      if (currentDetailTaskId === taskId) renderThread(comments);
    } catch (e) { /* ignore */ }
  }

  function openDetail(taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    currentDetailTaskId = taskId;

    const knownAssignees = [...new Set(state.tasks.map((t) => t.assignee).filter(Boolean))].sort();
    const columns = getColumns();

    detailContent.innerHTML = `
      <h2>${esc(task.title)}</h2>
      <div class="detail-field"><label>${t("status")}</label><div class="value"><span class="badge" style="background:${getColColor(task.column)};color:#fff">${getColLabel(task.column)}</span></div></div>
      <div class="detail-field"><label>${t("assignee")}</label><div class="value detail-assignee">
        <input type="text" id="detailAssignee" list="assignee-suggestions" value="${esc(task.assignee || "")}" placeholder="${t("unassigned")}" class="detail-inline-input">
        <datalist id="assignee-suggestions">${knownAssignees.map((a) => `<option value="${esc(a)}">`).join("")}</datalist>
      </div></div>
      <div class="detail-field"><label>${t("priority")}</label><div class="value">
        <select id="detailPriority" class="detail-inline-select">
          ${["low", "medium", "high", "urgent"].map((p) => `<option value="${p}" ${task.priority === p ? "selected" : ""}>${t(p)}</option>`).join("")}
        </select>
      </div></div>
      <div class="detail-field"><label>${t("description")}</label><div class="value">${esc(task.description || t("noDescription"))}</div></div>
      <div class="detail-field"><label>${t("tags")}</label><div class="value">${task.tags.map((tg) => `<span class="badge badge-tag">${esc(tg)}</span>`).join(" ") || t("none")}</div></div>
      <div class="detail-field"><label>${t("createdBy")}</label><div class="value">${esc(task.createdBy)}</div></div>
      <div class="detail-field"><label>${t("created")}</label><div class="value">${new Date(task.createdAt).toLocaleString()}</div></div>
      <div class="thread-panel">
        <label>${t("thread")} (${task.comments.length})</label>
        <div class="thread-messages" id="threadMessages"></div>
        <div class="thread-input">
          <input type="text" id="commentAuthor" placeholder="${t("author")}" class="thread-author-input">
          <div class="thread-send-row">
            <textarea id="commentText" placeholder="${t("typeMessage")}" class="thread-text-input" rows="2"></textarea>
            <button class="btn btn-primary" id="addCommentBtn">${t("send")}</button>
          </div>
        </div>
      </div>
    `;

    renderThread(task.comments);

    async function sendComment() {
      const author = document.getElementById("commentAuthor").value.trim();
      const text = document.getElementById("commentText").value.trim();
      if (!author || !text) return;
      document.getElementById("commentText").value = "";
      await api("/tasks/" + taskId + "/comments", {
        method: "POST",
        body: JSON.stringify({ author, text }),
      });
      await refreshThread(taskId);
      await loadTasks();
    }

    document.getElementById("addCommentBtn").addEventListener("click", sendComment);
    document.getElementById("commentText").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
    });

    document.getElementById("detailAssignee").addEventListener("change", async (e) => {
      await api("/tasks/" + taskId, { method: "PATCH", body: JSON.stringify({ assignee: e.target.value.trim() }) });
      await loadTasks();
    });

    document.getElementById("detailPriority").addEventListener("change", async (e) => {
      await api("/tasks/" + taskId, { method: "PATCH", body: JSON.stringify({ priority: e.target.value }) });
      await loadTasks();
    });

    if (threadInterval) clearInterval(threadInterval);
    threadInterval = setInterval(() => refreshThread(taskId), 10000);

    detailPanel.classList.add("open");
  }

  // --- Modals ---
  function showModal(html) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    return overlay;
  }

  document.getElementById("newProjectBtn").addEventListener("click", () => {
    const overlay = showModal(`
      <h2>${t("newProjectTitle")}</h2>
      <label>${t("name")}</label>
      <input type="text" id="modalProjName" autofocus>
      <label>${t("owner")}</label>
      <input type="text" id="modalProjOwner" placeholder="e.g. agency">
      <label>${t("description")}</label>
      <textarea id="modalProjDesc"></textarea>
      <div class="modal-actions">
        <button class="btn" id="modalCancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="modalConfirm">${t("create")}</button>
      </div>
    `);
    overlay.querySelector("#modalCancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#modalConfirm").addEventListener("click", async () => {
      const name = overlay.querySelector("#modalProjName").value.trim();
      if (!name) return;
      const project = await api("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          owner: overlay.querySelector("#modalProjOwner").value.trim() || "unknown",
          description: overlay.querySelector("#modalProjDesc").value.trim(),
        }),
      });
      state.currentProject = project.id;
      overlay.remove();
      await refresh();
    });
  });

  function showTaskModal(column) {
    if (!state.currentProject) return;
    const columns = getColumns();
    const overlay = showModal(`
      <h2>${t("newTaskTitle")}</h2>
      <label>${t("title")}</label>
      <input type="text" id="modalTaskTitle" autofocus>
      <label>${t("description")}</label>
      <textarea id="modalTaskDesc"></textarea>
      <label>${t("assignee")}</label>
      <input type="text" id="modalTaskAssignee">
      <label>${t("priority")}</label>
      <select id="modalTaskPriority">
        ${["medium", "low", "high", "urgent"].map(p => `<option value="${p}">${t(p)}</option>`).join("")}
      </select>
      <label>${t("tags")} (${t("tagsHint")})</label>
      <input type="text" id="modalTaskTags" placeholder="seo, audit">
      <div class="modal-actions">
        <button class="btn" id="modalCancel">${t("cancel")}</button>
        <button class="btn btn-primary" id="modalConfirm">${t("create")}</button>
      </div>
    `);
    overlay.querySelector("#modalCancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#modalConfirm").addEventListener("click", async () => {
      const title = overlay.querySelector("#modalTaskTitle").value.trim();
      if (!title) return;
      const tags = overlay.querySelector("#modalTaskTags").value.trim();
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: state.currentProject,
          title,
          description: overlay.querySelector("#modalTaskDesc").value.trim(),
          assignee: overlay.querySelector("#modalTaskAssignee").value.trim(),
          priority: overlay.querySelector("#modalTaskPriority").value,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          column: column || "backlog",
        }),
      });
      overlay.remove();
      await loadTasks();
      render();
    });
  }

  document.getElementById("newTaskBtn").addEventListener("click", () => showTaskModal("backlog"));

  // --- Search ---
  const searchInput = document.getElementById("searchInput");
  let searchQuery = "";

  function applySearch() {
    const board = document.getElementById("boardView");
    const cards = board.querySelectorAll(".card");
    if (!searchQuery) {
      cards.forEach((c) => { c.classList.remove("card-highlight", "card-dimmed"); });
      return;
    }

    const q = searchQuery.toLowerCase();
    const matches = [];

    cards.forEach((card) => {
      const task = state.tasks.find((t) => t.id === card.dataset.id);
      if (!task) return;
      const haystack = [task.id, task.title, task.description, task.assignee, ...task.tags]
        .filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(q)) {
        card.classList.add("card-highlight");
        card.classList.remove("card-dimmed");
        matches.push(card);
      } else {
        card.classList.remove("card-highlight");
        card.classList.add("card-dimmed");
      }
    });

    if (matches.length === 1) {
      const card = matches[0];
      const colBody = card.closest(".column-body");
      if (colBody) {
        const colRect = colBody.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        if (cardRect.top < colRect.top || cardRect.bottom > colRect.bottom) {
          card.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }
  }

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    applySearch();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = "";
      searchQuery = "";
      applySearch();
      searchInput.blur();
    }
  });

  // --- Escape ---
  function esc(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Init ---
  refresh();

  // Auto-refresh every 5s
  setInterval(async () => {
    await loadTasks();
    if (state.currentView === "board") renderBoard();
  }, 5000);
})();
