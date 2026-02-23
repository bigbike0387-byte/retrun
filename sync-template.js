/**
 * sync-template.js - มาตรฐานการ Sync และ Notification เสียง
 * ใช้ร่วมกันทุกหน้าเพื่อให้ทำงานได้เหมือนกัน 100%
 */

const AUDIO_ALERTS = {
    order: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    ready: 'https://assets.mixkit.co/active_storage/sfx/598/598-preview.mp3',
    message: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3',
    call: 'https://assets.mixkit.co/active_storage/sfx/1077/1077-preview.mp3'
};

let lastKnownNotiId = 0;

function setupCommonSync(role, table, renderFn) {
    // 1. Initialize System
    initKruaSystem(() => {
        renderFn();
        checkNewNotifications(role, table);
    });

    // 2. Initial Render
    renderFn();

    // 3. Mark last noti so we don't alert old ones
    const notis = getNotificationsByRole(role, table);
    if (notis.length > 0) lastKnownNotiId = notis[0].id;
}

function checkNewNotifications(role, table) {
    const notis = getNotificationsByRole(role, table).filter(n => !n.read && n.id > lastKnownNotiId);

    if (notis.length > 0) {
        lastKnownNotiId = notis[0].id;
        const latest = notis[0];

        // Play Sound
        if (AUDIO_ALERTS[latest.type]) {
            const audio = new Audio(AUDIO_ALERTS[latest.type]);
            audio.play().catch(e => console.warn('Audio play blocked'));
        }

        // Optional: Show browser notification or Toast
        console.log(`[Notification] ${latest.message}`);
    }
}

// Helper to auto-scroll chat
function scrollToBottom(id) {
    const el = document.getElementById(id);
    if (el) el.scrollTop = el.scrollHeight;
}
