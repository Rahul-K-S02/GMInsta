requireAuth();

const eventsList = document.getElementById("eventsList");
const tabs = Array.from(document.querySelectorAll(".events-tab[data-category]"));
const openCreateEvent = document.getElementById("openCreateEvent");
const closeCreateEvent = document.getElementById("closeCreateEvent");
const createEventCard = document.getElementById("createEventCard");
const createEventForm = document.getElementById("createEventForm");
const eventMessage = document.getElementById("eventMessage");
const eventPoster = document.getElementById("eventPoster");

let category = "all";
let canUploadEvents = false;

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

const CATEGORY_LABELS = {
  hackathon: "Hackathon",
  workshop: "Workshop",
  competition: "Competition",
  cultural: "Cultural",
  sports: "Sports"
};

const renderEvent = (event) => {
  const tag = (CATEGORY_LABELS[event.category] || event.category || "Event").toUpperCase();
  const spotsText = event.spotsLeft === 1 ? "1 spot left" : `${event.spotsLeft ?? 0} spots left`;
  const registeredText = event.registeredCount === 1 ? "1 registered" : `${event.registeredCount ?? 0} registered`;
  const btnLabel = event.isRegistered ? "Registered" : "Register";
  const disabled = event.isRegistered || (event.spotsLeft ?? 0) <= 0;

  const poster = event.posterUrl
    ? `<a href="${event.posterUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open event poster">
        <img class="event-poster" src="${event.posterUrl}" alt="poster" loading="lazy" onerror="this.style.display='none'" />
      </a>`
    : "";

  return `
    <article class="card event-card" data-event-id="${event._id}">
      ${poster}
      <div class="event-card-top">
        <span class="event-tag">${escapeHtml(tag)}</span>
        <div class="event-date">
          <span class="event-date-icon">CAL</span>
          <span>${escapeHtml(event.dateLabel || "")}</span>
        </div>
      </div>

      <h3 class="event-title">${escapeHtml(event.title || "")}</h3>
      <p class="muted event-desc">${escapeHtml(event.description || "")}</p>

      <div class="event-meta">
        <span class="event-meta-item"><span class="event-meta-icon">PIN</span>${escapeHtml(event.location || "")}</span>
        <span class="event-meta-item"><span class="event-meta-icon">TIME</span>${escapeHtml(event.timeLabel || "")}</span>
      </div>

      <div class="event-bottom">
        <div class="event-stats">
          <div class="muted">${escapeHtml(registeredText)}</div>
          <div class="muted">${escapeHtml(spotsText)}</div>
        </div>
        <button class="btn-small event-register-btn" type="button" data-action="register-event" data-event-id="${event._id}" ${disabled ? "disabled" : ""}>
          ${escapeHtml(btnLabel)}
        </button>
      </div>
    </article>
  `;
};

const renderEmpty = () => `
  <div class="card empty-state">
    <div class="empty-state-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/></svg>
    </div>
    <h3>No Events Found</h3>
    <p>Try a different category.</p>
  </div>
`;

async function loadEvents() {
  try {
    const data = await apiFetch(`/events?category=${encodeURIComponent(category)}`);
    if (!Array.isArray(data) || data.length === 0) {
      eventsList.innerHTML = renderEmpty();
      return;
    }
    eventsList.innerHTML = data.map(renderEvent).join("");
  } catch (error) {
    console.error("Error loading events:", error);
    eventsList.innerHTML = `<div class="card"><p class="muted">Error: ${escapeHtml(error.message)}</p></div>`;
  }
}

async function registerEvent(eventId, button) {
  try {
    if (button) {
      button.disabled = true;
      button.dataset.prevText = button.textContent;
      button.textContent = "Registering...";
    }
    await apiFetch(`/events/${eventId}/register`, { method: "POST" });
    await loadEvents();
  } catch (error) {
    alert(error.message || "Unable to register.");
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.prevText || "Register";
      delete button.dataset.prevText;
    }
  }
}

function setEventMessage(msg, isError = false) {
  if (!eventMessage) return;
  eventMessage.textContent = msg || "";
  eventMessage.style.color = isError ? "#ef4444" : "";
}

openCreateEvent?.addEventListener("click", () => {
  if (!createEventCard) return;
  if (!canUploadEvents) return setEventMessage("Only admins can upload events.", true);
  createEventCard.style.display = "block";
  createEventCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

closeCreateEvent?.addEventListener("click", () => {
  if (!createEventCard) return;
  createEventCard.style.display = "none";
  setEventMessage("");
  createEventForm?.reset?.();
});

createEventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setEventMessage("");
  if (!canUploadEvents) return setEventMessage("Only admins can upload events.", true);

  const fd = new FormData();
  fd.append("title", document.getElementById("eventTitle")?.value?.trim() || "");
  fd.append("description", document.getElementById("eventDescription")?.value?.trim() || "");
  fd.append("category", document.getElementById("eventCategory")?.value || "");
  fd.append("dateLabel", document.getElementById("eventDateLabel")?.value?.trim() || "");
  fd.append("timeLabel", document.getElementById("eventTimeLabel")?.value?.trim() || "");
  fd.append("location", document.getElementById("eventLocation")?.value?.trim() || "");
  fd.append("totalSpots", document.getElementById("eventTotalSpots")?.value || "");
  if (eventPoster?.files?.[0]) fd.append("poster", eventPoster.files[0]);

  const btn = createEventForm.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.dataset.prevText = btn.textContent;
    btn.textContent = "Publishing...";
  }

  try {
    await apiFetch("/events", {
      method: "POST",
      body: fd
    });

    setEventMessage("Event published!");
    createEventForm.reset();
    if (createEventCard) createEventCard.style.display = "none";
    await loadEvents();
  } catch (error) {
    setEventMessage(error.message || "Unable to publish event.", true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || "Publish Event";
      delete btn.dataset.prevText;
    }
  }
});

async function loadAdminFlag() {
  try {
    const me = await apiFetch("/users/me");
    canUploadEvents = !!me?.isAdmin;
  } catch (error) {
    canUploadEvents = false;
  }

  // Hide the upload entry points for normal users.
  if (openCreateEvent) openCreateEvent.style.display = canUploadEvents ? "inline-flex" : "none";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    category = tab.dataset.category || "all";
    loadEvents();
  });
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest('button[data-action="register-event"][data-event-id]');
  if (!btn) return;
  const eventId = btn.dataset.eventId;
  if (!eventId) return;
  registerEvent(eventId, btn);
});

loadAdminFlag().finally(loadEvents);
