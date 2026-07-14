// Global Mouse Click Ripple Effect (Pixel Burst)
// Uses clientX/Y with position:fixed so scroll position doesn't offset it
document.addEventListener('click', function(e) {
    let ripple = document.createElement('div');
    ripple.classList.add('ripple');
    ripple.style.left = `${e.clientX - 10}px`;
    ripple.style.top = `${e.clientY - 10}px`;
    document.body.appendChild(ripple);
    setTimeout(() => { ripple.remove(); }, 600);
});

// Loader helper — called after docs are rendered (or on error)
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('loader-hide');
        setTimeout(() => loader.remove(), 600);
    }
}

// Safety fallback: hide loader after 8s no matter what
const loaderSafetyTimer = setTimeout(hideLoader, 8000);

// Load Documents on Homepage
let globalDocs = [];

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('document-grid');
    if (!grid) return;

    try {
        const res = await fetch('/api/documents');
        globalDocs = await res.json();
        applyFilters(); // ← respects any pre-selected filter AND applies size sort
    } catch (error) {
        console.error('Error fetching docs', error);
    } finally {
        // Hide loader only after docs are rendered (success or error)
        clearTimeout(loaderSafetyTimer);
        hideLoader();
    }

    const searchInput = document.getElementById('searchInput');
    const sizeFilter = document.getElementById('sizeFilter');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput && sizeFilter) {
        searchInput.addEventListener('input', applyFilters);
        sizeFilter.addEventListener('change', applyFilters);
        if(searchBtn) searchBtn.addEventListener('click', applyFilters);
    }
});

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sizeVal = document.getElementById('sizeFilter').value; // "all" | "1-20" | "21-50" etc.

    // Parse the range from the value string (e.g. "21-50" → minKb=21, maxKb=50)
    let minKb = 0, maxKb = Infinity;
    if (sizeVal !== 'all') {
        const parts = sizeVal.split('-');
        minKb = parseFloat(parts[0]);
        maxKb = parseFloat(parts[1]);
    }

    let filtered = globalDocs.filter(doc => {
        // Search filter
        if (!doc.title.toLowerCase().includes(searchTerm)) return false;

        // Size range filter — only applies to file type, not URLs
        if (sizeVal !== 'all' && doc.type === 'file') {
            const docKb = Number(doc.size) / 1024;
            if (docKb < minKb || docKb > maxKb) return false;
        }

        return true;
    });

    // When a range is active: sort highest KB first → lowest KB last
    if (sizeVal !== 'all') {
        filtered.sort((a, b) => {
            const sizeA = Number(a.size) || 0;
            const sizeB = Number(b.size) || 0;
            return sizeB - sizeA; // e.g. 97.1 KB before 82.4 KB
        });
    }

    renderDocs(filtered);
}

