import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './toast.js';

// --- DOM Elements ---
const timeFilter = document.getElementById('time-filter');
const bookingsList = document.getElementById('bookings-list');
const emptyState = document.getElementById('empty-state');

// Stats Elements
const statOrders = document.getElementById('stat-orders');
const statGuests = document.getElementById('stat-guests');
const statRevenue = document.getElementById('total-revenue-badge');

// New Section Elements
const popularList = document.getElementById('popular-items-list');

// State
let currentRestaurantId = null;
let revenueChart = null; 

// --- 1. Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        await findOwnerRestaurant(user.uid);
    }
});

async function findOwnerRestaurant(uid) {
    try {
        const q = query(collection(db, "restaurants"), where("ownerId", "==", uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            currentRestaurantId = docSnap.id;
            const data = docSnap.data();
            
            // Load Sidebar Inventory Data
            loadInventoryUI(data.tableInventory);

            // Initialize Dashboard with 'Daily' view
            initChart();
            updateDashboard('daily');

            // Setup Filter Listener
            if(timeFilter) {
                timeFilter.addEventListener('change', (e) => {
                    updateDashboard(e.target.value);
                });
            }

        } else {
            showToast("No restaurant profile found.", "error");
            window.location.href = 'owner-profile.html';
        }
    } catch (error) {
        console.error("Error finding restaurant:", error);
        showToast("System Error: Could not load profile.", "error");
    }
}

// --- 2. Main Dashboard Logic ---
async function updateDashboard(range) {
    if (!currentRestaurantId) return;

    // UI Loading State
    bookingsList.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 animate-pulse">Loading data...</td></tr>';
    popularList.innerHTML = '<p class="text-xs text-slate-400 text-center mt-10">Analyzing orders...</p>';

    // 1. Calculate Date Range
    const { startDate, endDate } = getDateRange(range);

    try {
        // Query only by Restaurant ID
        const q = query(
            collection(db, "bookings"), 
            where("restaurantId", "==", currentRestaurantId)
        );

        const snapshot = await getDocs(q);
        const bookings = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // Client-side date filtering
            if (data.bookingDate >= startDate && data.bookingDate <= endDate) {
                bookings.push({ id: doc.id, ...data });
            }
        });

        // 3. Process Data
        const confirmedBookings = bookings.filter(b => ['confirmed', 'completed'].includes(b.status));
        
        // Update UI Components
        updateStats(confirmedBookings);
        renderChart(confirmedBookings, range);
        renderPopularFood(confirmedBookings);
        renderTable(bookings); 

    } catch (error) {
        console.error("Dashboard Error:", error);
        bookingsList.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-400">Failed to load data. Check console.</td></tr>';
    }
}

// --- 3. Data Processing Helpers ---

function getDateRange(range) {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (range === 'daily') {
        // Start and End are today
    } else if (range === 'weekly') {
        start.setDate(today.getDate() - 6);
    } else if (range === 'monthly') {
        start.setDate(1); 
    }

    const toLocalISO = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date - offset).toISOString().split('T')[0];
    };

    return {
        startDate: toLocalISO(start),
        endDate: toLocalISO(end)
    };
}

function updateStats(bookings) {
    let totalRev = 0;
    let totalGuests = 0;

    bookings.forEach(b => {
        totalGuests += parseInt(b.pax || 0);
        // Using 'totalCost' or 'deposit' depending on what's available
        totalRev += parseFloat(b.totalCost || b.deposit || 0);
    });

    statOrders.innerText = bookings.length;
    statGuests.innerText = totalGuests;
    statRevenue.innerText = `RM ${totalRev.toFixed(2)}`;
}

