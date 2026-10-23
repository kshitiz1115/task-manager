// The browser talks to the same-origin API; session cookies stay HttpOnly.
const API = "/api";
const REQUEST_HEADER = { "X-Requested-With": "StudySpace" };

const authPanel = document.querySelector("#auth-panel");
const authForm = document.querySelector("#auth-form");
const authHeading = document.querySelector("#auth-heading");
const authMessage = document.querySelector("#auth-message");
const authName = document.querySelector("#auth-name");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const nameField = document.querySelector("#name-field");
const passwordHint = document.querySelector("#password-hint");
const authSubmit = document.querySelector("#auth-submit");
const loginTab = document.querySelector("#show-login");
const registerTab = document.querySelector("#show-register");
const studentIndicator = document.querySelector("#student-indicator");
const studentName = document.querySelector("#student-name");
const studentAvatar = document.querySelector("#student-avatar");
const appView = document.querySelector("#app-view");
const logoutButton = document.querySelector("#logout-button");

const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const descriptionInput = document.querySelector("#task-description");
const priorityInput = document.querySelector("#task-priority");
const dueDateInput = document.querySelector("#task-due-date");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const taskStatus = document.querySelector("#task-status");
const emptyState = document.querySelector("#empty-state");
const filterEmptyState = document.querySelector("#filter-empty-state");
const listFooter = document.querySelector("#list-footer");
const taskFilters = document.querySelector("#task-filters");
const taskSearch = document.querySelector("#task-search");
const priorityFilter = document.querySelector("#priority-filter");
const dueDateFilter = document.querySelector("#due-date-filter");
const filterResultCount = document.querySelector("#filter-result-count");
const clearFiltersButton = document.querySelector("#clear-filters-button");

const timerClock = document.querySelector("#timer-clock");
const timerModeLabel = document.querySelector("#timer-mode-label");
const timerStatus = document.querySelector("#timer-status");
const timerStartButton = document.querySelector("#timer-start-button");
const timerResetButton = document.querySelector("#timer-reset-button");
const focusModeButton = document.querySelector("#focus-mode-button");
const breakModeButton = document.querySelector("#break-mode-button");

let tasks = [];
let taskBeingEdited = null;
let isRegistering = false;
let timerMode = "focus";
let timerRemainingSeconds = 25 * 60;
let timerEndTime = null;
let timerInterval = null;

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method && options.method !== "GET") {
    headers.set("X-Requested-With", "StudySpace");
  }
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(" ")
      : detail;
    const error = new Error(message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setAuthMode(registering) {
  isRegistering = registering;
  nameField.hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  passwordHint.hidden = !registering;
  authSubmit.textContent = registering ? "Create account" : "Sign in";
  authHeading.innerHTML = registering
    ? 'Create your <span>study space.</span>'
    : 'A calmer way to <span>get things done.</span>';
  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);
  loginTab.setAttribute("aria-pressed", String(!registering));
  registerTab.setAttribute("aria-pressed", String(registering));
  authMessage.textContent = "";
  authMessage.classList.remove("error");
}

function showError(target, error) {
  target.textContent = error.message;
  target.classList.add("error");
}

function showSignedIn(user) {
  authPanel.hidden = true;
  appView.hidden = false;
  studentIndicator.hidden = false;
  studentName.textContent = user.name;
  studentAvatar.textContent = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function checkSession() {
  authMessage.textContent = "";
  authMessage.classList.remove("error");
  try {
    const user = await apiRequest("/auth/me");
    showSignedIn(user);
    await refreshTasks();
  } catch (error) {
    if (error.status !== 401) {
      showError(authMessage, error);
    }
  }
}

loginTab.addEventListener("click", () => setAuthMode(false));
registerTab.addEventListener("click", () => setAuthMode(true));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  authMessage.classList.remove("error");
  authSubmit.disabled = true;

  try {
    const credentials = {
      email: authEmail.value.trim(),
      password: authPassword.value,
    };
    const user = await apiRequest(
      isRegistering ? "/auth/register" : "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(isRegistering
          ? { ...credentials, name: authName.value.trim() }
          : credentials),
      }
    );
    showSignedIn(user);
    authForm.reset();
    await refreshTasks();
  } catch (error) {
    showError(authMessage, error);
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    tasks = [];
    renderTasks();
    resetForm();
    setTimerMode("focus");
    appView.hidden = true;
    studentIndicator.hidden = true;
    authPanel.hidden = false;
    setAuthMode(false);
    authMessage.textContent = "You have signed out.";
  } catch (error) {
    showError(authMessage, error);
  }
});

