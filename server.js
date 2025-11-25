// --- Global State & Configuration ---
// Note: This API_BASE configuration is for a typical setup where the frontend
// is served from the root and API calls go to the same origin's /api endpoint.
const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000/api' : '/api';
const ALLOWED_DOMAIN = '@gmail.com';

// Simple state store using localStorage
const store = {
    get user() { return JSON.parse(localStorage.getItem('hub_user') || 'null') },
    set user(v) { localStorage.setItem('hub_user', JSON.stringify(v)) },
    // Using this as a local cache. This will be overwritten by API data on load.
    get listings() { return JSON.parse(localStorage.getItem('hub_listings') || '[]') },
    set listings(v) { localStorage.setItem('hub_listings', JSON.stringify(v)) },
    currentView: 'home',
    activeListing: null
}

const qs = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

// --- Utility Functions ---
function openModal(m){ m.style.display='flex' }
function closeModal(m){ m.style.display='none' }
function escapeHtml(s){ return (s+"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])) }

function showMessage(msg, type = 'info') {
    // In a real app, this should be a custom modal or toast notification
    console.log(`${type.toUpperCase()}: ${msg}`);
    alert(`${type.toUpperCase()}: ${msg}`);
}

// --- API Calls (Backend Interaction) ---
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                // Authorization is typically handled by Firebase/Auth tokens,
                // but this simple demo doesn't enforce it yet on the backend routes.
                ...(store.user && { 'Authorization': `Bearer ${store.user.token}` })
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API Request Failed');
        }
        return data;
    } catch (error) {
        showMessage(`API Error: ${error.message}`, 'error');
        return null;
    }
}

// --- View/Page Switching ---
const viewMap = {
    'home': qs('#homeView'),
    'listings': qs('#listingsView'),
    'my-listings': qs('#myListingsView'),
    'add-listing': qs('#addListingView')
};

function setView(viewName) {
    if (!viewMap[viewName]) return;
    
    // Update global state
    store.currentView = viewName;

    // Hide all views
    Object.values(viewMap).forEach(el => el.classList.add('hidden'));
    
    // Show target view
    viewMap[viewName].classList.remove('hidden');

    // Update active navigation link
    qs('.nav-link.active')?.classList.remove('active');
    qs(`[data-view="${viewName}"]`)?.classList.add('active');

    // Re-render data for the new view
    if (viewName === 'listings') {
        loadAndRenderListings();
    } else if (viewName === 'my-listings') {
        renderMyListings();
    } else if (viewName === 'home') {
        updateHomeStats();
    }
}

// Attach event listeners to navigation links (after DOM is loaded)
document.addEventListener('DOMContentLoaded', () => {
    qsa('#navLinks .nav-link').forEach(link => {
        link.addEventListener('click', (e) => setView(e.target.dataset.view));
    });
});


// --- Theme Toggle ---
const themeToggleBtn = qs('#themeToggle');
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('hub_theme', isLight ? 'light' : 'dark');
    themeToggleBtn.innerHTML = isLight 
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';
}
themeToggleBtn.addEventListener('click', toggleTheme);

// Initialize theme
(function initTheme() {
    const savedTheme = localStorage.getItem('hub_theme');
    if (savedTheme === 'light') {
        // Toggle if dark theme is default (which it is in the CSS)
        if (!document.body.classList.contains('light-theme')) {
            toggleTheme();
        }
    }
})();

// --- Authentication ---
const authBtn = qs('#authBtn');
const authModal = qs('#authModal');
const authForm = qs('#authForm');
const googleAuthBtn = qs('#googleAuthBtn');

function updateAuthUI() {
    if (store.user) {
        authBtn.textContent = (store.user.name || 'User').split(' ')[0] + ' • Sign Out';
        authBtn.classList.remove('brand');
        authBtn.classList.add('ghost');
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.classList.remove('ghost');
        authBtn.classList.add('brand');
    }
    // Re-render relevant sections that depend on user state
    if (store.currentView === 'my-listings') {
        renderMyListings();
    }
    updateHomeStats();
}

