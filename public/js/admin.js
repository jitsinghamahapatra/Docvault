document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth Status
    try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) {
            window.location.href = '/login';
            return;
        }
    } catch (err) {
        window.location.href = '/login';
        return;
    }

    // Page Loader - hide after admin auth check completes
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('loader-hide');
        setTimeout(() => loader.remove(), 600);
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    });

    // Ripple effect for admin page (position:fixed in CSS so scroll-safe)
    document.addEventListener('click', function(e) {
        let ripple = document.createElement('div');
        ripple.classList.add('ripple');
        ripple.style.left = `${e.clientX - 10}px`;
        ripple.style.top = `${e.clientY - 10}px`;
        document.body.appendChild(ripple);
        setTimeout(() => { ripple.remove(); }, 600);
    });


    // Toast
    window.showToast = function(msg, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        if (!toast) return;
        toastMsg.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }

    // Unified Upload Elements
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const urlInput = document.getElementById('docUrl');
    const urlGroup = document.getElementById('urlGroup');
    const fileFeedback = document.getElementById('fileFeedback');
    const fbName = document.getElementById('fbName');
    const fbSize = document.getElementById('fbSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    let selectedFile = null;

    // Helper: format bytes
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // File Selection Handlers
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length) handleFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
        selectedFile = file;
        fbName.textContent = file.name;
        fbSize.textContent = formatBytes(file.size);
        
        // Hide dropzone & URL input
        dropZone.classList.add('hidden');
        urlGroup.classList.add('hidden');
        fileFeedback.classList.remove('hidden');
        
        // clear URL
        urlInput.value = '';
    }

    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileFeedback.classList.add('hidden');
        dropZone.classList.remove('hidden');
        urlGroup.classList.remove('hidden');
    });

    // Form Submission
    document.getElementById('smartUploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('docName').value.trim();
        const urlVal = urlInput.value.trim();

        if(!selectedFile && !urlVal) {
            return showToast('Please select a file or provide a URL', 'error');
        }

        try {
            if (selectedFile) {
                // --- Duplicate name check ---
                const checkName = title || selectedFile.name;
                const existRes = await fetch('/api/documents');
                const existDocs = await existRes.json();
                const isDuplicate = existDocs.some(d => 
                    d.title.toLowerCase() === checkName.toLowerCase()
                );
                if (isDuplicate) {
                    return showToast(`"${checkName}" already exists! Delete it first or use a different name.`, 'error');
                }

                // Upload with XHR for real-time progress bar
                const formData = new FormData();
                formData.append('file', selectedFile);
                if(title) formData.append('title', title);

                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    const progWrap = document.getElementById('uploadProgressWrap');
                    const progBar  = document.getElementById('uploadProgressBar');
                    const progPct  = document.getElementById('uploadProgressPct');
                    if (progWrap) progWrap.classList.remove('hidden');

                    xhr.upload.addEventListener('progress', (ev) => {
                        if (ev.lengthComputable) {
                            const pct = Math.round((ev.loaded / ev.total) * 100);
                            if (progBar) progBar.style.width = pct + '%';
                            if (progPct) progPct.textContent = pct + '%';
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (progWrap) progWrap.classList.add('hidden');
                        if (progBar) progBar.style.width = '0%';
                        if (xhr.status >= 200 && xhr.status < 300) {
                            showToast('File uploaded successfully! \u2713');
                            document.getElementById('smartUploadForm').reset();
                            removeFileBtn.click();
                            loadDocuments();
                            resolve();
                        } else {
                            let errMsg = 'File upload failed';
                            try { errMsg = JSON.parse(xhr.responseText).error || errMsg; } catch(_) {}
                            showToast(errMsg, 'error');
                            reject(new Error(errMsg));
                        }
                    });

                    xhr.addEventListener('error', () => {
                        if (progWrap) progWrap.classList.add('hidden');
                        showToast('Network error during upload', 'error');
                        reject(new Error('Network error'));
                    });

                    xhr.open('POST', '/api/documents/upload-file');
                    xhr.send(formData);
                });


            } else if (urlVal) {
                // --- Duplicate name check for URL ---
                const checkName = title || urlVal;
                const existRes = await fetch('/api/documents');
                const existDocs = await existRes.json();
                const isDuplicate = existDocs.some(d => 
                    d.title.toLowerCase() === checkName.toLowerCase()
                );
                if (isDuplicate) {
                    return showToast(`"${checkName}" already exists!`, 'error');
                }

                // Upload URL
                const res = await fetch('/api/documents/upload-url', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ title: title || urlVal, url: urlVal })
                });

                if(res.ok) {
                    showToast('URL saved successfully! ✓');
                    document.getElementById('smartUploadForm').reset();
                    loadDocuments();
                } else {
                    showToast('Failed to save URL', 'error');
                }
            }

        } catch(err) {
            showToast('Server error', 'error');
        }
    });

    // Load Documents Table
    async function loadDocuments() {
        const tbody = document.getElementById('adminDocList');
        tbody.innerHTML = '<tr><td colspan="4">Loading data...</td></tr>';
        try {
            const res = await fetch('/api/documents');
            const docs = await res.json();
            
            if(docs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No documents found.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            docs.forEach(doc => {
                let displaySize = doc.type === 'file' ? formatBytes(doc.size) : 'N/A (URL)';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${doc.title}</strong></td>
                    <td><span class="type-badge ${doc.type}">${doc.type.toUpperCase()}</span></td>
                    <td><span style="font-family: 'VT323', monospace;">${displaySize}</span></td>
                    <td class="actions-cell">
                        <a href="${doc.fileUrl}" target="_blank" class="btn-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                        <button class="btn-icon danger delete-btn" data-id="${doc._id}"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if(confirm('Are you sure you want to delete this document?')) {
                        const delRes = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
                        if(delRes.ok) {
                            showToast('Deleted successfully');
                            loadDocuments();
                        } else {
                            showToast('Failed to delete', 'error');
                        }
                    }
                });
            });

        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="4">Failed to load documents.</td></tr>';
        }
        updateStorageStatus();
    }

    async function updateStorageStatus() {
        try {
            const res = await fetch('/api/documents/storage');
            if (!res.ok) return;
            const data = await res.json();
            
            const usedMb = (data.usedBytes / (1024 * 1024)).toFixed(2);
            const totalMb = (data.totalBytes / (1024 * 1024)).toFixed(0);
            
            const storageText = document.getElementById('storageText');
            const storageBar = document.getElementById('storageBar');
            const storagePercentText = document.getElementById('storagePercentText');
            
            if (storageText) storageText.textContent = `${usedMb} MB / ${totalMb} MB Used`;
            if (storageBar) storageBar.style.width = `${data.percentUsed}%`;
            if (storagePercentText) storagePercentText.textContent = `${data.percentUsed}% Used`;
        } catch (err) {
            console.error('Error fetching storage status', err);
        }
    }

    document.getElementById('refreshBtn').addEventListener('click', loadDocuments);
    loadDocuments();

    // Reset Password
    document.getElementById('resetPassForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPass').value;
        const newPassword = document.getElementById('newPass').value;

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if(res.ok) {
                showToast('Password updated');
                document.getElementById('resetPassForm').reset();
            } else {
                showToast(data.error || 'Failed to update password', 'error');
            }
        } catch(err) {
            showToast('Server error', 'error');
        }
    });

    // Change Access PIN
    const changePinForm = document.getElementById('changePinForm');
    if (changePinForm) {
        changePinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('pinAdminPass').value;
            const newPin = document.getElementById('newPin').value;

            try {
                const res = await fetch('/api/auth/change-pin', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ currentPassword, newPin })
                });
                const data = await res.json();
                if(res.ok) {
                    showToast('Access PIN updated successfully! ✓');
                    changePinForm.reset();
                } else {
                    showToast(data.error || 'Failed to update PIN', 'error');
                }
            } catch(err) {
                showToast('Server error', 'error');
            }
        });
    }

});
