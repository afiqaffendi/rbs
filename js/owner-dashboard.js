import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 1. Auth Check & Init
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        const today = new Date().toISOString().split('T')[0];
        filterDateInput.value = today;
        initChart();
        setupRealtimeListener(today);
    }
});

// 2. Real-Time Logic (Day Overview)
function setupRealtimeListener(dateFilter) {
    if (currentListener) currentListener(); // Unsubscribe old

    bookingsList.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 animate-pulse">Loading day overview...</td></tr>';

    // QUERY: Fetch ALL bookings for this date (Removed status filter)
    // This ensures stats are accurate even after marking as 'completed'
    const q = query(
        collection(db, "bookings"), 
        where("bookingDate", "==", dateFilter)
    );

    currentListener = onSnapshot(q, (snapshot) => {
        let bookings = [];
        let totalGuests = 0;
        let revenue = 0;
        let confirmedCount = 0;

        if (snapshot.empty) {
            renderTable([]);
            updateStats(0, 0, 0);
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({ id: doc.id, ...data });
            
            // Stats: Count confirmed AND completed (money earned)
            if (['confirmed', 'completed'].includes(data.status)) {
                if (data.pax) totalGuests += parseInt(data.pax);
                if (data.totalCost) revenue += parseFloat(data.totalCost);
                confirmedCount++;
            }
        });

        // Sort: Put 'confirmed' (Active) at top, then 'completed', then others
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

// 3. Render Table with Actions
function renderTable(data) {
    bookingsList.innerHTML = '';
    
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    data.forEach(item => {
        const row = document.createElement('tr');
        // Dim the row if it's not active
        const isDimmed = item.status === 'cancelled' || item.status === 'rejected';
        row.className = `border-b border-gray-50 last:border-none transition ${isDimmed ? 'opacity-50 bg-slate-50' : 'hover:bg-gray-50'}`;
        
        // Determine Status Badge
        let badge = '';
        if(item.status === 'confirmed') badge = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Active</span>`;
        else if(item.status === 'completed') badge = `<span class="bg-slate-900 text-white px-2 py-1 rounded-full text-xs font-bold">Completed</span>`;
        else if(item.status === 'cancelled') badge = `<span class="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-bold">Cancelled</span>`;
        else badge = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">${item.status}</span>`;

        // Action Buttons Logic
        let actionButtons = '-';
        if (item.status === 'confirmed') {
            actionButtons = `
                <div class="flex justify-center gap-2">
                    <button onclick="updateStatus('${item.id}', 'completed')" class="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition flex items-center justify-center" title="Mark Completed">
                        <i data-lucide="check" class="w-4 h-4"></i>
                    </button>
                    <button onclick="updateStatus('${item.id}', 'cancelled')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center" title="No Show / Cancel">
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
                        <p class="font-bold text-slate-900">Guest</p>
                        <p class="text-xs text-slate-400">...${item.id.slice(-4)}</p>
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

// 4. Handle Status Updates (Global Function)
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

// 5. Analytics Chart
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
                label: 'Revenue (RM)',
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
    // Simple logic: Sum revenue per 2-hour block (Simulated distribution for now)
    // You can make this smarter later
    const dataPoints = [0,0,0,0,0,0,0]; 
    if(bookings.length > 0) {
        dataPoints.fill(10); // Dummy visual for now
    }
    revenueChart.data.datasets[0].data = dataPoints;
    revenueChart.update();
}

// 6. Toast System
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

// Event Listeners
filterDateInput.addEventListener('change', (e) => setupRealtimeListener(e.target.value));

document.getElementById('btn-refresh').onclick = () => {
    setupRealtimeListener(filterDateInput.value);
    showToast("Dashboard Refreshed");
};

document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => window.location.href = 'index.html');
};