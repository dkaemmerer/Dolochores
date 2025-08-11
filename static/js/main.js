function setupTabs() {
    const tabs = document.getElementById('main-tabs');
    if (!tabs) return;

    const currentPath = window.location.pathname;
    if (currentPath === '/') {
        tabs.activeTabIndex = 0;
    } else if (currentPath.includes('/priorities')) {
        tabs.activeTabIndex = 1;
    } else if (currentPath.includes('/my-chores')) {
        tabs.activeTabIndex = 2;
    }

    const myChoresTab = document.getElementById('my-chores-tab');
    const myChoresMenu = document.getElementById('my-chores-menu');
    if (myChoresTab && myChoresMenu) {
        myChoresTab.addEventListener('click', (e) => {
            e.preventDefault();
            myChoresMenu.open = !myChoresMenu.open;
        });
    }

    tabs.addEventListener('change', (e) => {
        const tab = e.target.tabs[e.target.activeTabIndex];
        if (tab.id === 'my-chores-tab') {
            // Logic is handled in the click listener above to open the menu
        } else if (tab.hasAttribute('href')) {
            window.location.href = tab.getAttribute('href');
        }
    });
}

function setupDialog(dialogId, openTriggerIds = [], closeTriggerIds = []) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;

    openTriggerIds.forEach(id => {
        const trigger = document.getElementById(id);
        if (trigger) {
            trigger.addEventListener('click', () => {
                dialog.show();
            });
        }
    });

    closeTriggerIds.forEach(id => {
        const trigger = document.getElementById(id);
        if (trigger) {
            trigger.addEventListener('click', () => {
                dialog.close();
            });
        }
    });
}

// --- Chore Detail Dialog Logic ---

let currentChoreData = {};
let isEditMode = false;

function populateReadOnlyView(chore) {
    const contentEl = document.getElementById('chore-detail-readonly-view');
    contentEl.innerHTML = `
        <p><strong>Assignee:</strong> ${chore.assignee}</p>
        <p><strong>Category:</strong> ${chore.category || 'N/A'}</p>
        <p><strong>Status:</strong> ${chore.status}</p>
        <p><strong>Next Due:</strong> ${chore.next_due ? new Date(chore.next_due).toLocaleDateString() : 'N/A'}</p>
        <p><strong>Frequency:</strong> Every ${chore.frequency} days</p>
        <p><strong>Last Completed:</strong> ${chore.last_completed ? new Date(chore.last_completed).toLocaleDateString() : 'N/A'}</p>
        ${chore.notes ? `<p><strong>Notes:</strong><br>${chore.notes}</p>` : ''}
    `;
}

function populateEditForm(chore) {
    const form = document.getElementById('chore-edit-form');
    form.querySelector('[name="chore_id"]').value = chore.id;
    form.querySelector('[name="title"]').value = chore.title;
    form.querySelector('[name="user_id"]').value = chore.user_id;
    form.querySelector('[name="category"]').value = chore.category;
    form.querySelector('[name="frequency"]').value = chore.frequency;
    form.querySelector('[name="last_completed"]').value = chore.last_completed;
    form.querySelector('[name="notes"]').value = chore.notes;
    form.querySelector('[name="is_priority"]').checked = chore.is_priority;
}

function setDialogMode(edit = false) {
    isEditMode = edit;
    const readOnlyView = document.getElementById('chore-detail-readonly-view');
    const editForm = document.getElementById('chore-edit-form');
    const editBtn = document.getElementById('chore-detail-edit-btn');
    const saveBtn = document.getElementById('chore-detail-save-btn');
    const deleteBtn = document.getElementById('chore-detail-delete-btn');

    readOnlyView.style.display = edit ? 'none' : 'block';
    editForm.style.display = edit ? 'flex' : 'none';
    editBtn.style.display = edit ? 'none' : 'inline-flex';
    saveBtn.style.display = edit ? 'inline-flex' : 'none';
    deleteBtn.style.display = edit ? 'none' : 'inline-flex'; // Hide delete in edit mode
}

async function loadChoreDetails(choreId) {
    try {
        const response = await fetch(`/api/chores/${choreId}`);
        if (!response.ok) throw new Error('Failed to fetch chore details');
        currentChoreData = await response.json();

        const dialog = document.getElementById('chore-detail-dialog');
        const titleEl = document.getElementById('chore-detail-title');

        titleEl.textContent = currentChoreData.title;
        populateReadOnlyView(currentChoreData);
        populateEditForm(currentChoreData);

        setDialogMode(false); // Start in read-only mode
        dialog.show();

    } catch (err) {
        console.error('Error loading chore details:', err);
        alert('Could not load chore details.');
    }
}

// --- Swipe and Action Logic ---

async function handleSwipeAction(action, choreId, element) {
    const url = `/api/chores/${choreId}/${action}`;

    try {
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'An error occurred.');
        }

        const choreRow = element.closest('.chore-list-row');

        if (action === 'complete') {
            choreRow.style.transition = 'opacity 300ms ease-out';
            choreRow.style.opacity = '0';
            choreRow.addEventListener('transitionend', () => {
                const list = choreRow.parentElement;
                element.style.transform = '';
                updateChoreRow(choreRow, data);
                list.appendChild(choreRow);
                choreRow.style.opacity = '1';
            }, { once: true });
        } else if (action === 'toggle-priority') {
            updateChoreRow(choreRow, data);
            element.style.transform = '';
        }

    } catch (err) {
        console.error(`Failed to perform action '${action}':`, err);
        alert(err.message);
        element.style.transform = '';
    }
}