authBtn.addEventListener('click', () => {
    if (store.user) {
        if (confirm('Are you sure you want to sign out?')) {
            store.user = null;
            updateAuthUI();
            setView('home');
            showMessage('Signed out successfully.', 'info');
        }
    } else {
        openModal(authModal);
    }
});

// Handle form-based login
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(authForm).entries());

    // Simple email domain validation (as per the application concept)
    if (!data.email.endsWith(ALLOWED_DOMAIN)) {
        showMessage(`Authentication failed. Email must end with ${ALLOWED_DOMAIN}`, 'error');
        return;
    }
    await handleAuth(data);
});

// Handle simulated Google login
googleAuthBtn.disabled = false;
googleAuthBtn.addEventListener('click', async () => {
    const fakeData = { name: "Google Sign-in Demo", email: "google.demo@gmail.com" };
    await handleAuth(fakeData);
});

async function handleAuth(data) {
    // In a real app, this would be a backend call to verify/register and get a JWT.
    // Since the provided server.js doesn't have an /auth/login route, we simulate it
    // and create a dummy token/user object for client-side state management.
    
    // Simulate User ID based on email (for demo purposes)
    const userId = data.email.split('@')[0];
    
    const user = {
        userId: userId,
        name: data.name,
        email: data.email,
        // Dummy token for simulation, the real server doesn't validate this yet
        token: `dummy-jwt-${userId}` 
    };
    
    store.user = user;
    updateAuthUI();
    closeModal(authModal);
    showMessage(`Welcome, ${user.name.split(' ')[0]}! You are now signed in.`, 'success');
    setView('listings');
}


// --- Listing Data & Filtering ---
const q = qs('#q');
const typeFilter = qs('#typeFilter');
const condFilter = qs('#condFilter');
const sortBy = qs('#sortBy');
const clearFilters = qs('#clearFilters');

// Attach event listeners for filtering/sorting
;[q, typeFilter, condFilter, sortBy].forEach(el => el.addEventListener('input', renderListingsGrid));
clearFilters.addEventListener('click', () => {
    q.value='';typeFilter.value='';condFilter.value='';sortBy.value='new';
    renderListingsGrid();
});

