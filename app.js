// ===== State =====
let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let labels = JSON.parse(localStorage.getItem('labels') || '[]');
let currentFilter = 'all';
let currentLabelFilter = null;
let currentView = 'grid'; // grid | list
let editingNoteId = null;
let deleteNoteId = null;
let deferredInstallPrompt = null;

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const sidebar = $('#sidebar');
const sidebarOverlay = $('#sidebarOverlay');
const notesGrid = $('#notesGrid');
const emptyState = $('#emptyState');
const noteModal = $('#noteModal');
const labelModal = $('#labelModal');
const deleteModal = $('#deleteModal');
const searchInput = $('#searchInput');
const sortSelect = $('#sortSelect');
const toastContainer = $('#toastContainer');
const reminderAlert = $('#reminderAlert');
const installBanner = $('#installBanner');
const offlineBanner = $('#offlineBanner');

// ===== Utilities =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function save() {
    try {
        localStorage.setItem('notes', JSON.stringify(notes));
        localStorage.setItem('labels', JSON.stringify(labels));
        updateStorageInfo();
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showToast('⚠️ Penyimpanan penuh! Hapus beberapa catatan.');
        }
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;

    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatReminder(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function isOverdue(dateStr) {
    return new Date(dateStr) < new Date();
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStorageInfo() {
    const info = $('#storageInfo');
    if (!info) return;
    const dataSize = new Blob([localStorage.getItem('notes') || '', localStorage.getItem('labels') || '']).size;
    const sizeStr = dataSize < 1024 ? `${dataSize} B` : `${(dataSize / 1024).toFixed(1)} KB`;
    info.textContent = `Data lokal: ${sizeStr} • ${notes.length} catatan`;
}

// ===== Render Notes =====
function getFilteredNotes() {
    let filtered = [...notes];

    // Filter by category
    if (currentFilter === 'reminder') {
        filtered = filtered.filter(n => n.reminder && !n.archived);
    } else if (currentFilter === 'pinned') {
        filtered = filtered.filter(n => n.pinned && !n.archived);
    } else if (currentFilter === 'archived') {
        filtered = filtered.filter(n => n.archived);
    } else {
        filtered = filtered.filter(n => !n.archived);
    }

    // Filter by label
    if (currentLabelFilter) {
        filtered = filtered.filter(n => n.labels && n.labels.includes(currentLabelFilter));
    }

    // Search
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(n =>
            (n.title || '').toLowerCase().includes(query) ||
            (n.content || '').toLowerCase().includes(query) ||
            (n.checklist || []).some(item => item.text.toLowerCase().includes(query))
        );
    }

    // Sort
    const sort = sortSelect.value;
    if (sort === 'newest') {
        filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else if (sort === 'oldest') {
        filtered.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    } else if (sort === 'alpha') {
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'reminder') {
        filtered.sort((a, b) => {
            if (!a.reminder) return 1;
            if (!b.reminder) return -1;
            return new Date(a.reminder) - new Date(b.reminder);
        });
    }

    // Pin to top (except in pinned filter)
    if (currentFilter !== 'pinned') {
        const pinned = filtered.filter(n => n.pinned);
        const unpinned = filtered.filter(n => !n.pinned);
        filtered = [...pinned, ...unpinned];
    }

    return filtered;
}

function renderNotes() {
    const filtered = getFilteredNotes();

    if (filtered.length === 0) {
        notesGrid.style.display = 'none';
        emptyState.style.display = 'block';

        if (searchInput.value.trim()) {
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>Tidak ditemukan</h3>
                <p>Coba kata kunci lain</p>
            `;
        } else if (currentFilter === 'archived') {
            emptyState.innerHTML = `
                <div class="empty-icon">🗄️</div>
                <h3>Arsip kosong</h3>
                <p>Catatan yang diarsipkan akan muncul di sini</p>
            `;
        } else {
            emptyState.innerHTML = `
                <div class="empty-icon">📝</div>
                <h3>Belum ada catatan</h3>
                <p>Ketuk tombol + untuk membuat catatan baru</p>
            `;
        }
        return;
    }

    notesGrid.style.display = '';
    emptyState.style.display = 'none';

    notesGrid.innerHTML = filtered.map(note => {
        const noteLabels = (note.labels || []).map(lId => labels.find(l => l.id === lId)).filter(Boolean);
        const hasChecklist = note.checklist && note.checklist.length > 0;
        const checkedCount = hasChecklist ? note.checklist.filter(i => i.checked).length : 0;

        return `
            <div class="note-card" data-id="${note.id}" style="background:${note.color || '#ffffff'}" onclick="openEditNote('${note.id}')">
                ${note.pinned ? '<span class="pin-indicator">📌</span>' : ''}
                <div class="note-card-header">
                    <div class="note-card-title">${escapeHtml(note.title || 'Tanpa Judul')}</div>
                    <div class="note-card-actions">
                        <button onclick="event.stopPropagation(); togglePin('${note.id}')" title="${note.pinned ? 'Lepas sematan' : 'Sematkan'}">
                            ${note.pinned ? '📌' : '📍'}
                        </button>
                        <button onclick="event.stopPropagation(); toggleArchive('${note.id}')" title="${note.archived ? 'Keluarkan dari arsip' : 'Arsipkan'}">
                            ${note.archived ? '📤' : '🗄️'}
                        </button>
                        <button onclick="event.stopPropagation(); confirmDelete('${note.id}')" title="Hapus">🗑️</button>
                    </div>
                </div>
                ${note.content ? `<div class="note-card-content">${escapeHtml(note.content)}</div>` : ''}
                ${hasChecklist ? `
                    <div class="note-card-checklist">
                        ${note.checklist.slice(0, 4).map(item => `
                            <div class="checklist-preview-item ${item.checked ? 'checked' : ''}">
                                <span class="check-icon">${item.checked ? '✓' : ''}</span>
                                <span>${escapeHtml(item.text)}</span>
                            </div>
                        `).join('')}
                        ${note.checklist.length > 4 ? `<span style="font-size:0.78rem;color:var(--text-muted)">+${note.checklist.length - 4} lainnya</span>` : ''}
                        <span style="font-size:0.72rem;color:var(--text-muted)">${checkedCount}/${note.checklist.length} selesai</span>
                    </div>
                ` : ''}
                ${noteLabels.length > 0 ? `
                    <div class="note-card-labels">
                        ${noteLabels.map(l => `<span class="note-label-chip" style="background:${l.color}">${escapeHtml(l.name)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="note-card-footer">
                    <span class="note-card-date">${formatDate(note.updatedAt)}</span>
                    ${note.reminder ? `
                        <span class="note-card-reminder ${isOverdue(note.reminder) ? 'overdue' : ''}">
                            ⏰ ${formatReminder(note.reminder)}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    updateBadges();
}

// ===== Badges =====
function updateBadges() {
    const active = notes.filter(n => !n.archived);
    $('#badgeAll').textContent = active.length;
    $('#badgeReminder').textContent = active.filter(n => n.reminder).length;
    $('#badgePinned').textContent = active.filter(n => n.pinned).length;
    $('#badgeArchived').textContent = notes.filter(n => n.archived).length;
}

// ===== Labels =====
function renderLabels() {
    const labelList = $('#labelList');
    labelList.innerHTML = labels.map(l => `
        <button class="label-item ${currentLabelFilter === l.id ? 'active' : ''}" onclick="filterByLabel('${l.id}')">
            <span class="label-dot" style="background:${l.color}"></span>
            <span>${escapeHtml(l.name)}</span>
            <button class="delete-label" onclick="event.stopPropagation(); deleteLabel('${l.id}')" title="Hapus label">✕</button>
        </button>
    `).join('');

    renderLabelSelector();
}

function renderLabelSelector() {
    const selector = $('#labelSelector');
    if (!selector) return;
    selector.innerHTML = labels.map(l => `
        <span class="label-chip" data-label-id="${l.id}" style="background:${l.color}" onclick="toggleLabelSelection(this)">${escapeHtml(l.name)}</span>
    `).join('');
}

function toggleLabelSelection(el) {
    el.classList.toggle('selected');
}

function filterByLabel(labelId) {
    if (currentLabelFilter === labelId) {
        currentLabelFilter = null;
    } else {
        currentLabelFilter = labelId;
    }
    renderLabels();
    renderNotes();

    const label = labels.find(l => l.id === labelId);
    if (currentLabelFilter && label) {
        $('#pageTitle').textContent = `Label: ${label.name}`;
    } else {
        updatePageTitle();
    }
}

function deleteLabel(labelId) {
    labels = labels.filter(l => l.id !== labelId);
    notes.forEach(n => {
        if (n.labels) n.labels = n.labels.filter(id => id !== labelId);
    });
    if (currentLabelFilter === labelId) currentLabelFilter = null;
    save();
    renderLabels();
    renderNotes();
    showToast('Label dihapus');
}

// ===== Note CRUD =====
function openNewNote() {
    editingNoteId = null;
    $('#modalTitle').textContent = 'Catatan Baru';
    $('#noteTitle').value = '';
    $('#noteContent').value = '';
    $('#enableChecklist').checked = false;
    $('#checklistContainer').style.display = 'none';
    $('#checklistItems').innerHTML = '';
    $('#enableReminder').checked = false;
    $('#reminderFields').style.display = 'none';
    $('#reminderDate').value = '';
    $('#reminderRepeat').value = 'none';

    // Reset color
    $$('#colorOptions .color-dot').forEach(d => d.classList.remove('active'));
    $('#colorOptions .color-dot').classList.add('active');

    // Reset labels
    renderLabelSelector();

    noteModal.classList.add('active');
    setTimeout(() => $('#noteTitle').focus(), 300);
}

function openEditNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    editingNoteId = id;
    $('#modalTitle').textContent = 'Edit Catatan';
    $('#noteTitle').value = note.title;
    $('#noteContent').value = note.content;

    // Color
    $$('#colorOptions .color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === (note.color || '#ffffff'));
    });

    // Checklist
    if (note.checklist && note.checklist.length > 0) {
        $('#enableChecklist').checked = true;
        $('#checklistContainer').style.display = 'block';
        renderChecklistItems(note.checklist);
    } else {
        $('#enableChecklist').checked = false;
        $('#checklistContainer').style.display = 'none';
        $('#checklistItems').innerHTML = '';
    }

    // Reminder
    if (note.reminder) {
        $('#enableReminder').checked = true;
        $('#reminderFields').style.display = 'flex';
        $('#reminderDate').value = note.reminder;
        $('#reminderRepeat').value = note.reminderRepeat || 'none';
    } else {
        $('#enableReminder').checked = false;
        $('#reminderFields').style.display = 'none';
        $('#reminderDate').value = '';
        $('#reminderRepeat').value = 'none';
    }

    // Labels
    renderLabelSelector();
    if (note.labels) {
        note.labels.forEach(lId => {
            const chip = $(`#labelSelector [data-label-id="${lId}"]`);
            if (chip) chip.classList.add('selected');
        });
    }

    noteModal.classList.add('active');
    setTimeout(() => $('#noteTitle').focus(), 300);
}

function saveNote() {
    const title = $('#noteTitle').value.trim();
    const content = $('#noteContent').value.trim();
    const color = $('#colorOptions .color-dot.active')?.dataset.color || '#ffffff';

    // Checklist
    let checklist = [];
    if ($('#enableChecklist').checked) {
        $$('#checklistItems .checklist-item').forEach(item => {
            checklist.push({
                text: item.querySelector('.item-text').textContent,
                checked: item.querySelector('input[type="checkbox"]').checked
            });
        });
    }

    // Reminder
    let reminder = null;
    let reminderRepeat = 'none';
    if ($('#enableReminder').checked && $('#reminderDate').value) {
        reminder = $('#reminderDate').value;
        reminderRepeat = $('#reminderRepeat').value;
    }

    // Labels
    const selectedLabels = [];
    $$('#labelSelector .label-chip.selected').forEach(el => {
        selectedLabels.push(el.dataset.labelId);
    });

    if (!title && !content && checklist.length === 0) {
        showToast('⚠️ Catatan tidak boleh kosong');
        return;
    }

    if (editingNoteId) {
        const note = notes.find(n => n.id === editingNoteId);
        if (note) {
            note.title = title;
            note.content = content;
            note.color = color;
            note.checklist = checklist;
            note.reminder = reminder;
            note.reminderRepeat = reminderRepeat;
            note.labels = selectedLabels;
            note.updatedAt = new Date().toISOString();
        }
        showToast('✅ Catatan diperbarui');
    } else {
        const newNote = {
            id: generateId(),
            title: title || 'Tanpa Judul',
            content,
            color,
            checklist,
            reminder,
            reminderRepeat,
            labels: selectedLabels,
            pinned: false,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        notes.unshift(newNote);
        showToast('✅ Catatan disimpan');
    }

    save();
    renderNotes();
    closeNoteModal();
}

function closeNoteModal() {
    noteModal.classList.remove('active');
    editingNoteId = null;
}

function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        save();
        renderNotes();
        showToast(note.pinned ? '📌 Disematkan' : 'Sematan dilepas');
    }
}

function toggleArchive(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.archived = !note.archived;
        if (note.archived) note.pinned = false;
        save();
        renderNotes();
        showToast(note.archived ? '🗄️ Diarsipkan' : '📤 Dikembalikan');
    }
}

function confirmDelete(id) {
    deleteNoteId = id;
    deleteModal.classList.add('active');
}

function deleteNote() {
    notes = notes.filter(n => n.id !== deleteNoteId);
    save();
    renderNotes();
    deleteModal.classList.remove('active');
    deleteNoteId = null;
    showToast('🗑️ Catatan dihapus');
}

// ===== Checklist =====
function renderChecklistItems(items) {
    const container = $('#checklistItems');
    container.innerHTML = items.map((item, i) => `
        <div class="checklist-item">
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="this.nextElementSibling.classList.toggle('checked', this.checked)">
            <span class="item-text ${item.checked ? 'checked' : ''}">${escapeHtml(item.text)}</span>
            <button class="remove-item" onclick="this.parentElement.remove()">✕</button>
        </div>
    `).join('');
}

function addChecklistItem() {
    const input = $('#checklistInput');
    const text = input.value.trim();
    if (!text) return;

    const item = document.createElement('div');
    item.className = 'checklist-item';
    item.innerHTML = `
        <input type="checkbox" onchange="this.nextElementSibling.classList.toggle('checked', this.checked)">
        <span class="item-text">${escapeHtml(text)}</span>
        <button class="remove-item" onclick="this.parentElement.remove()">✕</button>
    `;
    $('#checklistItems').appendChild(item);
    input.value = '';
    input.focus();
}

// ===== Reminder Check =====
function checkReminders() {
    const now = new Date();
    notes.forEach(note => {
        if (!note.reminder || note.archived) return;
        const reminderTime = new Date(note.reminder);
        const diff = reminderTime - now;

        // Trigger if within 30 seconds window
        if (diff <= 0 && diff > -30000 && !note._notified) {
            note._notified = true;
            showReminderAlert(note);

            // Handle repeat
            if (note.reminderRepeat !== 'none') {
                const next = new Date(reminderTime);
                if (note.reminderRepeat === 'daily') next.setDate(next.getDate() + 1);
                else if (note.reminderRepeat === 'weekly') next.setDate(next.getDate() + 7);
                else if (note.reminderRepeat === 'monthly') next.setMonth(next.getMonth() + 1);
                note.reminder = next.toISOString().slice(0, 16);
                note._notified = false;
                save();
            }
        }

        // Reset notification flag if reminder is in the future
        if (diff > 30000) {
            note._notified = false;
        }
    });
}

function showReminderAlert(note) {
    $('#reminderAlertTitle').textContent = note.title || 'Pengingat!';
    $('#reminderAlertText').textContent = note.content || 'Waktunya sudah tiba!';
    reminderAlert.style.display = 'flex';

    // Vibrate on mobile
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // Browser notification
    if (Notification.permission === 'granted') {
        new Notification('⏰ ' + (note.title || 'Pengingat'), {
            body: note.content || 'Waktunya sudah tiba!',
            badge: 'icons/icon-96.png',
            icon: 'icons/icon-192.png',
            tag: 'reminder-' + note.id,
            renotify: true
        });
    }
}

// ===== Export / Import =====
function exportNotes() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        notes: notes,
        labels: labels
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catatanku-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📤 Data berhasil diekspor');
}

function importNotes(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.notes || !Array.isArray(data.notes)) {
                showToast('⚠️ Format file tidak valid');
                return;
            }

            const importCount = data.notes.length;
            // Merge: add notes that don't exist yet
            const existingIds = new Set(notes.map(n => n.id));
            let newCount = 0;
            data.notes.forEach(n => {
                if (!existingIds.has(n.id)) {
                    notes.push(n);
                    newCount++;
                }
            });

            // Merge labels
            if (data.labels && Array.isArray(data.labels)) {
                const existingLabelIds = new Set(labels.map(l => l.id));
                data.labels.forEach(l => {
                    if (!existingLabelIds.has(l.id)) {
                        labels.push(l);
                    }
                });
            }

            save();
            renderNotes();
            renderLabels();
            showToast(`📥 ${newCount} catatan baru diimpor (dari ${importCount} total)`);
        } catch (err) {
            showToast('⚠️ Gagal membaca file');
        }
    };
    reader.readAsText(file);
}

