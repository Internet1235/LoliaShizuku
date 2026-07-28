export interface AccentPreset {
    id: string
    name: string
    light: string
    dark: string
}

export const accentPresets: AccentPreset[] = [
    { id: 'pink', name: '樱粉', light: '#F06292', dark: '#F491B2' },
    { id: 'blue', name: '天蓝', light: '#1E88E5', dark: '#64B5F6' },
    { id: 'purple', name: '雅紫', light: '#7E57C2', dark: '#B39DDB' },
    { id: 'teal', name: '青碧', light: '#00897B', dark: '#4DB6AC' },
    { id: 'orange', name: '暖橙', light: '#FB8C00', dark: '#FFB74D' },
    { id: 'green', name: '草绿', light: '#43A047', dark: '#81C784' },
    { id: 'red', name: '绯红', light: '#E53935', dark: '#EF5350' },
]

export const defaultAccentId = 'pink'
export const accentStorageKey = 'lolia.accent'

export const findAccentPreset = (id: string): AccentPreset =>
    accentPresets.find((preset) => preset.id === id) ??
    accentPresets.find((preset) => preset.id === defaultAccentId) ??
    accentPresets[0]

export const readSavedAccentId = (): string => {
    try {
        const saved = localStorage.getItem(accentStorageKey)
        if (saved && accentPresets.some((preset) => preset.id === saved)) {
            return saved
        }
    } catch {
        // ignore localStorage errors
    }
    return defaultAccentId
}

export const saveAccentId = (id: string): void => {
    try {
        localStorage.setItem(accentStorageKey, id)
    } catch {
        // ignore localStorage errors
    }
}

export const applyAccentColors = (id: string): void => {
    const preset = findAccentPreset(id)
    const dark = document.body.getAttribute('theme-mode') === 'dark'
    const color = dark ? preset.dark : preset.light
    document.documentElement.style.setProperty('--app-accent', color)
    document.documentElement.style.setProperty('--semi-color-primary', color)
}
