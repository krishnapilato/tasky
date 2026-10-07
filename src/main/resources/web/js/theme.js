const systemDark = matchMedia('(prefers-color-scheme: dark)');

globalThis.applyTheme = (choice = localStorage.getItem('tasky.theme')) => {
    const dark = choice === 'dark' || (choice !== 'light' && systemDark.matches);
    document.documentElement.dataset.bsTheme = dark ? 'dark' : 'light';
};

systemDark.addEventListener('change', () => applyTheme());
applyTheme();