function applyFilters(data, isMyListings = false) {
    let res = [...data]; // Start with a copy of the data
    
    // 1. Filter by owner (for My Listings view)
    if (isMyListings && store.user) {
        // NOTE: The original server schema doesn't seem to store `owner.userId`, 
        // but for client-side filtering consistency, we'll need to assume the 
        // backend returns a way to identify the owner, or that the contact email
        // can be used as a simple owner ID in this demo context.
        // Since we are adding the book via the client, we'll match by the contact email, 
        // assuming the owner sets their contact to their login email.
        res = res.filter(d => d.contact === store.user.email);
    }
    
    // 2. Apply text search filters
    const term = q.value.trim().toLowerCase();
    res = res.filter(d => {
        // Combine fields for search. Note: Author/Subject/Description are not
        // explicitly in the provided BookSchema in server.js, but are in the form. 
        // We'll search against title, type, condition for now.
        const str = (d.title + ' ' + d.type + ' ' + d.condition).toLowerCase();
        if (term && !str.includes(term)) return false;
        
        // 3. Apply dropdown filters
        if (typeFilter.value && d.type !== typeFilter.value) return false;
        if (condFilter.value && d.condition !== condFilter.value) return false;
        
        return true;
    });

    // 4. Apply sorting
    switch (sortBy.value) {
        case 'priceAsc': res.sort((a, b) => a.price - b.price); break;
        case 'priceDesc': res.sort((a, b) => b.price - a.price); break;
        case 'title': res.sort((a, b) => a.title.localeCompare(b.title)); break;
        default: res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return res;
}

// --- Data Loading and Rendering ---

async function loadAndRenderListings() {
    const data = await apiFetch('/books');
    if (data) {
        // The MongoDB object IDs are strings, which is fine.
        store.listings = data; // Cache in store
        renderListingsGrid();
    }
}

function renderListingsGrid() {
    const allData = store.listings;
    const filteredData = applyFilters(allData, false);
    const grid = qs('#listingsGrid');
    grid.innerHTML = '';
    
    qs('#statTotalBooks').textContent = allData.length;
    
    if (!filteredData.length) {
        qs('#emptyListings').classList.remove('hidden');
        return;
    }
    qs('#emptyListings').classList.add('hidden');

    filteredData.forEach(d => grid.appendChild(createListingCard(d, false)));
}

function renderMyListings() {
    // Check for sign-in
    if (!store.user) {
        qs('#myListingsView').innerHTML = '<div class="card" style="text-align:center; padding:40px; margin-top:30px"><p class="fine">Please sign in to view and manage your listings.</p><button class="btn brand" onclick="openModal(authModal)">Sign In Now</button></div>';
        qs('#myListingsCount').textContent = '0';
        qs('#statMyListings').textContent = '0';
        return;
    }

    // Filter to get only the current user's listings
    const myListings = applyFilters(store.listings, true);
    const grid = qs('#myListingsGrid');
    grid.innerHTML = '';
    
    qs('#myListingsCount').textContent = myListings.length;
    qs('#statMyListings').textContent = myListings.length;
    
    if (!myListings.length) {
        qs('#emptyMyListings').classList.remove('hidden');
        return;
    }
    qs('#emptyMyListings').classList.add('hidden');

    myListings.forEach(d => grid.appendChild(createListingCard(d, true)));
}

function updateHomeStats() {
    const myListings = applyFilters(store.listings, true);
    qs('#statTotalBooks').textContent = store.listings.length;
    qs('#statMyListings').textContent = myListings.length;
}

// --- Card Rendering ---
function createListingCard(d, isOwnerView = false) {
    const card = document.createElement('article');
    card.className = 'listing-card';
    card.setAttribute('data-id', d._id); // Use MongoDB ID
    
    const imgPlaceholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="var(--border)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="var(--muted)" font-family="Inter" font-size="16">No Cover</text></svg>`);
    
    const priceDisplay = d.type === 'Exchange' 
        ? `<span class="price" style="color:var(--brand-2)">EXCHANGE</span>`
        : d.type === 'Buy'
        ? `<span class="price" style="color:var(--brand-2)">WANT TO BUY</span>`
        : `<span class="price" style="color:var(--brand)">₹ ${Number(d.price).toLocaleString()}</span>`;

    const typeColor = d.type === 'Sell' ? 'var(--brand)' : d.type === 'Buy' ? 'var(--brand-2)' : 'var(--muted)';

    card.innerHTML = `
        <img src="${d.image || imgPlaceholder}" alt="${escapeHtml(d.title)} Cover" onerror="this.src='${imgPlaceholder}'" />
        <div class="info">
            <div class="row" style="justify-content:space-between;align-items:flex-start">
                <h3 style="flex-grow:1">${escapeHtml(d.title)}</h3>
                <span class="tag" style="background:${typeColor}; color:var(--bg); border:0">${d.type}</span>
            </div>
            <div class="fine" style="margin-bottom:4px">
                ${escapeHtml(d.author || 'Unknown')} • ${escapeHtml(d.subject || 'General')}
            </div>
            <div class="row" style="align-items:center; justify-content:space-between; margin-top:auto">
                ${priceDisplay}
                <span class="tag">${d.condition}</span>
            </div>
            ${isOwnerView ? `<div class="row" style="margin-top:10px; justify-content:flex-end">
                <button class="btn ghost btn-delete" data-id="${d._id}" style="color:var(--brand-2)">Delete</button>
            </div>` : ''}
        </div>
    `;

    // Add click listener to open detail modal, unless it's a delete button click
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-delete')) {
            showDetail(d);
        }
    });

    if (isOwnerView) {
        card.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click event
            deleteListing(d._id);
        });
    }

    return card;
}

// --- Detail Modal ---
const detailModal = qs('#detailModal');
const detailContent = qs('#detailContent');

