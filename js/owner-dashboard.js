import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const bookingsList = document.getElementById('bookings-list');
const emptyState = document.getElementById('empty-state');
const filterDateInput = document.getElementById('filter-date');
const statToday = document.getElementById('stat-today');
const statGuests = document.getElementById('stat-guests');
const statRevenue = document.getElementById('stat-revenue');

// State
let currentListener = null;
let revenueChart = null; 
let currentRestaurantId = null; // Store the specific restaurant ID

// 1. Auth Check & Init
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        // First, find which restaurant belongs to this user
        await findOwnerRestaurant(user.uid);
    }
});

// NEW: Find the Restaurant ID for the logged-in owner AND Load Table Config
async function findOwnerRestaurant(uid) {
    try {
        const q = query(collection(db, "restaurants"), where("ownerId", "==", uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Found the restaurant!
            const docSnap = querySnapshot.docs[0];
            currentRestaurantId = docSnap.id;
            const data = docSnap.data();
            
            // --- LOAD SAVED TABLE INVENTORY ---
            if (data.tableInventory) {
                document.getElementById('qty2pax').value = data.tableInventory["2pax"] || 0;
                document.getElementById('qty4pax').value = data.tableInventory["4pax"] || 0;
                document.getElementById('qty6pax').value = data.tableInventory["6pax"] || 0;
                document.getElementById('qty8pax').value = data.tableInventory["8pax"] || 0;
                document.getElementById('qty10pax').value = data.tableInventory["10pax"] || 0;
            }
            // ----------------------------------

            // Now load the dashboard for THIS restaurant
            const today = new Date().toISOString().split('T')[0];
            filterDateInput.value = today;
            initChart();
            setupRealtimeListener(today);
        } else {
            // User is an owner but hasn't created a restaurant profile yet
            alert("No restaurant profile found. Please set up your profile.");
            window.location.href = 'owner-profile.html';
        }
    } catch (error) {
        console.error("Error finding restaurant:", error);
        alert("System Error: Could not load profile.");
    }
}

// 2. Real-Time Logic (Day Overview)
function setupRealtimeListener(dateFilter) {
    if (currentListener) currentListener(); // Unsubscribe old
    if (!currentRestaurantId) return; // Safety check

    bookingsList.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 animate-pulse">Loading day overview...</td></tr>';

    const q = query(
        collection(db, "bookings"), 
        where("bookingDate", "==", dateFilter),
        where("restaurantId", "==", currentRestaurantId) 
    );

    currentListener = onSnapshot(q, (snapshot) => {
        let bookings = [];
        let totalGuests = 0;
        let revenue = 0;
        let confirmedCount = 0;

        if (snapshot.empty) {
            renderTable([]);
            updateStats(0, 0, 0);
            updateChart([]); // Clear chart
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({ id: doc.id, ...data });
            
            // Stats: Count confirmed AND completed
            if (['confirmed', 'completed'].includes(data.status)) {
                if (data.pax) totalGuests += parseInt(data.pax);
                
                // Subtract fixed RM 50 deposit
                if (data.totalCost) {
                    const rawCost = parseFloat(data.totalCost);
                    const actualRevenue = Math.max(0, rawCost - 50); 
                    revenue += actualRevenue;
                }
                
                confirmedCount++;
            }
        });

        // Sort: Active first, then completed, then others
        bookings.sort((a, b) => {
            const statusOrder = { 'confirmed': 1, 'completed': 2, 'pending_payment': 3, 'cancelled': 4 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });
        
        renderTable(bookings);
        updateStats(confirmedCount, totalGuests, revenue);
        updateChart(bookings); 

    }, (error) => {
        console.error("Error:", error);
        showToast("Error loading data", "error");
    });
}

// 3. Render Table (UPDATED FOR CLICKABLE ROWS)
function renderTable(data) {
    bookingsList.innerHTML = '';
    
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    data.forEach(item => {
        const row = document.createElement('tr');
        const isDimmed = item.status === 'cancelled' || item.status === 'rejected';
        
        // NEW: Add cursor-pointer and hover effect
        row.className = `border-b border-gray-50 last:border-none transition cursor-pointer ${isDimmed ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'}`;
        
        // NEW: Click event to go to details page
        row.onclick = () => {
            window.location.href = `owner-order-details.html?id=${item.id}`;
        };

        let badge = '';
        if(item.status === 'confirmed') badge = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Active</span>`;
        else if(item.status === 'completed') badge = `<span class="bg-slate-900 text-white px-2 py-1 rounded-full text-xs font-bold">Completed</span>`;
        else if(item.status === 'cancelled') badge = `<span class="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-bold">Cancelled</span>`;
        else badge = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">${item.status}</span>`;

        let actionButtons = '-';
        if (item.status === 'confirmed') {
            // NEW: Added event.stopPropagation() to prevent row click when clicking buttons
            actionButtons = `
                <div class="flex justify-center gap-2">
                    <button onclick="event.stopPropagation(); updateStatus('${item.id}', 'completed')" class="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition flex items-center justify-center" title="Mark Completed">
                        <i data-lucide="check" class="w-4 h-4"></i>
                    </button>
                    <button onclick="event.stopPropagation(); updateStatus('${item.id}', 'cancelled')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center" title="No Show / Cancel">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        } else if (item.status === 'completed') {
             actionButtons = `<span class="text-xs font-bold text-green-600 flex justify-center items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> Done</span>`;
        }

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        ${item.pax}
                    </div>
                    <div>
                        <p class="font-bold text-slate-900">${item.customerName || 'Guest'}</p>
                        <p class="text-xs font-bold text-teal-600">
                            ${item.assignedTableSize ? 'Table: ' + item.assignedTableSize.replace('pax','') : '... ' + item.id.slice(-4)}
                        </p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">${badge}</td>
            <td class="px-6 py-4">
                <p class="text-sm font-medium text-slate-700">${item.timeSlot}</p>
            </td>
            <td class="px-6 py-4 font-mono text-sm font-bold text-slate-700">
                RM ${parseFloat(item.totalCost || 0).toFixed(2)}
            </td>
            <td class="px-6 py-4 text-right">
                <span class="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded select-all">
                    ${item.billCode || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4">
                ${actionButtons}
            </td>
        `;
        bookingsList.appendChild(row);
    });
    
    if(window.lucide) lucide.createIcons();
}

window.updateStatus = async (id, newStatus) => {
    if(!confirm(`Mark this booking as ${newStatus}?`)) return;
    try {
        const docRef = doc(db, "bookings", id);
        await updateDoc(docRef, { status: newStatus });
        showToast(`Booking marked as ${newStatus}`);
    } catch (error) {
        console.error(error);
        showToast("Action failed", "error");
    }
};

function updateStats(total, guests, revenue) {
    statToday.innerText = total;
    statGuests.innerText = guests;
    statRevenue.innerText = `RM ${revenue.toFixed(2)}`;
}

// 4. Analytics Chart Logic
function initChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(20, 184, 166, 0.2)'); 
    gradient.addColorStop(1, 'rgba(20, 184, 166, 0)');

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', '9 PM'],
            datasets: [{
                label: 'Food Sales (RM)', 
                data: [0,0,0,0,0,0,0], 
                borderColor: '#0d9488', 
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                tension: 0.4, 
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateChart(bookings) {
    const buckets = [0, 0, 0, 0, 0, 0, 0];

    bookings.forEach(b => {
        if (['confirmed', 'completed'].includes(b.status)) {
            const hour = parseHour(b.timeSlot);
            const rawCost = parseFloat(b.totalCost || 0);
            const amt = Math.max(0, rawCost - 50);

            let index = -1;
            if (hour >= 9 && hour < 11) index = 0;
            else if (hour >= 11 && hour < 13) index = 1;
            else if (hour >= 13 && hour < 15) index = 2;
            else if (hour >= 15 && hour < 17) index = 3;
            else if (hour >= 17 && hour < 19) index = 4;
            else if (hour >= 19 && hour < 21) index = 5;
            else if (hour >= 21) index = 6; 

            if (index !== -1) {
                buckets[index] += amt;
            }
        }
    });

    revenueChart.data.datasets[0].data = buckets;
    revenueChart.update();
}

function parseHour(timeStr) {
    if(!timeStr) return 0;
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    if (hours === 12 && modifier === 'AM') hours = 0;
    if (hours !== 12 && modifier === 'PM') hours += 12;
    return hours;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-500 text-white';
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';

    toast.className = `${colors} px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i><span class="font-bold text-sm">${message}</span>`;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === NEW: Function to Save Table Inventory ===
window.saveTableConfig = async function() {
    if (!currentRestaurantId) {
        showToast("Error: Restaurant profile not loaded yet.", "error");
        return;
    }

    const inventory = {
        "2pax": parseInt(document.getElementById('qty2pax').value) || 0,
        "4pax": parseInt(document.getElementById('qty4pax').value) || 0,
        "6pax": parseInt(document.getElementById('qty6pax').value) || 0,
        "8pax": parseInt(document.getElementById('qty8pax').value) || 0,
        "10pax": parseInt(document.getElementById('qty10pax').value) || 0
    };

    try {
        const docRef = doc(db, "restaurants", currentRestaurantId);
        // We use merge: true implicitly with updateDoc for top-level fields, 
        // but since we are updating a specific field 'tableInventory', updateDoc is perfect.
        await updateDoc(docRef, { tableInventory: inventory });
        
        showToast("Table configuration saved successfully!");
        console.log("Saved Inventory:", inventory);
    } catch (error) {
        console.error("Error saving tables:", error);
        showToast("Failed to save: " + error.message, "error");
    }
};

filterDateInput.addEventListener('change', (e) => setupRealtimeListener(e.target.value));

document.getElementById('btn-refresh').onclick = () => {
    setupRealtimeListener(filterDateInput.value);
    showToast("Dashboard Refreshed");
};

document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => window.location.href = 'index.html');
};