// Global Mouse Click Ripple Effect (Pixel Burst)
document.addEventListener('click', function(e) {
    let ripple = document.createElement('div');
    ripple.classList.add('ripple');
    ripple.style.left = `${e.clientX - 10}px`;
    ripple.style.top = `${e.clientY - 10}px`;
    document.body.appendChild(ripple);
    setTimeout(() => { ripple.remove(); }, 600);
});

// Loader helper
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('loader-hide');
        setTimeout(() => loader.remove(), 600);
    }
}

const loaderSafetyTimer = setTimeout(hideLoader, 8000);

let globalDocs = [];
let isAdminUser = false;

// Load Documents
async function loadDocuments(pin) {
    try {
        const url = pin ? `/api/documents?pin=${encodeURIComponent(pin)}` : '/api/documents';
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error('Unauthorized');
        }
        globalDocs = await res.json();
        applyFilters();
        return true;
    } catch (error) {
        console.error('Error fetching docs', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('document-grid');
    const pinModal = document.getElementById('pinModal');
    const verifyPinBtn = document.getElementById('verifyPinBtn');
    const pinDigits = Array.from(document.querySelectorAll('.pin-digit'));
    const pinErrorMsg = document.getElementById('pinErrorMsg');

    if (!grid || !pinModal) return;

    // Check Admin status on load to allow bypass
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        isAdminUser = res.ok && data.isAuthenticated;
    } catch (e) {
        // ignore
    }

    let unlocked = false;

    if (isAdminUser) {
        unlocked = await loadDocuments(null);
    } else {
        const savedPin = sessionStorage.getItem('docVaultPin');
        if (savedPin) {
            unlocked = await loadDocuments(savedPin);
            if (!unlocked) {
                sessionStorage.removeItem('docVaultPin');
            }
        }
    }

    // Hide main page loader after check finishes
    clearTimeout(loaderSafetyTimer);
    hideLoader();

    if (unlocked) {
        pinModal.classList.add('hidden');
    } else {
        // Show lock screen and focus first input
        openPinModal();
    }

    // Intercept click on document View / Download links
    grid.addEventListener('click', function(e) {
        const anchor = e.target.closest('.doc-actions a');
        if (!anchor) return;

        if (isAdminUser) {
            return; // Admin bypass
        }

        const savedPin = sessionStorage.getItem('docVaultPin');
        if (savedPin) {
            e.preventDefault();
            navigateWithPin(anchor, savedPin);
        } else {
            e.preventDefault();
            openPinModal();
        }
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
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 0) {
                e.target.value = value.charAt(value.length - 1);
                if (idx < pinDigits.length - 1) {
                    pinDigits[idx + 1].focus();
                }
            }
        });

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

        input.addEventListener('focus', () => {
            input.select();
        });

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
                // Try to load documents with the newly verified PIN
                const loadSuccess = await loadDocuments(pin);
                if (loadSuccess) {
                    sessionStorage.setItem('docVaultPin', pin);
                    pinModal.classList.add('hidden');
                } else {
                    showError('Failed to load documents.');
                }
            } else {
                showError(data.error || 'Incorrect PIN.');
            }
        } catch (err) {
            showError('Connection error. Try again.');
        } finally {
            verifyPinBtn.disabled = false;
            verifyPinBtn.textContent = 'Verify & Unlock';
        }
    });

    function showError(msg) {
        pinErrorMsg.textContent = msg;
        pinErrorMsg.classList.remove('hidden');
        pinDigits.forEach(input => input.value = '');
        pinDigits[0].focus();
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
    const sizeVal = document.getElementById('sizeFilter').value;

    let minKb = 0, maxKb = Infinity;
    if (sizeVal !== 'all') {
        const parts = sizeVal.split('-');
        minKb = parseFloat(parts[0]);
        maxKb = parseFloat(parts[1]);
    }

    let filtered = globalDocs.filter(doc => {
        if (!doc.title.toLowerCase().includes(searchTerm)) return false;
        if (sizeVal !== 'all' && doc.type === 'file') {
            const docKb = Number(doc.size) / 1024;
            if (docKb < minKb || docKb > maxKb) return false;
        }
        return true;
    });

    if (sizeVal !== 'all') {
        filtered.sort((a, b) => {
            const sizeA = Number(a.size) || 0;
            const sizeB = Number(b.size) || 0;
            return sizeB - sizeA;
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
