import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- State ---
let currentRestaurant = null;
let restaurantId = new URLSearchParams(window.location.search).get('id');
let selectedDate = null;
let selectedTime = null;
let pax = 2;

// --- Elements ---
const paxDisplay = document.getElementById('pax-display');
const dateInput = document.getElementById('date-picker');
const slotsContainer = document.getElementById('slots-container');
const availabilityMsg = document.getElementById('availability-msg');
const summaryText = document.getElementById('summary-text');
const bookBtn = document.getElementById('book-btn');
const resNameEl = document.getElementById('res-name');
const resAddrEl = document.getElementById('res-address');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if(window.lucide) lucide.createIcons();
    
    // Set Minimum Date to Today
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else if (restaurantId) {
        await loadRestaurantData(restaurantId);
    } else {
        alert("No restaurant selected!");
        window.location.href = 'customer-home.html';
    }
});

// --- Functions ---

async function loadRestaurantData(id) {
    try {
        const docRef = doc(db, "restaurants", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurant = docSnap.data();
            resNameEl.innerText = currentRestaurant.name;
            resAddrEl.innerText = currentRestaurant.address || "Location info unavailable";
        } else {
            resNameEl.innerText = "Restaurant Not Found";
        }
    } catch (error) {
        console.error("Error loading restaurant:", error);
    }
}

// Global scope for HTML button access
window.updatePax = (change) => {
    if (pax + change >= 1 && pax + change <= 20) {
        pax += change;
        paxDisplay.innerText = pax;
        // Re-check availability if a slot is already selected
        if(selectedTime) checkAvailability(selectedTime);
    }
};

dateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    selectedTime = null; // Reset time when date changes
    renderTimeSlots();
    updateSummary();
});

function generateTimeSlots(operatingHours) {
    // Basic parser: "09:00 AM - 10:00 PM"
    const parseTime = (t) => {
        const [time, modifier] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (hours === 12) hours = 0;
        if (modifier === 'PM') hours += 12;
        return hours * 60 + minutes;
    };

    const formatTime = (m) => {
        let h = Math.floor(m / 60);
        let mm = m % 60;
        let amp = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mm.toString().padStart(2, '0')} ${amp}`;
    };

    if(!operatingHours) return [];
    
    const [startStr, endStr] = operatingHours.split(' - ');
    let startMin = parseTime(startStr);
    let endMin = parseTime(endStr);
    
    let slots = [];
    // 2-hour intervals
    while (startMin + 120 <= endMin) {
        slots.push(formatTime(startMin));
        startMin += 60; // Show slots every hour
    }
    return slots;
}

function renderTimeSlots() {
    slotsContainer.innerHTML = '';
    bookBtn.disabled = true;
    availabilityMsg.classList.add('hidden');

    if (!selectedDate || !currentRestaurant) return;

    const slots = generateTimeSlots(currentRestaurant.operatingHours);

    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.className = `
            py-3 px-2 rounded-xl text-sm font-bold border transition-all
            ${selectedTime === time 
                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600'}
        `;
        btn.innerText = time;
        btn.onclick = () => {
            selectedTime = time;
            renderTimeSlots();
            checkAvailability(time);
        };
        slotsContainer.appendChild(btn);
    });
}

async function checkAvailability(timeSlot) {
    updateSummary();
    bookBtn.disabled = true;
    bookBtn.innerText = "Checking...";
    availabilityMsg.classList.add('hidden');

    try {
        const q = query(
            collection(db, "bookings"),
            where("restaurantId", "==", restaurantId),
            where("bookingDate", "==", selectedDate),
            where("timeSlot", "==", timeSlot),
            where("status", "in", ["confirmed", "pending"])
        );

        const snapshot = await getDocs(q);
        let occupiedPax = 0;
        snapshot.forEach(doc => occupiedPax += doc.data().pax);

        if ((occupiedPax + pax) <= (currentRestaurant.capacity || 50)) {
            bookBtn.disabled = false;
            bookBtn.innerText = "Confirm Reservation";
        } else {
            bookBtn.disabled = true;
            bookBtn.innerText = "Slot Full";
            availabilityMsg.classList.remove('hidden');
        }

    } catch (e) {
        console.error(e);
        bookBtn.innerText = "Error Checking";
    }
}

function updateSummary() {
    if (selectedDate && selectedTime) {
        summaryText.innerText = `${selectedDate} @ ${selectedTime}`;
    } else {
        summaryText.innerText = "-- / --";
    }
}

// FIX: Ensure totalCost and menuItems are always saved
window.handleBooking = () => {
    const bookingData = {
        restaurantId: restaurantId,
        restaurantName: currentRestaurant.name,
        date: selectedDate,
        timeSlot: selectedTime,
        pax: pax,
        deposit: 50.00,
        totalCost: 50.00, // <--- Added this
        menuItems: []     // <--- Added this
    };
    
    sessionStorage.setItem('tempBooking', JSON.stringify(bookingData));
    window.location.href = 'payment.html'; 
};