// ===== PWA: Service Worker Registration =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('[App] Service Worker terdaftar:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated') {
                            showToast('🔄 Aplikasi diperbarui! Refresh untuk melihat perubahan.');
                        }
                    });
                });
            })
            .catch((error) => {
                console.log('[App] Registrasi Service Worker gagal:', error);
            });
    }
}

// ===== PWA: Install Prompt =====
function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        // Show install banner if not dismissed before
        if (!localStorage.getItem('installDismissed')) {
            installBanner.style.display = 'flex';
        }
    });

    // Install button click
    $('#installBtn').addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === 'accepted') {
            showToast('🎉 Aplikasi berhasil diinstall!');
        }
        deferredInstallPrompt = null;
        installBanner.style.display = 'none';
    });

    // Dismiss install banner
    $('#dismissInstall').addEventListener('click', () => {
        installBanner.style.display = 'none';
        localStorage.setItem('installDismissed', 'true');
    });

    // Detect if already installed
    window.addEventListener('appinstalled', () => {
        installBanner.style.display = 'none';
        deferredInstallPrompt = null;
        showToast('🎉 Catatanku berhasil dipasang!');
    });
}

// ===== PWA: Online/Offline Detection =====
function setupNetworkDetection() {
    function updateOnlineStatus() {
        if (!navigator.onLine) {
            offlineBanner.style.display = 'block';
        } else {
            offlineBanner.style.display = 'none';
        }
    }

    window.addEventListener('online', () => {
        offlineBanner.style.display = 'none';
        showToast('🌐 Kembali online');
    });

    window.addEventListener('offline', () => {
        offlineBanner.style.display = 'block';
        showToast('📴 Mode offline — data tetap tersimpan');
    });

    updateOnlineStatus();
}

