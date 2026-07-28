/**
 * NFC Tag Reader & ID Inspector - Core JavaScript Application
 * Supports Web NFC API (`NDEFReader`), Audio Feedback, Simulator Mode, LocalStorage History & Export.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    isWebNFCSupported: 'NDEFReader' in window,
    isScanning: false,
    ndefReader: null,
    controller: null, // AbortController for NDEFReader scan
    audioEnabled: true,
    history: JSON.parse(localStorage.getItem('nfc_scan_history') || '[]'),
    activeTagData: null
  };

  // DOM Elements
  const apiStatusPill = document.getElementById('apiStatusPill');
  const apiStatusText = document.getElementById('apiStatusText');
  const compatibilityBanner = document.getElementById('compatibilityBanner');
  const closeBannerBtn = document.getElementById('closeBannerBtn');

  const scannerSection = document.querySelector('.scanner-section');
  const startScanBtn = document.getElementById('startScanBtn');
  const stopScanBtn = document.getElementById('stopScanBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const scannerStatusLabel = document.getElementById('scannerStatusLabel');
  const scanInstruction = document.getElementById('scanInstruction');

  const resultPlaceholder = document.getElementById('resultPlaceholder');
  const resultDetails = document.getElementById('resultDetails');
  const tagTypeBadge = document.getElementById('tagTypeBadge');
  const scannedTagId = document.getElementById('scannedTagId');
  const copyIdBtn = document.getElementById('copyIdBtn');
  const scannedTime = document.getElementById('scannedTime');
  const scannedRecordCount = document.getElementById('scannedRecordCount');
  const scannedAccess = document.getElementById('scannedAccess');
  const ndefRecordsList = document.getElementById('ndefRecordsList');

  const simForm = document.getElementById('simForm');
  const simTagIdInput = document.getElementById('simTagId');
  const randomIdBtn = document.getElementById('randomIdBtn');
  const simRecordTypeSelect = document.getElementById('simRecordType');
  const simPayloadInput = document.getElementById('simPayload');

  const historyTableBody = document.getElementById('historyTableBody');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const historyCount = document.getElementById('historyCount');
  const historySearchInput = document.getElementById('historySearchInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Initialize App
  init();

  function init() {
    checkWebNFCSupport();
    setupEventListeners();
    generateRandomSimId();
    renderHistoryTable();
  }

  // Check Web NFC Compatibility
  function checkWebNFCSupport() {
    if (state.isWebNFCSupported) {
      apiStatusPill.className = 'status-pill supported';
      apiStatusText.textContent = 'Web NFC API Didukung';
      compatibilityBanner.classList.add('hidden');
    } else {
      apiStatusPill.className = 'status-pill simulated';
      apiStatusText.textContent = 'Mode Simulator (PC/Desktop)';
      compatibilityBanner.classList.remove('hidden');
    }
  }

  // Setup Event Listeners
  function setupEventListeners() {
    closeBannerBtn.addEventListener('click', () => {
      compatibilityBanner.classList.add('hidden');
    });

    toggleAudioBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      toggleAudioBtn.classList.toggle('active', state.audioEnabled);
      showToast(state.audioEnabled ? 'Efek Suara Diaktifkan' : 'Efek Suara Dinonaktifkan');
    });

    startScanBtn.addEventListener('click', startNFCScanning);
    stopScanBtn.addEventListener('click', stopNFCScanning);

    copyIdBtn.addEventListener('click', () => {
      if (state.activeTagData?.id) {
        copyToClipboard(state.activeTagData.id, 'Tag ID berhasil disalin!');
      }
    });

    // Simulator events
    randomIdBtn.addEventListener('click', generateRandomSimId);
    simForm.addEventListener('submit', handleSimulatedScan);

    // History events
    historySearchInput.addEventListener('input', renderHistoryTable);
    exportCsvBtn.addEventListener('click', exportToCSV);
    exportJsonBtn.addEventListener('click', exportToJSON);
    clearHistoryBtn.addEventListener('click', clearHistory);
  }

  // Web NFC Scanning Logic
  async function startNFCScanning() {
    if (!state.isWebNFCSupported) {
      showToast('Browser ini tidak mendukung hardware Web NFC. Gunakan Simulator di bawah.', true);
      return;
    }

    try {
      state.controller = new AbortController();
      state.ndefReader = new NDEFReader();

      await state.ndefReader.scan({ signal: state.controller.signal });
      state.isScanning = true;
      updateScannerUI(true);

      state.ndefReader.addEventListener('readingerror', (event) => {
        showToast('Gagal membaca tag NFC. Coba dekatkan kartu kembali.', true);
      });

      state.ndefReader.addEventListener('reading', ({ message, serialNumber }) => {
        handleNFCReadSuccess(serialNumber, message);
      });

      showToast('Pemindai NFC Aktif! Dekatkan kartu NFC.');
    } catch (error) {
      console.error('NFC Scan error:', error);
      updateScannerUI(false);
      
      if (error.name === 'NotAllowedError') {
        showToast('Izin NFC ditolak oleh pengguna/browser.', true);
      } else {
        showToast(`Gagal memulai NFC: ${error.message || 'Error tidak diketahui'}`, true);
      }
    }
  }

  function stopNFCScanning() {
    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }
    state.isScanning = false;
    updateScannerUI(false);
    showToast('Pemindaian NFC dihentikan.');
  }

  function updateScannerUI(isScanning) {
    scannerSection.classList.toggle('scanning', isScanning);
    startScanBtn.classList.toggle('hidden', isScanning);
    stopScanBtn.classList.toggle('hidden', !isScanning);

    if (isScanning) {
      scannerStatusLabel.textContent = 'Memindai Kartu NFC...';
      scanInstruction.textContent = 'Dekatkan kartu atau tag NFC Anda ke bagian belakang ponsel Anda.';
    } else {
      scannerStatusLabel.textContent = 'Siap Memindai';
      scanInstruction.textContent = 'Tempelkan kartu atau tag NFC Anda di belakang perangkat (HP Android), atau klik tombol di atas untuk memulai.';
    }
  }

  // Process NFC Reading Event
  function handleNFCReadSuccess(serialNumber, ndefMessage) {
    playBeepSound();

    // Standardize UID / Tag ID
    const tagId = serialNumber ? formatHexUID(serialNumber) : generateRandomUID('NFC-');
    const records = parseNDEFRecords(ndefMessage);

    const scanResult = {
      id: tagId,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      recordType: records[0]?.type || 'Standard Tag ID',
      payloadSummary: records[0]?.content || 'Tidak Ada NDEF Payload (Hanya Serial Number)',
      records: records,
      source: 'Hardware Web NFC'
    };

    displayScanResult(scanResult);
    saveToHistory(scanResult);
    showToast(`Kartu NFC Terbaca! ID: ${tagId}`);
  }

  // Simulator Scan Handler
  function handleSimulatedScan(e) {
    e.preventDefault();

    const tagId = simTagIdInput.value.trim().toUpperCase() || generateRandomUID('04:');
    const recordTypeVal = simRecordTypeSelect.value;
    const payloadVal = simPayloadInput.value.trim();

    let recordTypeLabel = 'Text Record';
    let recordContent = payloadVal;

    if (recordTypeVal === 'url') {
      recordTypeLabel = 'URI / Web Link';
    } else if (recordTypeVal === 'employee_id') {
      recordTypeLabel = 'Employee JSON Record';
      recordContent = JSON.stringify({ employeeId: payloadVal, access: 'AUTHORIZED_LEVEL_2', dept: 'ENGINEERING' }, null, 2);
    } else if (recordTypeVal === 'vcard') {
      recordTypeLabel = 'vCard Contact';
      recordContent = `BEGIN:VCARD\nVERSION:3.0\nFN:${payloadVal}\nTEL:+6281234567890\nEND:VCARD`;
    }

    const mockScan = {
      id: tagId,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      recordType: recordTypeLabel,
      payloadSummary: payloadVal,
      records: [
        {
          recordType: recordTypeVal,
          mediaType: recordTypeVal === 'url' ? 'text/uri-list' : 'text/plain',
          content: recordContent
        }
      ],
      source: 'Simulator PC'
    };

    playBeepSound();
    displayScanResult(mockScan);
    saveToHistory(mockScan);
    showToast(`Simulasi Pindai Berhasil! ID: ${tagId}`);
  }

  // Render Result in Inspector Card
  function displayScanResult(data) {
    state.activeTagData = data;

    resultPlaceholder.classList.add('hidden');
    resultDetails.classList.remove('hidden');

    tagTypeBadge.textContent = data.source;
    tagTypeBadge.className = data.source === 'Simulator PC' ? 'badge badge-info' : 'badge';

    scannedTagId.textContent = data.id;
    scannedTime.textContent = data.formattedTime;
    scannedRecordCount.textContent = `${data.records.length} Record`;
    scannedAccess.textContent = 'Read Only / Active';

    // Render NDEF Payload items
    ndefRecordsList.innerHTML = '';
    if (data.records.length === 0) {
      ndefRecordsList.innerHTML = `<div class="record-card"><p class="record-content">Tidak ada payload NDEF tercatat pada tag ini.</p></div>`;
    } else {
      data.records.forEach((rec, idx) => {
        const item = document.createElement('div');
        item.className = 'record-card';
        item.innerHTML = `
          <div class="record-header">
            <span>Record #${idx + 1} (${rec.mediaType || 'text/plain'})</span>
            <span class="record-type">${rec.recordType || 'Text'}</span>
          </div>
          <pre class="record-content">${escapeHTML(rec.content)}</pre>
        `;
        ndefRecordsList.appendChild(item);
      });
    }
  }

  // NDEF Record Parser Helper
  function parseNDEFRecords(ndefMessage) {
    if (!ndefMessage || !ndefMessage.records) return [];

    return Array.from(ndefMessage.records).map((record) => {
      let content = '';
      const textDecoder = new TextDecoder(record.encoding || 'utf-8');

      if (record.recordType === 'text') {
        content = textDecoder.decode(record.data);
      } else if (record.recordType === 'url') {
        content = textDecoder.decode(record.data);
      } else if (record.data) {
        content = textDecoder.decode(record.data);
      } else {
        content = '[Binary Data]';
      }

      return {
        recordType: record.recordType,
        mediaType: record.mediaType || 'text/plain',
        content: content
      };
    });
  }

  // History & Storage Logic
  function saveToHistory(item) {
    state.history.unshift(item);
    // Keep top 100 history items
    if (state.history.length > 100) state.history.pop();

    localStorage.setItem('nfc_scan_history', JSON.stringify(state.history));
    renderHistoryTable();
  }

  function renderHistoryTable() {
    const query = historySearchInput.value.toLowerCase().trim();
    const filtered = state.history.filter(item => 
      item.id.toLowerCase().includes(query) || 
      item.payloadSummary.toLowerCase().includes(query) ||
      item.recordType.toLowerCase().includes(query)
    );

    historyCount.textContent = `${state.history.length} Kartu`;
    historyTableBody.innerHTML = '';

    if (filtered.length === 0) {
      emptyHistoryMsg.classList.remove('hidden');
    } else {
      emptyHistoryMsg.classList.add('hidden');

      filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td class="tag-id-cell">${item.id}</td>
          <td><span class="badge">${item.recordType}</span></td>
          <td>${escapeHTML(item.payloadSummary)}</td>
          <td><small>${item.formattedTime}</small></td>
          <td>
            <button class="btn btn-sm btn-outline copy-row-btn" data-id="${item.id}" title="Salin ID">
              <i class="fa-regular fa-copy"></i>
            </button>
          </td>
        `;

        tr.querySelector('.copy-row-btn').addEventListener('click', () => {
          copyToClipboard(item.id, `ID ${item.id} disalin!`);
        });

        historyTableBody.appendChild(tr);
      });
    }
  }

  function clearHistory() {
    if (state.history.length === 0) return;

    if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat pemindaian?')) {
      state.history = [];
      localStorage.removeItem('nfc_scan_history');
      renderHistoryTable();
      showToast('Riwayat pemindaian telah dibersihkan.');
    }
  }

  // Data Export Functions
  function exportToCSV() {
    if (state.history.length === 0) {
      showToast('Tidak ada data riwayat untuk diekspor.', true);
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,No,Tag ID (UID),Tipe Data,Isi Payload,Waktu Pindai,Sumber\n';

    state.history.forEach((item, idx) => {
      const cleanSummary = `"${item.payloadSummary.replace(/"/g, '""')}"`;
      csvContent += `${idx + 1},${item.id},${item.recordType},${cleanSummary},${item.timestamp},${item.source}\n`;
    });

    downloadFile(encodeURI(csvContent), `nfc_scan_history_${Date.now()}.csv`);
    showToast('Berhasil mengekspor data ke file CSV.');
  }

  function exportToJSON() {
    if (state.history.length === 0) {
      showToast('Tidak ada data riwayat untuk diekspor.', true);
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.history, null, 2));
    downloadFile(dataStr, `nfc_scan_history_${Date.now()}.json`);
    showToast('Berhasil mengekspor data ke file JSON.');
  }

  function downloadFile(contentUri, fileName) {
    const link = document.createElement('a');
    link.setAttribute('href', contentUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Audio Synthesizer Beep Feedback (Web Audio API)
  function playBeepSound() {
    if (!state.audioEnabled) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch notification (A6 note)
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio feedback error:', e);
    }
  }

  // Utilities
  function generateRandomSimId() {
    simTagIdInput.value = generateRandomUID('04:');
  }

  function generateRandomUID(prefix = '04:') {
    const hexChars = '0123456789ABCDEF';
    const bytes = [];
    for (let i = 0; i < 6; i++) {
      bytes.push(hexChars[Math.floor(Math.random() * 16)] + hexChars[Math.floor(Math.random() * 16)]);
    }
    return prefix + bytes.join(':');
  }

  function formatHexUID(serialNumber) {
    return serialNumber.toUpperCase().replace(/(.{2})(?=.)/g, '$1:');
  }

  function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(err => {
      showToast('Gagal menyalin teks ke clipboard.', true);
    });
  }

  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    toast.querySelector('.toast-icon').className = isError 
      ? 'fa-solid fa-circle-exclamation toast-icon' 
      : 'fa-solid fa-circle-check toast-icon';
    toast.querySelector('.toast-icon').style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';

    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
});
