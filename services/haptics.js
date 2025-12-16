// Haptics Service for tactile feedback

export const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Ignore errors on devices that don't support it
        }
    }
};

// Use for standard button clicks (subtle tick)
export const hapticClick = () => {
    vibrate(15);
};

// Use for significant actions like dropping an item (stronger tick)
export const hapticFeedback = () => {
    vibrate(40);
};

// Use for success/bingo (pattern)
export const hapticSuccess = () => {
    vibrate([50, 50, 50, 50, 100]);
};

// Use for errors (buzz)
export const hapticError = () => {
    vibrate([50, 100, 50]);
};