// ===== Navigation =====
function updatePageTitle() {
    const titles = {
        all: 'Semua Catatan',
        reminder: 'Pengingat',
        pinned: 'Disematkan',
        archived: 'Arsip'
    };
    $('#pageTitle').textContent = titles[currentFilter] || 'Semua Catatan';
}

// ===== Sidebar Mobile =====
function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// ===== Handle URL params (shortcut support) =====
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
        setTimeout(() => openNewNote(), 500);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker
    registerServiceWorker();

    // Setup PWA features
    setupInstallPrompt();
    setupNetworkDetection();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        // Delay to not be annoying on first load
        setTimeout(() => {
            Notification.requestPermission();
        }, 5000);
    }

    // Initial render
    renderNotes();
    renderLabels();
    updateStorageInfo();

    // Handle URL params
    handleUrlParams();

    // Check reminders every 10 seconds
    setInterval(checkReminders, 10000);
    checkReminders();

    // Navigation
    $$('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentLabelFilter = null;
            renderLabels();
            updatePageTitle();
            renderNotes();
            closeSidebar();
        });
    });

    // FAB
    $('#fabAdd').addEventListener('click', openNewNote);

    // Modal controls
    $('#closeModal').addEventListener('click', closeNoteModal);
    $('#cancelNote').addEventListener('click', closeNoteModal);
    $('#saveNote').addEventListener('click', saveNote);

    // Click outside modal
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) closeNoteModal();
    });

    // Checklist toggle
    $('#enableChecklist').addEventListener('change', (e) => {
        $('#checklistContainer').style.display = e.target.checked ? 'block' : 'none';
    });

    $('#addChecklistItem').addEventListener('click', addChecklistItem);
    $('#checklistInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addChecklistItem();
    });

    // Reminder toggle
    $('#enableReminder').addEventListener('change', (e) => {
        $('#reminderFields').style.display = e.target.checked ? 'flex' : 'none';
        if (e.target.checked) {
            const d = new Date();
            d.setHours(d.getHours() + 1);
            d.setMinutes(0);
            $('#reminderDate').value = d.toISOString().slice(0, 16);
        }
    });

    // Color picker
    $$('#colorOptions .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            $$('#colorOptions .color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
    });

    // Search
    searchInput.addEventListener('input', () => {
        renderNotes();
    });

    // Sort
    sortSelect.addEventListener('change', () => {
        renderNotes();
    });

    // View toggle
    $('#toggleView').addEventListener('click', () => {
        currentView = currentView === 'grid' ? 'list' : 'grid';
        notesGrid.classList.toggle('list-view', currentView === 'list');
        $('#viewIcon').textContent = currentView === 'grid' ? '▦' : '▤';
    });

    // Sidebar toggle (mobile)
    $('#openSidebar').addEventListener('click', openSidebar);
    $('#closeSidebar').addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Label modal
    $('#addLabelBtn').addEventListener('click', () => {
        $('#labelName').value = '';
        $$('#labelColorOptions .color-dot').forEach(d => d.classList.remove('active'));
        $('#labelColorOptions .color-dot').classList.add('active');
        labelModal.classList.add('active');
    });

    $$('.close-label-modal').forEach(btn => {
        btn.addEventListener('click', () => labelModal.classList.remove('active'));
    });

    labelModal.addEventListener('click', (e) => {
        if (e.target === labelModal) labelModal.classList.remove('active');
    });

    $$('#labelColorOptions .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            $$('#labelColorOptions .color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
    });

    $('#saveLabel').addEventListener('click', () => {
        const name = $('#labelName').value.trim();
        const color = $('#labelColorOptions .color-dot.active')?.dataset.color || '#ef5350';
        if (!name) {
            showToast('⚠️ Nama label tidak boleh kosong');
            return;
        }
        labels.push({ id: generateId(), name, color });
        save();
        renderLabels();
        labelModal.classList.remove('active');
        showToast('✅ Label ditambahkan');
    });

    // Delete modal
    $$('.close-delete-modal').forEach(btn => {
        btn.addEventListener('click', () => deleteModal.classList.remove('active'));
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) deleteModal.classList.remove('active');
    });

    $('#confirmDelete').addEventListener('click', deleteNote);

    // Reminder alert dismiss
    $('#dismissReminder').addEventListener('click', () => {
        reminderAlert.style.display = 'none';
    });

    // Export / Import
    $('#exportBtn').addEventListener('click', () => {
        exportNotes();
        closeSidebar();
    });

    const importFile = $('#importFile');
    $('#importBtn').addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importNotes(e.target.files[0]);
            e.target.value = '';
            closeSidebar();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (noteModal.classList.contains('active')) closeNoteModal();
            if (labelModal.classList.contains('active')) labelModal.classList.remove('active');
            if (deleteModal.classList.contains('active')) deleteModal.classList.remove('active');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openNewNote();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !noteModal.classList.contains('active')) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // Ctrl+Enter to save in modal
    noteModal.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveNote();
        }
    });

    // Prevent double-tap zoom on buttons (mobile)
    document.addEventListener('touchend', (e) => {
        if (e.target.closest('button, .btn, .nav-item, .label-item, .color-dot, .label-chip')) {
            e.preventDefault();
            e.target.click();
        }
    }, { passive: false });
});

// Make functions available globally for onclick handlers
window.openEditNote = openEditNote;
window.togglePin = togglePin;
window.toggleArchive = toggleArchive;
window.confirmDelete = confirmDelete;
window.filterByLabel = filterByLabel;
window.deleteLabel = deleteLabel;
window.toggleLabelSelection = toggleLabelSelection;
