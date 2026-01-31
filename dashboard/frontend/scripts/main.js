document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MAIN] Initializing Dashboard...');



    try {
        await window.router.init();
    } catch (err) {
        console.error('[MAIN] Router init failed:', err);
    }
});