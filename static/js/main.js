function setupMenu(buttonId, menuId) {
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    if (button && menu) {
        button.addEventListener('click', (e) => {
            // Prevent the tab's default navigation if it has an href
            if (button.hasAttribute('href')) {
                e.preventDefault();
            }
            menu.open = !menu.open;
        });
    }
}

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

    // The 'my-chores-tab' opens a menu instead of navigating
    const myChoresTab = document.getElementById('my-chores-tab');
    const myChoresMenu = document.getElementById('my-chores-menu');
    if (myChoresTab && myChoresMenu) {
        myChoresTab.addEventListener('click', (e) => {
            e.preventDefault();
            myChoresMenu.open = !myChoresMenu.open;
        });
    }

    // Since tabs with hrefs navigate, we need to prevent that default
    // action for the tab that opens a menu.
    tabs.addEventListener('change', (e) => {
        const tab = e.target.tabs[e.target.activeTabIndex];
        if (tab.id === 'my-chores-tab') {
             // This event is not cancellable, so the menu logic is handled above.
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

async function loadChoreDetails(choreId) {
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

async function handleAction(url, method, element) {
    try {
        const response = await fetch(url, { method });
        if (response.ok) {
            const container = element.closest('.swipe-container');
            container.style.transition = 'opacity 300ms ease-out, height 300ms ease-out';
            container.style.opacity = '0';
            container.style.height = '0';
            container.addEventListener('transitionend', () => {
                container.remove();
            });
        } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
            element.style.transform = '';
        }
    } catch (err) {
        console.error(`Failed to perform action:`, err);
        alert('An error occurred. Please try again.');
        element.style.transform = '';
    }
}

function setupSwipeActions() {
    document.querySelectorAll('.chore-item').forEach(item => {
        const container = item.closest('.swipe-container');
        if (!container) return;

        const bg = container.querySelector('.swipe-background');
        const completeAction = bg.querySelector('.action-complete');
        const priorityAction = bg.querySelector('.action-priority');

        let touchstartX = 0, touchstartY = 0, touchmoveX = 0, touchmoveY = 0, deltaX = 0, deltaY = 0, isSwiping = false;
        const tapThreshold = 5;
        const swipeThreshold = 80;

        item.addEventListener('touchstart', e => {
            if (e.target.closest('md-icon-button, a, button')) return;

            touchstartX = e.changedTouches[0].screenX;
            touchstartY = e.changedTouches[0].screenY;
            isSwiping = true;
            item.classList.add('swiping');
            document.body.classList.add('swiping-in-progress');
        }, { passive: true });

        item.addEventListener('touchmove', e => {
            if (!isSwiping) return;

            deltaX = e.changedTouches[0].screenX - touchstartX;
            deltaY = e.changedTouches[0].screenY - touchstartY;

            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                isSwiping = false;
                return;
            }

            e.preventDefault();
            item.style.transform = `translateX(${deltaX}px)`;

            const opacity = Math.min(Math.abs(deltaX) / swipeThreshold, 1);
            if (deltaX > 0) {
                completeAction.style.opacity = opacity;
                priorityAction.style.opacity = 0;
            } else {
                priorityAction.style.opacity = opacity;
                completeAction.style.opacity = 0;
            }
        }, { passive: false });

        item.addEventListener('touchend', e => {
            if (!isSwiping) return;
            isSwiping = false;
            item.classList.remove('swiping');

            if (Math.abs(deltaX) > swipeThreshold) {
                const choreId = item.dataset.choreId;
                const url = deltaX > 0 ? `/api/chores/${choreId}/complete` : `/api/chores/${choreId}/toggle-priority`;
                handleAction(url, 'POST', item);
            } else if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold) {
                loadChoreDetails(item.dataset.choreId);
                item.style.transform = '';
            } else {
                item.style.transform = '';
            }

            completeAction.style.opacity = 0;
            priorityAction.style.opacity = 0;

            setTimeout(() => {
                document.body.classList.remove('swiping-in-progress');
            }, 300);

            deltaX = 0;
            deltaY = 0;
        });
    });
}


// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Setup menus
    setupMenu('more-actions-button', 'more-actions-menu');

    // Setup tabs and tab-based menus
    setupTabs();

    // Setup dialogs
    setupDialog('add-chore-dialog',
        ['add-chore-menu-item'],
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
                const choreItem = document.querySelector(`.chore-item[data-chore-id='${choreId}']`);
                await handleAction(`/api/chores/${choreId}`, 'DELETE', choreItem);
            }
        });
    }

    // --- Email Chores Button ---
    const emailChoresBtn = document.getElementById('email-chores-menu-item');
    if (emailChoresBtn) {
        emailChoresBtn.addEventListener('click', async (e) => {
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
