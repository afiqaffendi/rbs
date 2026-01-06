// 3. Logic: Generate Time Slots based on Operating Hours
function generateTimeSlots(operatingHours) {
    // Helper: "9:00 AM" -> 540 minutes
    const parseTime = (t) => {
        const [time, modifier] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        
        if (hours === 12) hours = 0; // 12:00 AM -> 0
        if (modifier === 'PM') hours += 12; // 1:00 PM -> 13
        
        return hours * 60 + minutes;
    };

    // Helper: 540 -> "9:00 AM"
    const formatTime = (m) => {
        let h = Math.floor(m / 60);
        let mm = m % 60;
        let amp = h >= 12 ? 'PM' : 'AM';
        
        // Convert back to 12-hour format
        h = h % 12;
        if (h === 0) h = 12; 
        
        return `${h}:${mm.toString().padStart(2, '0')} ${amp}`;
    };

    const [startStr, endStr] = operatingHours.split(' - ');
    let startMin = parseTime(startStr);
    let endMin = parseTime(endStr);

    // FIX: If End Time is less than or equal to Start Time, add 24 hours (1440 mins)
    // Example: "12:00 AM - 12:00 AM" becomes 0 to 1440
    if (endMin <= startMin) {
        endMin += 1440; 
    }
    
    let slots = [];
    const slotDuration = 120; // 2 hours

    // Loop through the time
    while (startMin + slotDuration <= endMin) {
        // Handle "Next Day" formatting if needed (times > 24 hours)
        let displayStart = startMin % 1440;
        let displayEnd = (startMin + slotDuration) % 1440;

        let slotStr = `${formatTime(displayStart)} - ${formatTime(displayEnd)}`;
        slots.push(slotStr);
        
        startMin += slotDuration;
    }
    return slots;
}