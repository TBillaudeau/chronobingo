
// Simple Web Notification Service for PWA

export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    const result = await Notification.requestPermission();
    return result === 'granted';
};

export const sendNotification = (title, body) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        // Only send if document is hidden (user is in another tab or app is backgrounded)
        // OR if we want to notify anyway. Let's send only if hidden generally, but for PWA user might want to know even if screen is off.

        // For now, we trust the browser to handle "do not disturb" or focus modes.
        // On mobile, notifications usually appear even if app is open unless handled.

        try {
            new Notification(title, {
                body: body,
                icon: '/icons/icon-192x192.png', // Assuming you have PWA icons
                vibrate: [200, 100, 200]
            });
        } catch (e) {
            console.error("Notification Error:", e);
        }
    }
};

export const hasNotificationPermission = () => {
    if (typeof window === 'undefined') return false;
    return Notification.permission === 'granted';
}
