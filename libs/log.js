function log(message) {
    // Create log div if not exists
    let logDiv = document.getElementById('logDiv');
    if (!logDiv) {
        logDiv = document.createElement('div');
        logDiv.id = 'logDiv';
        logDiv.style.position = 'fixed';
        logDiv.style.bottom = '10px';
        logDiv.style.right = '10px';
        logDiv.style.padding = '10px';
        logDiv.style.backgroundColor = '#f0f0f0';
        logDiv.style.border = '1px solid #ccc';
        document.body.appendChild(logDiv);
    }

    // Append message to log div
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logDiv.appendChild(logEntry);
}

function resetLog() {
    const logDiv = document.getElementById('logDiv');
    if (logDiv) {
        logDiv.innerHTML = '';
    }
}