function updateChoreRow(choreRow, choreData) {
    const supportText = choreRow.querySelector('[slot="supporting-text"]');
    if (supportText) {
        const nextDue = choreData.next_due ? new Date(choreData.next_due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
        supportText.textContent = `${choreData.assignee} • Due: ${nextDue}`;
    }

    const statusBadge = choreRow.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.className = `status-badge status-${choreData.status.toLowerCase().replace(' ', '-')}`;
        statusBadge.textContent = choreData.status;
    }

    const iconSlot = choreRow.querySelector('[slot="start"]');
    if (choreData.is_priority) {
        if (!iconSlot) {
            const newIcon = document.createElement('md-icon');
            newIcon.slot = 'start';
            newIcon.textContent = 'star';
            choreRow.querySelector('.chore-item').prepend(newIcon);
        } else {
            iconSlot.textContent = 'star';
        }
    } else {
        if (iconSlot) {
            iconSlot.remove();
        }
    }
}

function setupClickAndSwipe() {
    document.querySelectorAll('.chore-list-row').forEach(row => {
        const item = row.querySelector('.chore-item');
        if (!item) return;

        let wasSwiped = false;
        const swipeThreshold = 80;
        let touchstartX = 0;
        let deltaX = 0;

        row.addEventListener('touchstart', e => {
            wasSwiped = false;
            deltaX = 0;
            touchstartX = e.changedTouches[0].screenX;
            item.classList.add('swiping');
        }, { passive: true });

        row.addEventListener('touchmove', e => {
            deltaX = e.changedTouches[0].screenX - touchstartX;
            if (Math.abs(deltaX) > 10) {
                wasSwiped = true;
                e.preventDefault();
                item.style.transform = `translateX(${deltaX}px)`;

                const bg = row.querySelector('.swipe-background');
                const completeAction = bg.querySelector('.action-complete');
                const priorityAction = bg.querySelector('.action-priority');
                const opacity = Math.min(Math.abs(deltaX) / swipeThreshold, 1);
                if (deltaX > 0) {
                    completeAction.style.opacity = opacity;
                    priorityAction.style.opacity = 0;
                } else {
                    priorityAction.style.opacity = opacity;
                    completeAction.style.opacity = 0;
                }
            }
        }, { passive: false });

        row.addEventListener('touchend', e => {
            item.classList.remove('swiping');
            if (Math.abs(deltaX) > swipeThreshold) {
                const choreId = row.dataset.choreId;
                const action = deltaX > 0 ? 'complete' : 'toggle-priority';
                handleSwipeAction(action, choreId, item);
            } else {
                item.style.transform = '';
            }
            const bg = row.querySelector('.swipe-background');
            bg.querySelector('.action-complete').style.opacity = 0;
            bg.querySelector('.action-priority').style.opacity = 0;
        });

        row.addEventListener('click', e => {
            if (wasSwiped) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const choreId = row.dataset.choreId;
            loadChoreDetails(choreId);
        });
    });
}

function setupSearch() {
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
        const searchField = searchForm.querySelector('md-outlined-text-field');
        if (searchField) {
            searchField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    searchForm.submit();
                }
            });
        }
    }
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupSearch();

    setupDialog('add-chore-dialog',
        ['add-chore-button'],
        ['add-chore-cancel-btn']
    );
    // Detail dialog is opened via loadChoreDetails, but closed here
    setupDialog('chore-detail-dialog', [], ['chore-detail-close-icon-btn']);

    setupClickAndSwipe();

    // --- Edit/Save Chore Logic ---
    const editBtn = document.getElementById('chore-detail-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => setDialogMode(true));
    }

    const editForm = document.getElementById('chore-edit-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editForm);
            const choreId = formData.get('chore_id');
            // 'is_priority' is only present if checked, so handle that
            const data = {
                ...Object.fromEntries(formData.entries()),
                is_priority: formData.has('is_priority')
            };

            try {
                const response = await fetch(`/api/chores/${choreId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (response.ok) {
                    document.getElementById('chore-detail-dialog').close();
                    location.reload(); // Reload to see changes reflected everywhere
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error('Failed to edit chore:', err);
                alert('An error occurred while saving.');
            }
        });
    }


    const addChoreForm = document.getElementById('add-chore-form');
    if (addChoreForm) {
        addChoreForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dialog = document.getElementById('add-chore-dialog');
            const formData = new FormData(addChoreForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/chores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    dialog.close();
                    location.reload();
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.message}`);
                }
            } catch (err) {
                console.error('Failed to add chore:', err);
                alert('An error occurred. Please try again.');
            }
        });
    }

    const deleteBtn = document.getElementById('chore-detail-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            const choreId = currentChoreData.id;
            if (choreId && confirm('Are you sure you want to delete this chore?')) {
                const choreRow = document.querySelector(`.chore-list-row[data-chore-id='${choreId}']`);
                try {
                    const response = await fetch(`/api/chores/${choreId}`, { method: 'DELETE' });
                    if (response.ok) {
                        document.getElementById('chore-detail-dialog').close();
                        choreRow.style.transition = 'opacity 300ms ease-out';
                        choreRow.style.opacity = '0';
                        choreRow.addEventListener('transitionend', () => choreRow.remove(), { once: true });
                    } else {
                        const error = await response.json();
                        alert(`Error: ${error.message}`);
                    }
                } catch (err) {
                    console.error('Failed to delete chore:', err);
                    alert('An error occurred.');
                }
            }
        });
    }

    const emailBtn = document.getElementById('email-button');
    if (emailBtn) {
        emailBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            alert('Sending email...');
            try {
                const response = await fetch('/api/email-chores', { method: 'POST' });
                const result = await response.json();
                alert(result.message);
            } catch (err) {
                console.error('Failed to send email:', err);
                alert('An error occurred while sending the email.');
            }
        });
    }
});
