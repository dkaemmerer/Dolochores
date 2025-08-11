function setupMenu(buttonId, menuId) {
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    if (button && menu) {
        button.addEventListener('click', () => {
            menu.open = !menu.open;
        });
    }
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

async function loadChoreDetails(choreId) {
    // Prevent loading details if a swipe is in progress
    if (document.body.classList.contains('swiping-in-progress')) return;

    try {
        const response = await fetch(`/api/chores/${choreId}`);
        if (!response.ok) throw new Error('Failed to fetch chore details');
        const chore = await response.json();

        const dialog = document.getElementById('chore-detail-dialog');
        const titleEl = document.getElementById('chore-detail-title');
        const contentEl = document.getElementById('chore-detail-content');
        const deleteBtn = document.getElementById('chore-detail-delete-btn');

        if (!dialog || !titleEl || !contentEl || !deleteBtn) return;

        titleEl.textContent = chore.title;
        contentEl.innerHTML = `
            <p><strong>Assignee:</strong> ${chore.assignee}</p>
            <p><strong>Category:</strong> ${chore.category || 'N/A'}</p>
            <p><strong>Status:</strong> ${chore.status}</p>
            <p><strong>Next Due:</strong> ${chore.next_due ? new Date(chore.next_due).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Frequency:</strong> Every ${chore.frequency} days</p>
            <p><strong>Last Completed:</strong> ${chore.last_completed ? new Date(chore.last_completed).toLocaleDateString() : 'N/A'}</p>
            ${chore.notes ? `<p><strong>Notes:</strong><br>${chore.notes}</p>` : ''}
        `;
        deleteBtn.dataset.choreId = choreId;

        dialog.show();

    } catch (err) {
        console.error('Error loading chore details:', err);
        alert('Could not load chore details.');
    }
}

async function handleAction(url, method) {
    try {
        const response = await fetch(url, { method });
        if (response.ok) {
            location.reload();
        } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
        }
    } catch (err) {
        console.error(`Failed to perform action:`, err);
        alert('An error occurred. Please try again.');
    }
}

function setupSwipeActions() {
    document.querySelectorAll('.chore-item').forEach(item => {
        const container = item.closest('.swipe-container');
        if (!container) return;

        const bg = container.querySelector('.swipe-background');
        const completeAction = bg.querySelector('.action-complete');
        const priorityAction = bg.querySelector('.action-priority');

        let touchstartX = 0;
        let touchmoveX = 0;
        let deltaX = 0;
        let isSwiping = false;
        const swipeThreshold = 80; // pixels

        item.addEventListener('touchstart', e => {
            // Don't swipe if clicking an interactive element inside the item
            if (e.target.closest('md-icon-button, a, button')) return;

            touchstartX = e.changedTouches[0].screenX;
            isSwiping = true;
            item.classList.add('swiping');
            document.body.classList.add('swiping-in-progress'); // Prevent clicks
        }, { passive: true });

        item.addEventListener('touchmove', e => {
            if (!isSwiping) return;

            touchmoveX = e.changedTouches[0].screenX;
            deltaX = touchmoveX - touchstartX;

            // Allow vertical scroll if swipe is mostly vertical
            if (Math.abs(e.changedTouches[0].screenY - e.target.getBoundingClientRect().top) > Math.abs(deltaX)) {
                return;
            }

            item.style.transform = `translateX(${deltaX}px)`;

            if (deltaX > 0) { // Swiping right (complete)
                priorityAction.style.display = 'none';
                completeAction.style.display = 'flex';
                const opacity = Math.min(Math.abs(deltaX) / swipeThreshold, 1);
                completeAction.style.opacity = opacity;
            } else { // Swiping left (priority)
                completeAction.style.display = 'none';
                priorityAction.style.display = 'flex';
                const opacity = Math.min(Math.abs(deltaX) / swipeThreshold, 1);
                priorityAction.style.opacity = opacity;
            }
        }, { passive: true });

        item.addEventListener('touchend', e => {
            if (!isSwiping) return;
            isSwiping = false;

            item.classList.remove('swiping');
            item.classList.add('snap-back');

            if (Math.abs(deltaX) > swipeThreshold) {
                const choreId = item.dataset.choreId;
                const url = deltaX > 0
                    ? `/api/chores/${choreId}/complete`
                    : `/api/chores/${choreId}/toggle-priority`;

                // Animate out
                item.style.transform = `translateX(${Math.sign(deltaX) * 100}vw)`;
                item.addEventListener('transitionend', () => {
                    handleAction(url, 'POST');
                }, { once: true });

            } else {
                item.style.transform = '';
            }

            setTimeout(() => {
                if (item) item.classList.remove('snap-back');
                document.body.classList.remove('swiping-in-progress');
            }, 300);

            deltaX = 0;
        });
    });
}


// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Setup menus
    setupMenu('my-chores-button', 'my-chores-menu');
    setupMenu('more-actions-button', 'more-actions-menu');

    // Setup dialogs
    setupDialog('add-chore-dialog',
        ['add-chore-menu-item', 'add-chore-menu-item-mobile'],
        ['add-chore-cancel-btn']
    );
    setupDialog('chore-detail-dialog', [], ['chore-detail-close-btn']);

    // Setup swipe actions
    setupSwipeActions();

    // --- Add Chore Form ---
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

    // --- Chore Detail Delete Button ---
    const deleteBtn = document.getElementById('chore-detail-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            const choreId = e.currentTarget.dataset.choreId;
            if (choreId && confirm('Are you sure you want to delete this chore?')) {
                await handleAction(`/api/chores/${choreId}`, 'DELETE');
            }
        });
    }

    // --- Email Chores Button ---
    const emailChoresDesktop = document.getElementById('email-chores-menu-item-desktop');
    const emailChoresMobile = document.getElementById('email-chores-menu-item-mobile');

    const emailHandler = async (e) => {
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
    };

    if (emailChoresDesktop) emailChoresDesktop.addEventListener('click', emailHandler);
    if (emailChoresMobile) emailChoresMobile.addEventListener('click', emailHandler);
});