// --- 4. Chart Logic ---
function initChart() {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue',
                data: [],
                borderColor: '#0d9488', 
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#fff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderChart(bookings, range) {
    const dataMap = {};
    bookings.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    if (range === 'daily') {
        const hours = ['9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM'];
        hours.forEach(h => dataMap[h] = 0); 
        
        bookings.forEach(b => {
            if(b.timeSlot) {
                const hour = formatTimeSlotToHour(b.timeSlot);
                if(dataMap[hour] !== undefined) {
                    dataMap[hour] += parseFloat(b.totalCost || 0);
                }
            }
        });
        revenueChart.data.labels = hours;
        revenueChart.data.datasets[0].data = hours.map(h => dataMap[h]);
    } else {
        bookings.forEach(b => {
            const dateObj = new Date(b.bookingDate);
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dataMap[label] = (dataMap[label] || 0) + parseFloat(b.totalCost || 0);
        });
        revenueChart.data.labels = Object.keys(dataMap);
        revenueChart.data.datasets[0].data = Object.values(dataMap);
    }
    revenueChart.update();
}

function formatTimeSlotToHour(timeSlot) {
    if (!timeSlot) return "9 AM";
    const is12Hour = timeSlot.includes('AM') || timeSlot.includes('PM');
    if (is12Hour) {
        let [time, modifier] = timeSlot.split(' ');
        let [hour, min] = time.split(':');
        return `${parseInt(hour)} ${modifier}`;
    } else {
        const t = parseInt(timeSlot.split(':')[0]);
        if(t === 9 || t === 21) return t > 12 ? '9 PM' : '9 AM';
        if(t > 12) return `${t-12} PM`;
        if(t === 12) return '12 PM';
        return `${t} AM`;
    }
}

// --- 5. Popular Food Logic (FIXED: Uses 'menuItems') ---
function renderPopularFood(bookings) {
    const itemCounts = {};
    let itemsFound = false;

    bookings.forEach(booking => {
        // FIX: Changed from 'items' to 'menuItems' based on your other files
        if (booking.menuItems && Array.isArray(booking.menuItems)) {
            booking.menuItems.forEach(item => {
                const name = item.name || 'Unknown Item';
                // FIX: Added 'item.qty' check since your other files use 'qty'
                const qty = parseInt(item.qty || item.quantity || 1);
                
                itemCounts[name] = (itemCounts[name] || 0) + qty;
                itemsFound = true;
            });
        }
    });

    const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    popularList.innerHTML = '';

    if (!itemsFound && bookings.length > 0) {
        popularList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                <i data-lucide="coffee" class="w-8 h-8 mb-2 opacity-50"></i>
                <p class="text-xs font-semibold">Orders found, but no menu items.</p>
                <p class="text-[10px] opacity-70">These might be table-only reservations.</p>
            </div>`;
    } else if (sortedItems.length === 0) {
         popularList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                <i data-lucide="utensils-crossed" class="w-8 h-8 mb-2 opacity-20"></i>
                <p class="text-xs">No orders in this period</p>
            </div>`;
    } else {
        sortedItems.forEach(([name, count], index) => {
            let rankColor = 'bg-slate-100 text-slate-600';
            if(index === 0) rankColor = 'bg-yellow-100 text-yellow-700';
            if(index === 1) rankColor = 'bg-gray-100 text-gray-700';
            if(index === 2) rankColor = 'bg-orange-50 text-orange-600';

            const html = `
                <div class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center justify-center w-6 h-6 ${rankColor} text-xs font-bold rounded-full">
                            ${index + 1}
                        </span>
                        <span class="text-sm font-semibold text-slate-700 group-hover:text-slate-900 line-clamp-1">${name}</span>
                    </div>
                    <span class="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
                        ${count} sold
                    </span>
                </div>
            `;
            popularList.insertAdjacentHTML('beforeend', html);
        });
    }
    if(window.lucide) lucide.createIcons();
}