function showDetail(listing) {
    store.activeListing = listing;
    
    // Check if the current user is the owner
    const isOwner = store.user && listing.contact === store.user.email;
    
    const imgPlaceholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="var(--border)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="var(--muted)" font-family="Inter" font-size="16">No Cover</text></svg>`);

    const priceDisplay = listing.type === 'Exchange' 
        ? `<span class="price" style="color:var(--brand-2)">EXCHANGE</span>`
        : listing.type === 'Buy'
        ? `<span class="price" style="color:var(--brand-2)">WANT TO BUY</span>`
        : `<span class="price" style="color:var(--brand)">₹ ${Number(listing.price).toLocaleString()}</span>`;

    const contactAction = isOwner
        ? `<div class="fine" style="color:var(--brand)">This is your listing.</div>`
        : `<a href="mailto:${listing.contact}?subject=Inquiry about: ${escapeHtml(listing.title)}" class="btn brand" target="_blank">Contact Seller: ${listing.contact}</a>`;

    detailContent.innerHTML = `
        <div id="detailView">
            <div id="detailImageContainer">
                <img id="detailImage" src="${listing.image || imgPlaceholder}" alt="${escapeHtml(listing.title)} Cover" onerror="this.src='${imgPlaceholder}'" />
            </div>
            <div id="detailInfo">
                <h1 id="detailTitle">${escapeHtml(listing.title)}</h1>
                <p class="fine" style="margin-top:-10px; color:var(--muted)">by ${escapeHtml(listing.author || 'Unknown')} in ${escapeHtml(listing.subject || 'General')}</p>
                <div class="row" style="margin:16px 0; gap:20px; align-items:center">
                    ${priceDisplay}
                    <span class="tag" style="background:var(--border)">Type: ${listing.type}</span>
                    <span class="tag" style="background:var(--border)">Condition: ${listing.condition}</span>
                </div>
                
                <h2>Description</h2>
                <p>${escapeHtml(listing.description || 'No detailed description provided.')}</p>

                <div style="margin-top:30px">
                    ${contactAction}
                </div>
            </div>
        </div>
    `;
    openModal(detailModal);
}

// --- Listing Form Submission ---
const listingForm = qs('#listingForm');

// Image file reader for Base64 conversion
qs('#imageInput').addEventListener('change', function() {
    const preview = qs('#preview');
    if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(this.files[0]);
    } else {
        preview.style.display = 'none';
        preview.src = '';
    }
});

listingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!store.user) {
        showMessage('You must be signed in to publish a listing.', 'warn');
        openModal(authModal);
        return;
    }
    
    const formData = new FormData(listingForm);
    const data = Object.fromEntries(formData.entries());
    
    // Add owner/contact info from store.user
    data.contact = store.user.email;
    
    // Get image from preview (which holds the Base64 string)
    const imagePreview = qs('#preview');
    data.image = imagePreview.src.startsWith('data:image') ? imagePreview.src : '';
    
    // Convert price to number
    data.price = Number(data.price);
    
    // Only send fields relevant to the backend schema + the extra fields for detail view
    const payload = {
        title: data.title,
        type: data.type,
        price: data.price,
        condition: data.condition,
        contact: data.contact,
        image: data.image,
        // The following are included for a rich client-side display, 
        // though the server schema only saves the above fields.
        author: data.author,
        subject: data.subject,
        description: data.description,
    };
    
    const newBook = await apiFetch('/books', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    
    if (newBook) {
        showMessage(`Listing for "${newBook.title}" successfully published!`, 'success');
        listingForm.reset();
        qs('#preview').style.display = 'none';
        
        // Refresh the list cache and switch view
        await loadAndRenderListings();
        setView('listings');
    }
});

// --- Delete Listing ---
async function deleteListing(id) {
    if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
        return;
    }
    
    const response = await apiFetch(`/books/${id}`, {
        method: 'DELETE'
    });
    
    if (response) {
        showMessage('Listing deleted successfully.', 'success');
        
        // Optimistically update cache and re-render
        store.listings = store.listings.filter(d => d._id !== id);
        renderMyListings(); // Refresh my list view
        renderListingsGrid(); // Refresh all listings view
        updateHomeStats(); // Refresh stats
    }
}

// --- Initialization ---
// Load initial data and set view when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in from a previous session
    updateAuthUI();
    
    // Load data from the MongoDB backend and render the default view
    loadAndRenderListings().then(() => {
        setView(store.currentView);
    });
});
