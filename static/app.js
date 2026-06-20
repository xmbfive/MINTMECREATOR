// ============================================
// STATE
// ============================================
let provider = null;
let signer = null;
let userAddress = null;
let isDeploying = false;

// ============================================
// DOM ELEMENTS
// ============================================
const connectBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const walletStatus = document.getElementById('walletStatus');
const statusDot = document.getElementById('statusDot');
const deployForm = document.getElementById('deployForm');
const deployBtn = document.getElementById('deployBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const ownerAddressInput = document.getElementById('ownerAddress');
const totalDeployed = document.getElementById('totalDeployed');

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// STATUS MANAGEMENT
// ============================================
function showStatus(type, message) {
    statusDiv.className = 'status ' + type;
    statusDiv.innerHTML = `
        <span class="status-icon">${type === 'loading' ? '⏳' : type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    statusDiv.style.display = 'flex';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 8000);
    }
}

function updateWalletStatus(connected) {
    if (connected) {
        statusDot.className = 'status-dot connected';
        walletStatus.textContent = 'Connected';
    } else {
        statusDot.className = 'status-dot';
        walletStatus.textContent = 'Not Connected';
    }
}

// ============================================
// WALLET CONNECTION
// ============================================
connectBtn.addEventListener('click', async () => {
    try {
        // Check for MetaMask
        if (typeof window.ethereum === 'undefined') {
            showStatus('error', '🦊 Please install MetaMask or a Web3 wallet');
            return;
        }

        // Request accounts
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Update UI
        walletAddress.textContent = formatAddress(userAddress);
        ownerAddressInput.value = userAddress;
        
        // Get balance
        const balance = await provider.getBalance(userAddress);
        const balanceMintme = ethers.utils.formatEther(balance);
        walletBalance.textContent = parseFloat(balanceMintme).toFixed(4);
        
        walletInfo.style.display = 'flex';
        connectBtn.innerHTML = `
            <span class="btn-icon">✅</span>
            <span class="btn-text">Connected</span>
        `;
        connectBtn.disabled = true;
        deployBtn.disabled = false
