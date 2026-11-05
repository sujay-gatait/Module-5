// ==================== DASHBOARD & SECURE ROUTE RENDERING ====================
async function renderDashboard() {
    // 1. Check local session state
    if (!currentUser || !token) {
        showToast('Please log in to access your dashboard.');
        window.location.hash = '#login';
        return;
    }

    try {
        // 2. Fetch ONLY the logged-in user's posts securely from backend
        const res = await fetch(`${API_BASE_URL}/posts/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Unauthorized or session expired');
        const userPosts = await res.json();

        // 3. Update dashboard analytics counters
        document.getElementById('statTotalPosts').textContent = userPosts.length;
        document.getElementById('statTotalViews').textContent = userPosts.reduce((acc, p) => acc + (p.views || 0), 0);
        document.getElementById('statTotalLikes').textContent = userPosts.reduce((acc, p) => acc + (p.likes || 0), 0);

        // 4. Populate table with user's blogs
        const tbody = document.getElementById('dashboardTableBody');
        if (userPosts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 25px;">You haven't published any articles yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = userPosts.map(post => `
            <tr>
                <td><strong>${post.title}</strong></td>
                <td><span class="card-badge">${post.category}</span></td>
                <td>${post.date}</td>
                <td><span style="color: green; font-weight: 500;">Published</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editPost('${post._id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deletePost('${post._id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        showToast('Session expired. Please log in again.');
        logoutBtn.click();
    }
}