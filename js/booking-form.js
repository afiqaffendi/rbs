import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- DOM Elements ---
const headerTitle = document.querySelector('#restaurant-header h1');
const headerDesc = document.querySelector('#restaurant-header p');
const dateInput = document.getElementById('booking-date');
const timeSlotSelect = document.getElementById('time-slot');
const paxInput = document.getElementById('pax');
const statusMsg = document.getElementById('availability-status');
const waitTimeBox = document.getElementById('waiting-time-box');
const waitTimeDisplay = document.getElementById('wait-time-display');
const menuList = document.getElementById('menu-list');
const proceedBtn = document.getElementById('proceed-btn');

// --- Global Variables ---
let currentRestaurant = null; // Stores capacity, hours, etc.
let restaurantId = new URLSearchParams(window.location.search).get('id');
let selectedMenu = []; // Stores user's food choices

// 1. Check Login & Load Restaurant Data
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

// 2. Load Restaurant Details from Firestore
async function loadRestaurantData(id) {
    try {
        const docRef = doc(db, "restaurants", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurant = docSnap.data();
            
            // Update UI
            headerTitle.innerText = currentRestaurant.name;
            headerDesc.innerText = `Operating Hours: ${currentRestaurant.operatingHours} | Max Capacity: ${currentRestaurant.capacity} pax`;
            
            // Load Menu
            renderMenu(currentRestaurant.menu || []);
            
            // Set Date Picker constraints (Disable past dates)
            const today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', today);

        } else {
            alert("Restaurant not found!");
        }
    } catch (error) {
        console.error("Error loading details:", error);
    }
}

// 3. Logic: Generate Time Slots based on Operating Hours
function generateTimeSlots(operatingHours) {
    // Helper: "9:00 AM" -> 540 minutes
    const parseTime = (t) => {
        const [time, modifier] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (hours === 12) hours = 0;
        if (modifier === 'PM') hours += 12;
        return hours * 60 + minutes;
    };

    // Helper: 540 -> "9:00 AM"
    const formatTime = (m) => {
        let h = Math.floor(m / 60);
        let mm = m % 60;
        let amp = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mm.toString().padStart(2, '0')} ${amp}`;
    };

    const [startStr, endStr] = operatingHours.split(' - ');
    let startMin = parseTime(startStr);
    let endMin = parseTime(endStr);
    
    let slots = [];
    // Loop every 120 minutes (2 hours)
    while (startMin + 120 <= endMin) {
        let slotStr = `${formatTime(startMin)} - ${formatTime(startMin + 120)}`;
        slots.push(slotStr);
        startMin += 120;
    }
    return slots;
}

// 4. Event Listener: When User Picks a Date
dateInput.addEventListener('change', () => {
    if (!currentRestaurant) return;

    const slots = generateTimeSlots(currentRestaurant.operatingHours);
    
    // Reset Dropdown
    timeSlotSelect.innerHTML = '<option value="">-- Select Time Slot --</option>';
    slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.innerText = slot;
        timeSlotSelect.appendChild(option);
    });
    
    timeSlotSelect.disabled = false;
});

// 5. Event Listener: When User Picks a Slot (Check Availability)
timeSlotSelect.addEventListener('change', async () => {
    const selectedDate = dateInput.value;
    const selectedSlot = timeSlotSelect.value;
    const requestedPax = parseInt(paxInput.value);

    if (!selectedSlot || !selectedDate) return;

    statusMsg.innerText = "Checking availability...";
    statusMsg.style.color = "blue";
    proceedBtn.disabled = true;
    waitTimeBox.style.display = "none";

    // Query Firestore for EXISTING bookings
    const q = query(
        collection(db, "bookings"),
        where("restaurantId", "==", restaurantId),
        where("bookingDate", "==", selectedDate),
        where("timeSlot", "==", selectedSlot),
        where("status", "in", ["confirmed", "pending_verification"]) // Count pending too so we don't overbook
    );

    const snapshot = await getDocs(q);
    
    // Sum up occupied pax
    let occupiedPax = 0;
    snapshot.forEach(doc => {
        occupiedPax += doc.data().pax;
    });

    const totalPax = occupiedPax + requestedPax;

    if (totalPax <= currentRestaurant.capacity) {
        // SUCCESS: Slot Available
        statusMsg.innerText = `✅ Available! (${currentRestaurant.capacity - occupiedPax} seats left)`;
        statusMsg.style.color = "green";
        proceedBtn.disabled = false;
    } else {
        // FAIL: Slot Full
        statusMsg.innerText = "❌ Slot Fully Booked";
        statusMsg.style.color = "red";
        
        // Calculate Waiting Time Logic
        // Logic: 1 Full Slot = 2 Hours wait.
        // In a real app, you'd check how many consecutive slots are full.
        // For simplicity here, we assume if THIS slot is full, wait time is 2 hours.
        waitTimeDisplay.innerText = "2 Hours (Next Slot)";
        waitTimeBox.style.display = "block";
    }
});

// 6. Render Menu Function
function renderMenu(menuItems) {
    menuList.innerHTML = '';
    menuItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.classList.add('menu-item');
        div.innerHTML = `
            <input type="checkbox" id="menu-${index}" value="${index}">
            <label for="menu-${index}">
                <strong>${item.name}</strong> - RM ${item.price}
            </label>
        `;
        menuList.appendChild(div);

        // Add click listener for checkboxes
        div.querySelector('input').addEventListener('change', updateSummary);
    });
}

// 7. Update Summary (Total Cost)
function updateSummary() {
    selectedMenu = [];
    let totalCost = 0;
    
    // Loop through checkboxes
    const checkboxes = menuList.querySelectorAll('input[type="checkbox"]:checked');
    
    checkboxes.forEach(box => {
        const item = currentRestaurant.menu[box.value];
        selectedMenu.push(item);
        totalCost += parseFloat(item.price); // Assuming price is stored as number or string number
    });

    document.getElementById('total-items').innerText = selectedMenu.length;
    document.getElementById('total-cost').innerText = totalCost.toFixed(2);
}

// 8. Proceed Button (Save to Session Storage & Go to Payment)
proceedBtn.addEventListener('click', () => {
    const bookingData = {
        restaurantId: restaurantId,
        restaurantName: currentRestaurant.name,
        date: dateInput.value,
        timeSlot: timeSlotSelect.value,
        pax: paxInput.value,
        menuItems: selectedMenu,
        totalCost: document.getElementById('total-cost').innerText
    };

    // Save temporary data to browser session
    sessionStorage.setItem('tempBooking', JSON.stringify(bookingData));
    
    // Go to Payment Page
    window.location.href = 'payment.html';
});