async function refreshTasks() {
  try {
    tasks = await apiRequest("/tasks");
    renderTasks();
    taskStatus.textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} loaded.`;
  } catch (error) {
    taskStatus.textContent = error.message;
  }
}

function formatDueDate(dateValue) {
  if (!dateValue) return "No due date";
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `Due ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

function getTodayDateValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function matchesTaskFilters(task) {
  const query = taskSearch.value.trim().toLocaleLowerCase();
  const searchMatches = !query ||
    `${task.title} ${task.description}`.toLocaleLowerCase().includes(query);
  const priorityMatches = priorityFilter.value === "all" ||
    task.priority === priorityFilter.value;
  const today = getTodayDateValue();
  let dueDateMatches = true;

  switch (dueDateFilter.value) {
    case "today":
      dueDateMatches = task.due_date === today;
      break;
    case "upcoming":
      dueDateMatches = Boolean(task.due_date) && task.due_date > today;
      break;
    case "overdue":
      dueDateMatches = Boolean(task.due_date) && task.due_date < today;
      break;
    case "none":
      dueDateMatches = !task.due_date;
      break;
  }

  return searchMatches && priorityMatches && dueDateMatches;
}

function renderTasks() {
  const visibleTasks = tasks.filter(matchesTaskFilters);
  const hasTasks = tasks.length > 0;
  const hasFilters = taskSearch.value.trim() !== "" ||
    priorityFilter.value !== "all" ||
    dueDateFilter.value !== "all";

  taskList.replaceChildren(...visibleTasks.map(createTaskElement));
  taskCount.textContent = String(tasks.length);
  taskFilters.hidden = !hasTasks;
  emptyState.hidden = hasTasks;
  filterEmptyState.hidden = !hasTasks || visibleTasks.length > 0;
  listFooter.hidden = !hasTasks || visibleTasks.length === 0;
  taskList.hidden = visibleTasks.length === 0;
  clearFiltersButton.hidden = !hasFilters;

  if (hasFilters) {
    filterResultCount.textContent =
      `Showing ${visibleTasks.length} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  } else {
    filterResultCount.textContent = "";
  }
}

function setTimerMode(mode) {
  pauseTimer();
  timerMode = mode;
  timerRemainingSeconds = mode === "focus" ? 25 * 60 : 5 * 60;
  timerStatus.textContent = "";
  focusModeButton.classList.toggle("active", mode === "focus");
  breakModeButton.classList.toggle("active", mode === "break");
  focusModeButton.setAttribute("aria-pressed", String(mode === "focus"));
  breakModeButton.setAttribute("aria-pressed", String(mode === "break"));
  timerModeLabel.textContent = mode === "focus" ? "25 minutes of focus" : "5 minutes to recharge";
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemainingSeconds / 60);
  const seconds = timerRemainingSeconds % 60;
  const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerClock.textContent = time;
  timerClock.setAttribute(
    "aria-label",
    `${minutes} minute${minutes === 1 ? "" : "s"} and ${seconds} seconds remaining`
  );
  timerStartButton.textContent = timerInterval ? "Pause" : "Start";
}

function pauseTimer() {
  if (timerInterval) {
    timerRemainingSeconds = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndTime = null;
  updateTimerDisplay();
}

function tickTimer() {
  timerRemainingSeconds = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
  updateTimerDisplay();

  if (timerRemainingSeconds === 0) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    timerEndTime = null;
    updateTimerDisplay();
    timerStatus.textContent = timerMode === "focus"
      ? "Focus sprint complete. You earned a little break."
      : "Break finished. Ready when you are for another focus sprint.";
  }
}

timerStartButton.addEventListener("click", () => {
  if (timerInterval) {
    pauseTimer();
    timerStatus.textContent = "Timer paused.";
    return;
  }

  if (timerRemainingSeconds === 0) {
    timerRemainingSeconds = timerMode === "focus" ? 25 * 60 : 5 * 60;
  }
  timerEndTime = Date.now() + timerRemainingSeconds * 1000;
  timerInterval = window.setInterval(tickTimer, 250);
  timerStatus.textContent = timerMode === "focus" ? "Focus sprint started." : "Break started.";
  updateTimerDisplay();
});

timerResetButton.addEventListener("click", () => {
  setTimerMode(timerMode);
  timerStatus.textContent = "Timer reset.";
});

focusModeButton.addEventListener("click", () => setTimerMode("focus"));
breakModeButton.addEventListener("click", () => setTimerMode("break"));
taskSearch.addEventListener("input", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
dueDateFilter.addEventListener("change", renderTasks);
clearFiltersButton.addEventListener("click", () => {
  taskSearch.value = "";
  priorityFilter.value = "all";
  dueDateFilter.value = "all";
  renderTasks();
  taskSearch.focus();
});

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-card";
  const top = document.createElement("div");
  top.className = "task-card-top";
  const textContent = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = task.title;
  textContent.append(title);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    textContent.append(description);
  }

  const priority = document.createElement("span");
  priority.className = `priority-badge priority-${task.priority}`;
  priority.textContent = `${task.priority} priority`;
  top.append(textContent, priority);

  const bottom = document.createElement("div");
  bottom.className = "task-card-bottom";
  const dueDate = document.createElement("span");
  dueDate.className = "task-due-date";
  dueDate.textContent = formatDueDate(task.due_date);
  if (task.due_date && task.due_date < getTodayDateValue()) {
    dueDate.classList.add("overdue");
    dueDate.textContent += " · overdue";
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const editButton = document.createElement("button");
  editButton.className = "task-action";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit task: ${task.title}`);
  editButton.addEventListener("click", () => startEditing(task));

  const deleteButton = document.createElement("button");
  deleteButton.className = "task-action delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete task: ${task.title}`);
  deleteButton.addEventListener("click", () => deleteTask(task.id));
  actions.append(editButton, deleteButton);
  bottom.append(dueDate, actions);
  item.append(top, bottom);
  return item;
}

function resetForm() {
  taskForm.reset();
  priorityInput.value = "medium";
  taskBeingEdited = null;
  submitButton.innerHTML = '<span aria-hidden="true">＋</span> Add task';
  cancelEditButton.hidden = true;
  document.querySelector("#form-heading").textContent = "Add a task";
}

function startEditing(task) {
  taskBeingEdited = task.id;
  titleInput.value = task.title;
  descriptionInput.value = task.description;
  priorityInput.value = task.priority;
  dueDateInput.value = task.due_date || "";
  submitButton.textContent = "Save changes";
  cancelEditButton.hidden = false;
  document.querySelector("#form-heading").textContent = "Edit task";
  titleInput.focus();
}

async function deleteTask(taskId) {
  const deletedTask = tasks.find((task) => task.id === taskId);
  try {
    await apiRequest(`/tasks/${taskId}`, { method: "DELETE" });
    tasks = tasks.filter((task) => task.id !== taskId);
    if (taskBeingEdited === taskId) resetForm();
    renderTasks();
    taskStatus.textContent = `Deleted task: ${deletedTask.title}`;
  } catch (error) {
    taskStatus.textContent = error.message;
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  titleInput.setCustomValidity(titleInput.value.trim() ? "" : "Please enter a task title.");
  if (!taskForm.reportValidity()) return;

  const formData = new FormData(taskForm);
  const taskDetails = {
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    priority: formData.get("priority"),
    due_date: formData.get("dueDate") || null,
  };

  submitButton.disabled = true;
  try {
    const updatedTask = taskBeingEdited
      ? await apiRequest(`/tasks/${taskBeingEdited}`, {
        method: "PATCH",
        body: JSON.stringify(taskDetails),
      })
      : await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify(taskDetails),
      });
    if (taskBeingEdited) {
      tasks = tasks.map((task) => task.id === updatedTask.id ? updatedTask : task);
      taskStatus.textContent = `Updated task: ${updatedTask.title}`;
    } else {
      tasks.unshift(updatedTask);
      taskStatus.textContent = `Added task: ${updatedTask.title}`;
    }
    renderTasks();
    resetForm();
    titleInput.focus();
  } catch (error) {
    taskStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));
cancelEditButton.addEventListener("click", () => {
  resetForm();
  taskStatus.textContent = "Editing cancelled.";
  titleInput.focus();
});

renderTasks();
updateTimerDisplay();
checkSession();