function renderDocs(docs) {
    const grid = document.getElementById('document-grid');
    grid.innerHTML = '';

    if (docs.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem; font-family: 'VT323', monospace; font-size: 1.2rem;">[ NO DATA FOUND ]</div>`;
        return;
    }

    docs.forEach((doc, index) => {
        const card = document.createElement('div');
        card.classList.add('doc-card');
        card.style.animationDelay = `${(index % 10) * 0.1}s`;

        // Determine file icon based on mimeType or originalName extension
        let iconClass = 'fa-solid fa-file';
        let iconBgClass = '';
        if (doc.type === 'url') {
            iconClass = 'fa-solid fa-link';
            iconBgClass = 'url-icon';
        } else {
            const mime = (doc.mimeType || '').toLowerCase();
            const ext = ((doc.originalName || '').split('.').pop() || '').toLowerCase();
            if (mime === 'application/pdf' || ext === 'pdf') {
                iconClass = 'fa-solid fa-file-pdf';
            } else if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) {
                iconClass = 'fa-solid fa-file-image';
            } else if (mime.startsWith('video/') || ['mp4','mov','avi','mkv','webm'].includes(ext)) {
                iconClass = 'fa-solid fa-file-video';
            } else if (mime.startsWith('audio/') || ['mp3','wav','ogg','flac'].includes(ext)) {
                iconClass = 'fa-solid fa-file-audio';
            } else if (['doc','docx','odt'].includes(ext) || mime.includes('word')) {
                iconClass = 'fa-solid fa-file-word';
            } else if (['xls','xlsx','csv','ods'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) {
                iconClass = 'fa-solid fa-file-excel';
            } else if (['ppt','pptx','odp'].includes(ext) || mime.includes('powerpoint') || mime.includes('presentation')) {
                iconClass = 'fa-solid fa-file-powerpoint';
            } else if (['zip','rar','7z','tar','gz'].includes(ext)) {
                iconClass = 'fa-solid fa-file-zipper';
            } else if (['js','ts','html','css','py','java','c','cpp','json','xml','sh'].includes(ext) || mime.includes('text')) {
                iconClass = 'fa-solid fa-file-code';
            } else {
                iconClass = 'fa-solid fa-file';
            }
        }
        
        let sizeText = '';
        if (doc.type === 'file') {
            const mg = doc.size / (1024 * 1024);
            if (mg >= 1) {
                sizeText = ` | ${mg.toFixed(2)} MB`;
            } else {
                sizeText = ` | ${(doc.size / 1024).toFixed(1)} KB`;
            }
        }
        
        card.innerHTML = `
            <div class="doc-header">
                <div class="doc-icon ${iconBgClass}"><i class="${iconClass}"></i></div>
            </div>
            <div class="doc-info">
                <h3>${doc.title}</h3>
                <p>${new Date(doc.createdAt).toLocaleDateString()}${sizeText}</p>
            </div>
            <div class="doc-actions">
                <a href="${doc.fileUrl}" target="_blank" class="btn-primary full-width">View</a>
                ${doc.type === 'file' ? `<a href="${doc.fileUrl}" download="${doc.originalName || 'file'}" class="btn-secondary full-width">Download</a>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// PIN Protection System Front-end controller
let pendingAnchor = null;
let isAdminUser = false;

// Check Admin status on load to allow bypass
async function checkAdminStatus() {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        isAdminUser = res.ok && data.isAuthenticated;
    } catch (e) {
        // ignore
    }
}
checkAdminStatus();

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('document-grid');
    const pinModal = document.getElementById('pinModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const verifyPinBtn = document.getElementById('verifyPinBtn');
    const pinDigits = Array.from(document.querySelectorAll('.pin-digit'));
    const pinErrorMsg = document.getElementById('pinErrorMsg');

    if (!grid || !pinModal) return;

    // Intercept click on document View / Download links
    grid.addEventListener('click', function(e) {
        const anchor = e.target.closest('.doc-actions a');
        if (!anchor) return;

        // Admin bypass
        if (isAdminUser) {
            return; // Let default action proceed
        }

        const savedPin = sessionStorage.getItem('docVaultPin');
        if (savedPin) {
            // Append pin to URL and navigate
            e.preventDefault();
            navigateWithPin(anchor, savedPin);
            return;
        }

        // Prompt for PIN
        e.preventDefault();
        pendingAnchor = anchor;
        openPinModal();
    });

    function navigateWithPin(anchor, pin) {
        const targetUrl = new URL(anchor.href, window.location.origin);
        targetUrl.searchParams.set('pin', pin);

        const tempLink = document.createElement('a');
        tempLink.href = targetUrl.toString();
        
        if (anchor.hasAttribute('download')) {
            tempLink.setAttribute('download', anchor.getAttribute('download') || 'file');
        } else {
            tempLink.target = '_blank';
        }
        
        document.body.appendChild(tempLink);
        tempLink.click();
        tempLink.remove();
    }

    // OTP Inputs navigation
    pinDigits.forEach((input, idx) => {
        // Handle inputting a digit
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            // Only keep last char if they typed something
            if (value.length > 0) {
                e.target.value = value.charAt(value.length - 1);
                if (idx < pinDigits.length - 1) {
                    pinDigits[idx + 1].focus();
                }
            }
        });

        // Handle keys (Backspace to delete/go back, Enter to submit)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (e.target.value === '' && idx > 0) {
                    pinDigits[idx - 1].focus();
                    pinDigits[idx - 1].value = '';
                } else {
                    e.target.value = '';
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                verifyPinBtn.click();
            }
        });

        // Auto-select text on focus for easier overwriting
        input.addEventListener('focus', () => {
            input.select();
        });

        // Handle paste events (e.g. paste '2511')
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d+$/.test(pasteData)) {
                for (let i = 0; i < pinDigits.length; i++) {
                    if (pasteData[i]) {
                        pinDigits[i].value = pasteData[i];
                    }
                }
                pinDigits[Math.min(pasteData.length - 1, pinDigits.length - 1)].focus();
            }
        });
    });

    function openPinModal() {
        pinModal.classList.remove('hidden');
        pinErrorMsg.classList.add('hidden');
        pinDigits.forEach(input => input.value = '');
        setTimeout(() => pinDigits[0].focus(), 100);
    }

    function closePinModal() {
        pinModal.classList.add('hidden');
        pendingAnchor = null;
    }

    closeModalBtn.addEventListener('click', closePinModal);
    pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) closePinModal();
    });

    // Verification Logic
    verifyPinBtn.addEventListener('click', async () => {
        const pin = pinDigits.map(input => input.value).join('');
        if (pin.length !== 4) {
            showError('Please enter a 4-digit PIN.');
            return;
        }

        try {
            verifyPinBtn.disabled = true;
            verifyPinBtn.textContent = 'Verifying...';
            
            const res = await fetch('/api/auth/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            const data = await res.json();
            
            if (res.ok && data.success) {
                sessionStorage.setItem('docVaultPin', pin);
                closePinModal();
                if (pendingAnchor) {
                    navigateWithPin(pendingAnchor, pin);
                }
            } else {
                showError(data.error || 'Incorrect PIN.');
            }
        } catch (err) {
            showError('Connection error. Try again.');
        } finally {
            verifyPinBtn.disabled = false;
            verifyPinBtn.textContent = 'Verify & Open';
        }
    });

    function showError(msg) {
        pinErrorMsg.textContent = msg;
        pinErrorMsg.classList.remove('hidden');
        pinDigits.forEach(input => input.value = '');
        pinDigits[0].focus();
    }
});
