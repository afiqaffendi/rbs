import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const bookingsList = document.getElementById('bookings-list');
const emptyState = document.getElementById('empty-state');
const filterDateInput = document.getElementById('filter-date');
const statToday = document.getElementById('stat-today');
const statGuests = document.getElementById('stat-guests');
const statRevenue = document.getElementById('stat-revenue');

// State
let currentListener = null;
let revenueChart = null; // Chart instance

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

// 2. Real-Time Logic (Auto-Filter: CONFIRMED ONLY)
function setupRealtimeListener(dateFilter) {
    if (currentListener) currentListener(); // Unsubscribe old

    bookingsList.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-slate-400 animate-pulse">Loading confirmed bookings...</td></tr>';

    // QUERY: Only show 'confirmed' bookings for the selected date
    const q = query(
        collection(db, "bookings"), 
        where("bookingDate", "==", dateFilter),
        where("status", "==", "confirmed") 
    );

    currentListener = onSnapshot(q, (snapshot) => {
        let bookings = [];
        let totalGuests = 0;
        let revenue = 0;

        if (snapshot.empty) {
            renderTable([]);
            updateStats(0, 0, 0);
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({ id: doc.id, ...data });
            
            // Stats Calculation
            if (data.pax) totalGuests += parseInt(data.pax);
            if (data.totalCost) revenue += parseFloat(data.totalCost);
        });

        // Sort by Time (Newest First)
        bookings.sort((a, b) => b.createdAt - a.createdAt);
        
        renderTable(bookings);
        updateStats(bookings.length, totalGuests, revenue);
        updateChart(bookings); 

    }, (error) => {
        console.error("Error:", error);
        showToast("Error loading data", "error");
    });
}

// 3. Render Table (No Verify Button)
function renderTable(data) {
    bookingsList.innerHTML = '';
    
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition border-b border-gray-50 last:border-none group";
        
        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        ${item.pax}
                    </div>
                    <div>
                        <p class="font-bold text-slate-900">Guest</p>
                        <p class="text-xs text-slate-400">ID: ...${item.id.slice(-4)}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <i data-lucide="check-circle" class="w-3 h-3 mr-1"></i>
                    Paid (ToyyibPay)
                </span>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm font-medium text-slate-700">${item.timeSlot}</p>
                <p class="text-xs text-slate-400">${item.bookingDate}</p>
            </td>
            <td class="px-6 py-4 font-mono text-sm font-bold text-slate-700">
                RM ${parseFloat(item.totalCost || 0).toFixed(2)}
            </td>
            <td class="px-6 py-4 text-right">
                <span class="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded select-all">
                    ${item.billCode || item.paymentRef || 'N/A'}
                </span>
            </td>
        `;
        bookingsList.appendChild(row);
    });
    
    if(window.lucide) lucide.createIcons();
}

function updateStats(total, guests, revenue) {
    statToday.innerText = total;
    statGuests.innerText = guests;
    statRevenue.innerText = `RM ${revenue.toFixed(2)}`;
}

// 4. Analytics Chart
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
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#0d9488', 
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#0d9488',
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

function updateChart(data) {
    // Basic visualization logic (Simulated for demo)
    const simulatedData = [10, 30, 45, 20, 60, 80, 40].map(x => x * (data.length > 0 ? 1 : 0));
    revenueChart.data.datasets[0].data = simulatedData;
    revenueChart.update();
}

// 5. Toast System
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

// 6. Event Listeners
filterDateInput.addEventListener('change', (e) => setupRealtimeListener(e.target.value));

document.getElementById('btn-refresh').onclick = () => {
    setupRealtimeListener(filterDateInput.value);
    showToast("Dashboard Refreshed");
};

// Logout
document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => window.location.href = 'index.html');
};