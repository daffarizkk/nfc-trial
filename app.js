/**
 * NFC Tag Reader & E-Wallet Inspector - Application JavaScript
 * Supports Web NFC API (`NDEFReader`), E-Wallet Card Auto-Detection, Digital Card UI, Audio Feedback & Simulator.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  const state = {
    isWebNFCSupported: 'NDEFReader' in window,
    isScanning: false,
    ndefReader: null,
    controller: null,
    audioEnabled: true,
    activeTab: 'scannerTab',
    history: JSON.parse(localStorage.getItem('nfc_scan_history') || '[]'),
    activeCard: null,
    ewalletTransactions: JSON.parse(localStorage.getItem('ewallet_tx_history') || '{}')
  };

  // E-Wallet Preset Configurations
  const cardIssuers = {
    mandiri: { name: 'Mandiri e-Money', themeClass: 'mandiri', prefix: '04:A2', holder: 'MANDIRI CARD', defaultBalance: 150000 },
    flazz: { name: 'BCA Flazz', themeClass: 'flazz', prefix: '04:E1', holder: 'FLAZZ BCA CARD', defaultBalance: 87500 },
    tapcash: { name: 'BNI TapCash', themeClass: 'tapcash', prefix: '04:88', holder: 'BNI TAPCASH CARD', defaultBalance: 210000 },
    brizzi: { name: 'BRI BRIZZI', themeClass: 'brizzi', prefix: '04:33', holder: 'BRIZZI CARD', defaultBalance: 64000 },
    jakcard: { name: 'Bank DKI JakCard', themeClass: 'jakcard', prefix: '04:77', holder: 'JAKCARD DKI', defaultBalance: 45000 },
    kmt: { name: 'KMT Commuter Line', themeClass: 'kmt', prefix: '04:11', holder: 'KMT COMMUTER', defaultBalance: 32000 },
    generic: { name: 'Kartu NFC Tag Umum', themeClass: 'generic', prefix: '04:00', holder: 'NFC CARD', defaultBalance: 0 }
  };

  // DOM Elements Selection
  const apiStatusPill = document.getElementById('apiStatusPill');
  const apiStatusText = document.getElementById('apiStatusText');
  const compatibilityBanner = document.getElementById('compatibilityBanner');
  const closeBannerBtn = document.getElementById('closeBannerBtn');

  // Navigation Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Scanner Elements
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
  const scannedIssuer = document.getElementById('scannedIssuer');
  const ndefRecordsList = document.getElementById('ndefRecordsList');

  // E-Wallet Tab Elements
  const digitalCardGraphic = document.getElementById('digitalCardGraphic');
  const cardBrandName = document.getElementById('cardBrandName');
  const cardNumberDisplay = document.getElementById('cardNumberDisplay');
  const cardHolderDisplay = document.getElementById('cardHolderDisplay');
  const cardExpiryDisplay = document.getElementById('cardExpiryDisplay');
  const balanceAmountDisplay = document.getElementById('balanceAmountDisplay');
  const balanceUpdateTime = document.getElementById('balanceUpdateTime');
  const scanEWalletBtn = document.getElementById('scanEWalletBtn');
  const ewalletIssuerBadge = document.getElementById('ewalletIssuerBadge');
  const transactionList = document.getElementById('transactionList');
  const addMockTopupBtn = document.getElementById('addMockTopupBtn');

  // Simulator Elements
  const simForm = document.getElementById('simForm');
  const simTagIdInput = document.getElementById('simTagId');
  const randomIdBtn = document.getElementById('randomIdBtn');
  const simCardIssuerSelect = document.getElementById('simCardIssuer');
  const simBalanceInput = document.getElementById('simBalanceInput');
  const simRecordTypeSelect = document.getElementById('simRecordType');

  // History & Export Elements
  const historyTableBody = document.getElementById('historyTableBody');
  const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
  const historyCount = document.getElementById('historyCount');
  const historySearchInput = document.getElementById('historySearchInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // App Initialization
  init();

  function init() {
    checkWebNFCSupport();
    setupEventListeners();
    generateRandomSimId();
    renderHistoryTable();

    // Default E-Wallet card demo state
    const defaultDemo = {
      id: '04:A2:8B:12:FE:64:80',
      issuerKey: 'mandiri',
      balance: 150000,
      timestamp: new Date().toISOString()
    };
    updateEWalletDisplay(defaultDemo);
  }

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

  function setupEventListeners() {
    // Navigation Tabs
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.target;
        navTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(targetId).classList.add('active');
        state.activeTab = targetId;
      });
    });

    closeBannerBtn.addEventListener('click', () => {
      compatibilityBanner.classList.add('hidden');
    });

    toggleAudioBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      toggleAudioBtn.classList.toggle('active', state.audioEnabled);
      showToast(state.audioEnabled ? 'Efek Suara Diaktifkan' : 'Efek Suara Dinonaktifkan');
    });

    startScanBtn.addEventListener('click', startNFCScanning);
    scanEWalletBtn.addEventListener('click', () => {
      // Switch to scanner tab or scan directly
      startNFCScanning();
      document.getElementById('tabScanner').click();
    });
    stopScanBtn.addEventListener('click', stopNFCScanning);

    copyIdBtn.addEventListener('click', () => {
      if (state.activeCard?.id) {
        copyToClipboard(state.activeCard.id, 'Tag ID berhasil disalin!');
      }
    });

    // Simulator events
    randomIdBtn.addEventListener('click', generateRandomSimId);
    simForm.addEventListener('submit', handleSimulatedScan);

    // E-Wallet actions
    addMockTopupBtn.addEventListener('click', handleMockTopup);

    // History events
    historySearchInput.addEventListener('input', renderHistoryTable);
    exportCsvBtn.addEventListener('click', exportToCSV);
    exportJsonBtn.addEventListener('click', exportToJSON);
    clearHistoryBtn.addEventListener('click', clearHistory);
  }

  // Web NFC Hardware Reader Logic
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

      state.ndefReader.addEventListener('readingerror', () => {
        showToast('Gagal membaca tag NFC. Dekatkan kartu kembali.', true);
      });

      state.ndefReader.addEventListener('reading', ({ message, serialNumber }) => {
        handleNFCReadSuccess(serialNumber, message);
      });

      showToast('Pemindai NFC Aktif! Dekatkan kartu NFC / E-Money.');
    } catch (error) {
      console.error('NFC Scan error:', error);
      updateScannerUI(false);
      
      if (error.name === 'NotAllowedError') {
        showToast('Izin NFC ditolak oleh pengguna/browser.', true);
      } else {
        showToast(`Gagal memulai NFC: ${error.message || 'Error'}`, true);
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
      scannerStatusLabel.textContent = 'Memindai Kartu...';
      scanInstruction.textContent = 'Dekatkan kartu e-Money, Flazz, TapCash, atau Tag NFC ke belakang HP.';
    } else {
      scannerStatusLabel.textContent = 'Siap Memindai';
      scanInstruction.textContent = 'Tempelkan kartu atau tag NFC Anda di belakang perangkat (HP Android), atau gunakan Simulator di bawah.';
    }
  }

  // Read Handler
  function handleNFCReadSuccess(serialNumber, ndefMessage) {
    const tagId = serialNumber ? formatHexUID(serialNumber) : generateRandomUID('04:');
    const records = parseNDEFRecords(ndefMessage);
    const issuerKey = detectIssuerFromUID(tagId);
    const issuerConfig = cardIssuers[issuerKey];

    // Determine balance
    const existingBalance = getSavedBalanceForCard(tagId, issuerConfig.defaultBalance);

    const scanResult = {
      id: tagId,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      issuerKey: issuerKey,
      issuerName: issuerConfig.name,
      balance: existingBalance,
      recordType: records[0]?.type || 'NFC Smart Card',
      payloadSummary: records[0]?.content || `E-Wallet Card (${issuerConfig.name}) - Saldo ${formatRupiah(existingBalance)}`,
      records: records,
      source: 'Hardware Web NFC'
    };

    playEWalletChime();
    displayScanResult(scanResult);
    updateEWalletDisplay(scanResult);
    saveToHistory(scanResult);

    showToast(`Kartu ${issuerConfig.name} Terbaca! Saldo: ${formatRupiah(existingBalance)}`);
  }

  // Simulated Scan Handler
  function handleSimulatedScan(e) {
    e.preventDefault();

    const tagId = simTagIdInput.value.trim().toUpperCase() || generateRandomUID('04:');
    const issuerKey = simCardIssuerSelect.value;
    const issuerConfig = cardIssuers[issuerKey];
    const balance = parseInt(simBalanceInput.value, 10) || 0;
    const recordTypeVal = simRecordTypeSelect.value;

    const mockScan = {
      id: tagId,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      issuerKey: issuerKey,
      issuerName: issuerConfig.name,
      balance: balance,
      recordType: recordTypeVal === 'ewallet' ? 'E-Wallet Smart Card' : recordTypeVal,
      payloadSummary: `Kartu ${issuerConfig.name} - Saldo ${formatRupiah(balance)}`,
      records: [
        {
          recordType: recordTypeVal,
          mediaType: 'application/json',
          content: JSON.stringify({
            cardIssuer: issuerConfig.name,
            cardUID: tagId,
            balance: balance,
            currency: 'IDR',
            status: 'ACTIVE'
          }, null, 2)
        }
      ],
      source: 'Simulator PC'
    };

    // Save balance state
    saveCardBalance(tagId, balance);

    playEWalletChime();
    displayScanResult(mockScan);
    updateEWalletDisplay(mockScan);
    saveToHistory(mockScan);

    showToast(`Simulasi Pindai! ${issuerConfig.name} - ${formatRupiah(balance)}`);
  }

  // Issuer Detection Logic
  function detectIssuerFromUID(tagId) {
    for (const key in cardIssuers) {
      if (key !== 'generic' && tagId.startsWith(cardIssuers[key].prefix)) {
        return key;
      }
    }
    // Random fallback assignment based on UID hash if prefix doesn't match
    const keys = ['mandiri', 'flazz', 'tapcash', 'brizzi', 'jakcard'];
    const charCodeSum = tagId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return keys[charCodeSum % keys.length];
  }

  // Update Standard Scanner Result Card
  function displayScanResult(data) {
    state.activeCard = data;

    resultPlaceholder.classList.add('hidden');
    resultDetails.classList.remove('hidden');

    tagTypeBadge.textContent = data.source;
    tagTypeBadge.className = data.source === 'Simulator PC' ? 'badge badge-info' : 'badge';

    scannedTagId.textContent = data.id;
    scannedTime.textContent = data.formattedTime;
    scannedRecordCount.textContent = `${data.records.length} Record`;
    scannedIssuer.textContent = data.issuerName;

    // Render NDEF Payload
    ndefRecordsList.innerHTML = '';
    data.records.forEach((rec, idx) => {
      const item = document.createElement('div');
      item.className = 'record-card';
      item.innerHTML = `
        <div class="record-header">
          <span>Record #${idx + 1} (${rec.mediaType || 'application/json'})</span>
          <span class="record-type">${rec.recordType}</span>
        </div>
        <pre class="record-content">${escapeHTML(rec.content)}</pre>
      `;
      ndefRecordsList.appendChild(item);
    });
  }

  // Update E-Wallet Tab Display
  function updateEWalletDisplay(cardData) {
    const config = cardIssuers[cardData.issuerKey] || cardIssuers.generic;

    digitalCardGraphic.className = `digital-card ${config.themeClass}`;
    cardBrandName.textContent = config.name;
    cardNumberDisplay.textContent = cardData.id;
    cardHolderDisplay.textContent = config.holder;
    cardExpiryDisplay.textContent = '12/30';

    ewalletIssuerBadge.textContent = config.name;
    balanceAmountDisplay.textContent = formatRupiah(cardData.balance);
    balanceUpdateTime.textContent = `Terakhir Diperbarui: ${new Date().toLocaleTimeString('id-ID')}`;

    renderEWalletTransactions(cardData.id, config.name);
  }

  // Render E-Wallet Mock Transactions
  function renderEWalletTransactions(cardId, issuerName) {
    let txs = state.ewalletTransactions[cardId];
    if (!txs) {
      // Generate realistic default transactions for this card
      txs = [
        { type: 'deduct', title: 'Gerbang Tol Dalam Kota', amount: 10500, time: 'Hari ini, 08:30' },
        { type: 'deduct', title: 'TransJakarta Busway', amount: 3500, time: 'Kemarin, 17:45' },
        { type: 'topup', title: 'Top Up via ATM / Mobile Banking', amount: 100000, time: '3 hari lalu' }
      ];
      state.ewalletTransactions[cardId] = txs;
      localStorage.setItem('ewallet_tx_history', JSON.stringify(state.ewalletTransactions));
    }

    transactionList.innerHTML = '';
    txs.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      item.innerHTML = `
        <div class="tx-info">
          <div class="tx-icon ${tx.type}">
            <i class="fa-solid ${tx.type === 'topup' ? 'fa-arrow-down-long' : 'fa-road'}"></i>
          </div>
          <div>
            <div class="tx-title">${tx.title}</div>
            <div class="tx-date">${tx.time}</div>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${tx.type === 'topup' ? '+' : '-'}${formatRupiah(tx.amount)}</div>
      `;
      transactionList.appendChild(item);
    });
  }

  // Mock Top Up Action
  function handleMockTopup() {
    if (!state.activeCard) {
      showToast('Pindai kartu E-Wallet terlebih dahulu!', true);
      return;
    }

    const topupAmount = 50000;
    state.activeCard.balance += topupAmount;
    saveCardBalance(state.activeCard.id, state.activeCard.balance);

    // Add tx
    const cardId = state.activeCard.id;
    if (!state.ewalletTransactions[cardId]) state.ewalletTransactions[cardId] = [];
    state.ewalletTransactions[cardId].unshift({
      type: 'topup',
      title: 'Top Up Saldo E-Wallet',
      amount: topupAmount,
      time: 'Baru saja'
    });
    localStorage.setItem('ewallet_tx_history', JSON.stringify(state.ewalletTransactions));

    updateEWalletDisplay(state.activeCard);
    playEWalletChime();
    showToast(`Top Up +${formatRupiah(topupAmount)} Berhasil!`);
  }

  // Storage Helpers
  function saveCardBalance(cardId, balance) {
    const balances = JSON.parse(localStorage.getItem('card_balances') || '{}');
    balances[cardId] = balance;
    localStorage.setItem('card_balances', JSON.stringify(balances));
  }

  function getSavedBalanceForCard(cardId, defaultBalance) {
    const balances = JSON.parse(localStorage.getItem('card_balances') || '{}');
    return balances[cardId] !== undefined ? balances[cardId] : defaultBalance;
  }

  function parseNDEFRecords(ndefMessage) {
    if (!ndefMessage || !ndefMessage.records) return [];
    return Array.from(ndefMessage.records).map(rec => {
      const decoder = new TextDecoder(rec.encoding || 'utf-8');
      return {
        recordType: rec.recordType,
        mediaType: rec.mediaType || 'text/plain',
        content: rec.data ? decoder.decode(rec.data) : ''
      };
    });
  }

  // History & Table Render
  function saveToHistory(item) {
    state.history.unshift(item);
    if (state.history.length > 100) state.history.pop();
    localStorage.setItem('nfc_scan_history', JSON.stringify(state.history));
    renderHistoryTable();
  }

  function renderHistoryTable() {
    const query = historySearchInput.value.toLowerCase().trim();
    const filtered = state.history.filter(item => 
      item.id.toLowerCase().includes(query) || 
      (item.issuerName && item.issuerName.toLowerCase().includes(query)) ||
      item.payloadSummary.toLowerCase().includes(query)
    );

    historyCount.textContent = `${state.history.length} Kartu`;
    historyTableBody.innerHTML = '';

    if (filtered.length === 0) {
      emptyHistoryMsg.classList.remove('hidden');
    } else {
      emptyHistoryMsg.classList.add('hidden');

      filtered.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td class="tag-id-cell">${item.id}</td>
          <td><span class="badge badge-info">${item.issuerName || 'NFC Tag'}</span></td>
          <td>${formatRupiah(item.balance || 0)} (${escapeHTML(item.payloadSummary)})</td>
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
    if (confirm('Hapus seluruh riwayat pemindaian?')) {
      state.history = [];
      localStorage.removeItem('nfc_scan_history');
      renderHistoryTable();
      showToast('Riwayat pemindaian dibersihkan.');
    }
  }

  // Export CSV & JSON
  function exportToCSV() {
    if (state.history.length === 0) return showToast('Tidak ada data riwayat.', true);
    let csv = 'No,Tag ID (UID),Bank/Issuer,Saldo (IDR),Payload Summary,Waktu,Sumber\n';
    state.history.forEach((item, idx) => {
      const summary = `"${item.payloadSummary.replace(/"/g, '""')}"`;
      csv += `${idx + 1},${item.id},${item.issuerName || 'NFC Tag'},${item.balance || 0},${summary},${item.timestamp},${item.source}\n`;
    });
    downloadFile(encodeURI('data:text/csv;charset=utf-8,' + csv), `nfc_ewallet_history_${Date.now()}.csv`);
    showToast('Ekspor CSV Berhasil!');
  }

  function exportToJSON() {
    if (state.history.length === 0) return showToast('Tidak ada data riwayat.', true);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.history, null, 2));
    downloadFile(dataStr, `nfc_ewallet_history_${Date.now()}.json`);
    showToast('Ekspor JSON Berhasil!');
  }

  function downloadFile(contentUri, fileName) {
    const link = document.createElement('a');
    link.href = contentUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Audio Synthesizer Beep (Payment Success Chime)
  function playEWalletChime() {
    if (!state.audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();

      // Play pleasant 2-tone payment chime (E5 -> B5)
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playTone(659.25, ctx.currentTime, 0.15); // E5
      playTone(987.77, ctx.currentTime + 0.12, 0.3); // B5
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Utility Functions
  function generateRandomSimId() {
    simTagIdInput.value = generateRandomUID('04:');
  }

  function generateRandomUID(prefix = '04:') {
    const hex = '0123456789ABCDEF';
    const bytes = [];
    for (let i = 0; i < 6; i++) {
      bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
    }
    return prefix + bytes.join(':');
  }

  function formatHexUID(serialNumber) {
    return serialNumber.toUpperCase().replace(/(.{2})(?=.)/g, '$1:');
  }

  function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => showToast('Gagal menyalin', true));
  }

  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    toast.querySelector('.toast-icon').className = isError 
      ? 'fa-solid fa-circle-exclamation toast-icon' 
      : 'fa-solid fa-circle-check toast-icon';
    toast.querySelector('.toast-icon').style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';

    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
});