// --- 6. Table List Render ---
function renderTable(data) {
    bookingsList.innerHTML = '';
    
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    data.forEach(item => {
        const row = document.createElement('tr');
        const isDimmed = item.status === 'cancelled' || item.status === 'rejected';
        
        row.className = `border-b border-gray-50 last:border-none transition cursor-pointer ${isDimmed ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'}`;
        row.onclick = () => window.location.href = `owner-order-details.html?id=${item.id}`;

        let badgeClass = 'bg-gray-100 text-gray-600';
        if(item.status === 'confirmed') badgeClass = 'bg-green-100 text-green-700';
        if(item.status === 'cancelled') badgeClass = 'bg-red-100 text-red-600';
        if(item.status === 'completed') badgeClass = 'bg-slate-900 text-white';

        let actionButtons = '-';
        if (item.status === 'confirmed') {
            actionButtons = `
                <div class="flex justify-center gap-2">
                    <button onclick="event.stopPropagation(); updateBookingStatus('${item.id}', 'completed')" class="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition flex items-center justify-center">
                        <i data-lucide="check" class="w-4 h-4"></i>
                    </button>
                    <button onclick="event.stopPropagation(); updateBookingStatus('${item.id}', 'cancelled')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>`;
        } else if (item.status === 'completed') {
            actionButtons = `<span class="text-xs font-bold text-green-600 flex justify-center items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> Done</span>`;
        }

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">${item.pax || '?'}</div>
                    <div>
                        <p class="font-bold text-slate-900">${item.customerName || 'Guest'}</p>
                        <p class="text-xs text-slate-400">${item.id.slice(0,6)}...</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4"><span class="${badgeClass} px-2 py-1 rounded-full text-xs font-bold capitalize">${item.status}</span></td>
            <td class="px-6 py-4">
                <p class="text-sm font-medium text-slate-700">${item.bookingDate}</p>
                <p class="text-xs text-slate-400">${item.timeSlot}</p>
            </td>
            <td class="px-6 py-4 font-mono text-sm font-bold text-slate-700">RM ${parseFloat(item.totalCost || item.deposit || 0).toFixed(2)}</td>
            <td class="px-6 py-4 text-right"><span class="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">${item.billCode || 'N/A'}</span></td>
            <td class="px-6 py-4 text-center">${actionButtons}</td>
        `;
        bookingsList.appendChild(row);
    });
    if(window.lucide) lucide.createIcons();
}

function loadInventoryUI(inventory) {
    if(!inventory) return;
    if(document.getElementById('qty2pax')) document.getElementById('qty2pax').value = inventory["2pax"] || 0;
    if(document.getElementById('qty4pax')) document.getElementById('qty4pax').value = inventory["4pax"] || 0;
    if(document.getElementById('qty6pax')) document.getElementById('qty6pax').value = inventory["6pax"] || 0;
    if(document.getElementById('qty8pax')) document.getElementById('qty8pax').value = inventory["8pax"] || 0;
    if(document.getElementById('qty10pax')) document.getElementById('qty10pax').value = inventory["10pax"] || 0;
}

window.saveTableConfig = async function() {
    if (!currentRestaurantId) return;
    const inventory = {
        "2pax": parseInt(document.getElementById('qty2pax').value) || 0,
        "4pax": parseInt(document.getElementById('qty4pax').value) || 0,
        "6pax": parseInt(document.getElementById('qty6pax').value) || 0,
        "8pax": parseInt(document.getElementById('qty8pax').value) || 0,
        "10pax": parseInt(document.getElementById('qty10pax').value) || 0
    };
    try {
        await updateDoc(doc(db, "restaurants", currentRestaurantId), { tableInventory: inventory });
        showToast("Table configuration saved successfully!");
    } catch (error) {
        showToast("Failed to save: " + error.message, "error");
    }
};

window.updateBookingStatus = async (id, newStatus) => {
    if(!confirm(`Mark this booking as ${newStatus}?`)) return;
    try {
        await updateDoc(doc(db, "bookings", id), { status: newStatus });
        showToast(`Booking marked as ${newStatus}`);
        if(timeFilter) updateDashboard(timeFilter.value);
    } catch (error) {
        console.error(error);
        showToast("Action failed", "error");
    }
};

document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => window.location.href = 'index.html');
};