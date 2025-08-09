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

    // --- Chore Actions ---
    const choreList = document.querySelector('.chores-list');
    if (choreList) {
        choreList.addEventListener('click', async (e) => {
            const target = e.target;
            const choreCard = target.closest('.chore-card');
            if (!choreCard) return;

            const choreId = choreCard.dataset.choreId;

            // Complete Chore
            if (target.classList.contains('complete-btn')) {
                await handleAction(`/api/chores/${choreId}/complete`, 'POST', 'Chore marked as complete.');
            }

            // Toggle Priority
            if (target.classList.contains('priority-btn')) {
                await handleAction(`/api/chores/${choreId}/toggle-priority`, 'POST', 'Priority toggled.');
            }

            // Delete Chore
            if (target.classList.contains('delete-btn')) {
                if (confirm('Are you sure you want to delete this chore?')) {
                    await handleAction(`/api/chores/${choreId}`, 'DELETE', 'Chore deleted.');
                }
            }

            // Undo Complete
            if (target.classList.contains('undo-btn')) {
                await handleAction(`/api/chores/${choreId}/undo`, 'POST', 'Completion undone.');
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
