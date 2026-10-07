const THEME = 'tasky.theme';
const FOCUS = 'tasky.focus.length';

export const theme = () => localStorage.getItem(THEME) ?? 'system';

export const setTheme = choice => {
    if (choice === 'system') localStorage.removeItem(THEME);
    else localStorage.setItem(THEME, choice);
    applyTheme();
};

export const focusLength = () => Number(localStorage.getItem(FOCUS) ?? 25);

export const setFocusLength = minutes => localStorage.setItem(FOCUS, minutes);
