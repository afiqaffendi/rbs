// js/toast.js

export function showToast(message, type = 'success') {
    // 1. ROBUST SELECTOR: Find the main app container (The "Phone")
    // We search for the container that has 'relative' and 'shadow-2xl' classes.
    // This is more reliable than looking for the width class.
    let mobileFrame = document.querySelector('.relative.shadow-2xl');
    
    // Fallback: If not found, try searching for the main body wrapper
    if (!mobileFrame) {
        mobileFrame = document.querySelector('.h-screen.overflow-hidden.relative');
    }

    // 2. Get or Create Container
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        
        if (mobileFrame) {
            // --- MOBILE VIEW MODE ---
            // 'absolute': Stays strictly inside the phone frame
            // 'bottom-24': Positions it above the navigation bar (approx 6rem/96px up)
            // 'left-4 right-4': Ensures it has some padding from the screen edges
            // 'z-[100]': Ensures it appears above everything else (modals, nav bars)
            // 'flex-col-reverse': New notifications stack upwards from the bottom
            container.className = 'absolute bottom-24 left-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none';
            mobileFrame.appendChild(container); // CRITICAL: Append to the Phone, not the Body
        } else {
            // --- DESKTOP / FALLBACK MODE ---
            // If we really can't find the phone frame, put it in the corner of the window
            container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }
    }

    // 3. Define Styles based on Type
    // Success = Dark Slate (matches app theme), Error = Red
    const bgClass = type === 'success' ? 'bg-slate-900' : 'bg-red-500';
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';

    // 4. Create Toast Element
    const toast = document.createElement('div');
    // Added 'backdrop-blur-md' and 'border-white/10' for a premium glassmorphism feel
    toast.className = `${bgClass} text-white px-4 py-3 rounded-xl shadow-lg border border-white/10 flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto backdrop-blur-md`;
    
    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-5 h-5 shrink-0 text-white/90"></i>
        <span class="font-bold text-xs leading-tight tracking-wide">${message}</span>
    `;

    // 5. Add to Container
    container.appendChild(toast);

    // 6. Initialize Icon
    if (window.lucide) window.lucide.createIcons();

    // 7. Animate In (Slide Up effect)
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });

    // 8. Auto Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0'); // Slide Down out of view
        setTimeout(() => {
            toast.remove();
            // Cleanup container if empty to keep DOM clean
            if (container.childNodes.length === 0) {
                container.remove();
            }
        }, 300);
    }, 3000);
}