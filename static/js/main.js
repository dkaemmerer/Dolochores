async function openChoreDetail(event) {
    const choreRow = event.currentTarget.closest('.chore-row');
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
        const modalElement = document.getElementById('chore-detail-modal');
        const instance = M.Modal.getInstance(modalElement);
        instance.open();
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
