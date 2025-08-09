// Modal toggling function
function toggleModal(event) {
    event.preventDefault();
    const modal = document.getElementById(event.currentTarget.dataset.target);
    if (modal) {
        modal.open ? modal.close() : modal.showModal();
    }
}

async function openChoreDetail(event) {
    const choreRow = event.currentTarget;
    const choreId = choreRow.dataset.choreId;

    try {
        const response = await fetch(`/api/chores/${choreId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch chore details');
        }
        const chore = await response.json();

        // Populate modal
        document.getElementById('chore-detail-title').textContent = chore.title;
        const content = document.getElementById('chore-detail-content');
        content.innerHTML = `
            <p><strong>Assignee:</strong> ${chore.assignee}</p>
            <p><strong>Category:</strong> ${chore.category || 'N/A'}</p>
            <p><strong>Status:</strong> <span class="status-${chore.status.toLowerCase().replace(' ', '-')}">${chore.status}</span></p>
            <p><strong>Next Due:</strong> ${chore.next_due ? new Date(chore.next_due).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Frequency:</strong> Every ${chore.frequency} days</p>
            <p><strong>Last Completed:</strong> ${new Date(chore.last_completed).toLocaleDateString()}</p>
            ${chore.notes ? `<blockquote>${chore.notes}</blockquote>` : ''}
        `;

        // Set up delete button
        const deleteBtn = document.getElementById('chore-detail-delete-btn');
        deleteBtn.dataset.choreId = choreId;

        // Open modal
        toggleModal({ preventDefault: () => {}, currentTarget: { dataset: { target: 'chore-detail-modal' } } });
    } catch (err) {
        console.error('Error opening chore detail:', err);
        alert('Failed to load chore details. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- Add Chore Form ---
    const addChoreForm = document.getElementById('add-chore-form');
    if (addChoreForm) {
        addChoreForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addChoreForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/chores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    location.reload(); // Simple reload for now
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

    // --- Swipe Actions for Chore Rows ---
    document.querySelectorAll('.chore-row').forEach(row => {
        const fg = row.querySelector('.chore-row-fg');
        const bg = row.querySelector('.chore-row-bg');
        const rightIcon = bg.querySelector('.swipe-right-icon');
        const leftIcon = bg.querySelector('.swipe-left-icon');

        let touchstartX = 0;
        let touchmoveX = 0;
        let deltaX = 0;
        let isSwiping = false;
        const swipeThreshold = 80;

        row.addEventListener('touchstart', e => {
            // Don't swipe if clicking on a button/link inside
            if (e.target.closest('a, button')) return;
            touchstartX = e.changedTouches[0].screenX;
            isSwiping = true;
            fg.classList.add('swiping');
            // Also prevent the detail view from opening
            row.style.pointerEvents = 'none';
        }, { passive: true });

        row.addEventListener('touchmove', e => {
            if (!isSwiping) return;
            touchmoveX = e.changedTouches[0].screenX;
            deltaX = touchmoveX - touchstartX;

            fg.style.transform = `translateX(${deltaX}px)`;

            // Reveal icons and change background color
            if (deltaX > 0) { // Swiping right
                bg.style.backgroundColor = 'var(--pico-color-green-550)';
                rightIcon.style.opacity = Math.min(deltaX / swipeThreshold, 1);
                leftIcon.style.opacity = 0;
            } else { // Swiping left
                bg.style.backgroundColor = 'var(--pico-color-amber-550)';
                leftIcon.style.opacity = Math.min(Math.abs(deltaX) / swipeThreshold, 1);
                rightIcon.style.opacity = 0;
            }

        }, { passive: true });

        row.addEventListener('touchend', e => {
            if (!isSwiping) return;
            isSwiping = false;
            fg.classList.remove('swiping');

            if (Math.abs(deltaX) > swipeThreshold) {
                handleSwipeAction(row, deltaX);
            } else {
                // Snap back
                fg.classList.add('snap-back');
                fg.style.transform = '';
                bg.style.backgroundColor = '';
                rightIcon.style.opacity = 0;
                leftIcon.style.opacity = 0;
                // Allow clicks again
                row.style.pointerEvents = 'auto';
            }

            deltaX = 0; // Reset delta

            setTimeout(() => {
                fg.classList.remove('snap-back');
            }, 300);
        });
    });

    function handleSwipeAction(row, deltaX) {
        const choreId = row.dataset.choreId;
        const swipeThreshold = 80;

        if (Math.abs(deltaX) > swipeThreshold) {
            if (deltaX > 0) {
                handleAction(`/api/chores/${choreId}/complete`, 'POST', 'Chore marked as complete.');
            } else {
                handleAction(`/api/chores/${choreId}/toggle-priority`, 'POST', 'Priority toggled.');
            }
        }
    }

    const deleteBtn = document.getElementById('chore-detail-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const choreId = e.currentTarget.dataset.choreId;
            if (choreId && confirm('Are you sure you want to delete this chore?')) {
                await handleAction(`/api/chores/${choreId}`, 'DELETE', 'Chore deleted.');
            }
        });
    }

    const emailChoresBtn = document.getElementById('email-chores-btn');
    if (emailChoresBtn) {
        emailChoresBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            emailChoresBtn.innerHTML = '<i>Sending...</i>';
            emailChoresBtn.setAttribute('aria-busy', 'true');

            try {
                const response = await fetch('/api/email-chores', { method: 'POST' });
                const result = await response.json();
                alert(result.message);
            } catch (err) {
                console.error('Failed to send email:', err);
                alert('An error occurred while sending the email.');
            } finally {
                emailChoresBtn.textContent = 'Email Chores List';
                emailChoresBtn.removeAttribute('aria-busy');
            }
        });
    }

    async function handleAction(url, method, successMessage) {
        try {
            const response = await fetch(url, { method });
            if (response.ok) {
                // For a better UX, you could update the DOM directly instead of reloading.
                // But for simplicity, reload is fine.
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

});
