const saved = localStorage.getItem('tasky.theme');
const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

document.documentElement.dataset.bsTheme = dark ? 'dark' : 'light';
